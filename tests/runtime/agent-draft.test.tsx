import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { State, RunAgentInput } from '@ag-ui/core'
import { ScriptedAgent, script } from '../../fixtures/scripted-agent'
import { useAgent } from '../../src/runtime/useAgent'
import { useAgentDraft } from '../../src/runtime/useAgentDraft'

const select = (state: State) => state.revision === undefined ? undefined : ({
  id: String(state.id), revision: Number(state.revision), value: { name: String(state.name) },
})
function create(scriptOverride?: (input: RunAgentInput) => ReturnType<typeof script.runStarted>[]) {
  return new ScriptedAgent({ initialState: { id: 'p1', revision: 1, name: 'server' },
    script: scriptOverride ?? (input => input.resume?.length
      ? [script.runStarted(input), script.runFinished(input)]
      : [script.runStarted(input), script.runInterrupted(input, [{ id: 'i1', reason: 'review' }])]),
  })
}
function useEditor(agent: ScriptedAgent) {
  const binding = useAgent(agent)
  return { binding, editor: useAgentDraft(binding, select) }
}

describe('guarded drafts', () => {
  it.each([
    { id: 'p1', revision: 2, name: 'server' },
    { id: 'p2', revision: 1, name: 'server' },
    { id: 'p1', revision: 1, name: 'changed without version bump' },
    {},
  ])('checks live state before React publishes it: %j', async next => {
    const agent = create()
    const { result } = renderHook(() => useEditor(agent))
    await act(async () => { await result.current.binding.run() })
    const staleEditor = result.current.editor
    const reviewed = staleEditor.latest!
    await act(async () => {
      agent.setState(next)
      expect(() => staleEditor.review(reviewed)).toThrow(/proposal changed/)
      await expect(staleEditor.approve('i1')).rejects.toThrow(/proposal changed/)
    })
    expect(agent.pendingInterrupts.map(i => i.id)).toEqual(['i1'])
    expect(result.current.editor.draft).toEqual({ name: 'server' })
  })

  it('preserves edits on failure and supports a retry without two concurrent resumes', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    let attempt = 0
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const inputs: RunAgentInput[] = []
    const agent = create(input => {
      inputs.push(input)
      if (!input.resume?.length) return [script.runStarted(input), script.runInterrupted(input, [{ id: 'i1', reason: 'review' }])]
      if (++attempt === 1) throw new Error('Network failed')
      return [script.runStarted(input), script.runFinished(input)]
    })
    const { result } = renderHook(() => useEditor(agent))
    try {
      await act(async () => { await result.current.binding.run() })
      act(() => result.current.editor.setDraft({ name: 'human' }))
      await act(async () => { await expect(result.current.editor.approve('i1')).rejects.toThrow('Network failed') })
      expect(result.current.editor.draft).toEqual({ name: 'human' })
      expect(result.current.editor.isSubmitting).toBe(false)
      // Gate the real SDK lifecycle rather than mocking resolveInterrupt.
      const subscription = agent.subscribe({ onRunInitialized: () => gate })
      let running!: Promise<void>
      await act(async () => {
        running = result.current.editor.approve('i1')
        await expect(result.current.editor.approve('i1')).rejects.toThrow(/already active/)
        await expect(result.current.binding.resolveInterrupt('i1', { status: 'resolved' })).rejects.toThrow(/active run/)
        expect(() => result.current.editor.setDraft({ name: 'too late' })).toThrow(/finish before editing/)
        release()
        await running
      })
      subscription.unsubscribe()
      expect(inputs).toHaveLength(3)
      expect(inputs[2]?.resume?.[0]).toMatchObject({ payload: { proposalId: 'p1', expectedRevision: 1, changes: { name: 'human' } } })
      await expect(result.current.editor.approve('i1')).rejects.toThrow(/no longer pending/)
    } finally { release?.(); errorLog.mockRestore() }
  })

  it('explicitly replaces drafts and resets the edit session on agent change', () => {
    const first = create()
    const second = create()
    second.setState({ id: 'p2', revision: 5, name: 'another agent' })
    const { result, rerender } = renderHook(({ agent }) => useEditor(agent), { initialProps: { agent: first } })
    act(() => result.current.editor.setDraft({ name: 'human' }))
    act(() => result.current.editor.review(result.current.editor.latest!))
    expect(result.current.editor.draft).toEqual({ name: 'server' })
    act(() => result.current.editor.setDraft({ name: 'human again' }))
    rerender({ agent: second })
    expect(result.current.editor.draft).toEqual({ name: 'another agent' })
    expect(result.current.editor.reviewed?.id).toBe('p2')
  })
})
