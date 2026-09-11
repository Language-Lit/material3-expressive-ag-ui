import { act, renderHook, waitFor } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { EventType, type BaseEvent, type RunAgentInput } from '@ag-ui/core'
import { ScriptedAgent, script } from '../../fixtures/scripted-agent'
import { useAgent } from '../../src/runtime/useAgent'
import { useAgentDraft } from '../../src/runtime/useAgentDraft'

function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}

const snapshot = (state: Record<string, unknown>): BaseEvent => ({
  type: EventType.STATE_SNAPSHOT, snapshot: state,
} as BaseEvent)
const delta = (path: string, value: unknown): BaseEvent => ({
  type: EventType.STATE_DELTA, delta: [{ op: 'replace', path, value }],
} as BaseEvent)
const strict = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>

describe('shared state during human interaction (real SDK)', () => {
  it.each(['delta', 'snapshot'] as const)('exposes the SDK overwrite boundary for an incoming %s', async (kind) => {
    const next = gate()
    const incoming = kind === 'delta'
      ? delta('/progress', 2)
      : snapshot({ name: 'server', progress: 2 })
    const agent = new ScriptedAgent({
      script: (input) => [script.runStarted(input), snapshot({ name: 'server', progress: 1 }),
        incoming, script.runFinished(input)],
      beforeEvent: (event) => event === incoming ? next.promise : Promise.resolve(),
    })
    const { result } = renderHook(() => useAgent(agent), { wrapper: strict })
    let running!: Promise<void>
    act(() => { running = result.current.run() })
    try {
      await waitFor(() => expect(result.current.state).toEqual({ name: 'server', progress: 1 }))
      expect(result.current.isRunning).toBe(true)
      const previous = result.current.state
      expect(() => result.current.setState({ ...result.current.state, name: 'human' })).toThrow(/useAgentDraft/)
      // Raw SDK calls bypass our guard. Retain the reproduction of its behavior.
      act(() => agent.setState({ ...result.current.state, name: 'human' }))
      await waitFor(() => expect(result.current.state.name).toBe('human'))
      expect(previous).toEqual({ name: 'server', progress: 1 })
      await act(async () => { next.release(); await running })
      // Even a delta to another field uses the SDK's run-local state, not the
      // frontend setState replacement. Do not claim automatic reconciliation.
      expect(result.current.state).toEqual({ name: 'server', progress: 2 })
      expect(result.current.state).toEqual(agent.state)
      expect(result.current.isRunning).toBe(false)
    } finally { next.release(); await running }
  })

  it.each(['resolved', 'cancelled'] as const)('resumes with the latest paused edit when %s', async (status) => {
    const inputs: RunAgentInput[] = []
    const agent = new ScriptedAgent({ script: (input) => {
      inputs.push(input)
      return input.resume?.length
        ? [script.runStarted(input), delta('/progress', 2),
          ...script.text('done', 'Continued'), script.runFinished(input)]
        : [script.runStarted(input), snapshot({ name: 'server', progress: 1 }),
          script.runInterrupted(input, [{ id: 'review', reason: 'approval_required' }])]
    } })
    const { result } = renderHook(() => useAgent(agent), { wrapper: strict })
    await act(async () => { await result.current.send('Review') })
    expect(result.current.interrupts.map(i => i.id)).toEqual(['review'])
    expect(result.current.isRunning).toBe(false)
    // Same turn: resume must read the agent's latest state, not React's
    // microtask-coalesced snapshot from the previous render.
    await act(async () => {
      result.current.setState({ name: 'human', progress: 1 })
      await result.current.resolveInterrupt('review', { status })
    })
    expect(inputs[1]?.state).toEqual({ name: 'human', progress: 1 })
    expect(inputs[1]?.resume).toEqual([expect.objectContaining({ interruptId: 'review', status })])
    expect(result.current.state).toEqual({ name: 'human', progress: 2 })
    expect(result.current.interrupts).toEqual([])
    expect(result.current.messages.map(m => m.id)).toContain('done')
  })

  it.each([false, true])('preserves an application draft and validates approval revision (stale=%s)', async (stale) => {
    const next = gate()
    const incoming = delta('/revision', 2)
    const inputs: RunAgentInput[] = []
    let authoritativeRevision = 2
    let appliedName: string | undefined
    const agent = new ScriptedAgent({
      beforeEvent: (event) => event === incoming ? next.promise : Promise.resolve(),
      script: (input) => {
        inputs.push(input)
        if (!input.resume?.length) return [script.runStarted(input),
          snapshot({ name: 'server', revision: 1 }),
          { type: EventType.TEXT_MESSAGE_CHUNK, messageId: 'stream', role: 'assistant', delta: 'Review ' } as BaseEvent,
          incoming,
          { type: EventType.TEXT_MESSAGE_CHUNK, messageId: 'stream', delta: 'this proposal.' } as BaseEvent,
          script.runInterrupted(input, [{ id: 'review', reason: 'approval_required' }])]
        // Application/backend contract, deliberately not a library feature.
        const response = input.resume[0] as { payload?: { proposalId: string; expectedRevision: number; changes: string } }
        if (response.payload?.expectedRevision !== authoritativeRevision) {
          return [script.runStarted(input), snapshot({ name: 'server', revision: authoritativeRevision }),
            script.runInterrupted(input, [{ id: 'review-new', reason: 'approval_required', message: 'Proposal changed; review again.' }])]
        }
        expect(response.payload.proposalId).toBe('proposal')
        appliedName = response.payload.changes
        return [script.runStarted(input), snapshot({ name: appliedName, revision: authoritativeRevision }),
          ...script.text('done', 'Applied'), script.runFinished(input)]
      },
    })
    const { result } = renderHook(() => {
      const binding = useAgent(agent)
      const editor = useAgentDraft(binding, state => typeof state.revision === 'number'
        ? { id: 'proposal', revision: state.revision, value: String(state.name) } : undefined)
      return { ...binding, editor }
    }, { wrapper: strict })
    let running!: Promise<void>
    act(() => { running = result.current.send('Review') })
    try {
      await waitFor(() => expect(result.current.state.revision).toBe(1))
      act(() => {
        result.current.editor.review(result.current.editor.latest!)
        result.current.editor.setDraft('human edit')
      })
      expect(result.current.isRunning).toBe(true)
      await act(async () => { next.release(); await running })
      expect(result.current.editor.draft).toBe('human edit')
      expect(result.current.state.revision).toBe(2)
      expect(result.current.timeline).toContainEqual(expect.objectContaining({ kind: 'assistant-text', content: 'Review this proposal.' }))
      expect(result.current.interrupts.map(i => i.id)).toEqual(['review'])
      expect(result.current.editor.isStale).toBe(true)
      await expect(result.current.editor.approve('review')).rejects.toThrow(/proposal changed/)
      expect(inputs).toHaveLength(1)
      act(() => result.current.editor.review(result.current.editor.latest!, { keepDraft: true }))
      if (stale) authoritativeRevision = 3
      await act(async () => { await result.current.editor.approve('review') })
      expect(inputs[1]?.resume).toEqual([expect.objectContaining({ payload: { proposalId: 'proposal', expectedRevision: 2, changes: 'human edit' } })])
      expect(result.current.editor.draft).toBe('human edit')
      if (stale) {
        expect(appliedName).toBeUndefined()
        expect(result.current.interrupts.map(i => i.id)).toEqual(['review-new'])
        expect(result.current.state.revision).toBe(3)
      } else {
        expect(appliedName).toBe('human edit')
        expect(result.current.state.name).toBe('human edit')
        expect(result.current.interrupts).toEqual([])
      }
    } finally { next.release(); await running }
  })
})
