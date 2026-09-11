import { act, renderHook, waitFor } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HttpAgent } from '@ag-ui/client'
import type { State } from '@ag-ui/core'
import { startAgUiHttpServer, type AgUiHttpServer } from '../../fixtures/ag-ui-http-server'
import { useAgent } from '../../src/runtime/useAgent'
import { useAgentDraft, type AgentProposal } from '../../src/runtime/useAgentDraft'

interface Profile { name: string }

const strict = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>
const select = (state: State) => state.proposal as AgentProposal<Profile> | undefined

function useEditor(agent: HttpAgent) {
  const binding = useAgent(agent)
  return { binding, editor: useAgentDraft(binding, select) }
}

/**
 * Run until the agent pauses for approval, with an edit made mid-stream:
 * review revision 1, type over it, then let the server publish revision 2.
 */
async function pauseForApproval(server: AgUiHttpServer) {
  const agent = new HttpAgent({ url: server.url })
  const view = renderHook(() => useEditor(agent), { wrapper: strict })
  let running!: Promise<void>
  act(() => { running = view.result.current.binding.run() })
  await waitFor(() => expect(view.result.current.editor.latest?.revision).toBe(1))
  act(() => view.result.current.editor.review(view.result.current.editor.latest!))
  act(() => view.result.current.editor.setDraft({ name: 'human edit' }))
  await act(async () => { server.publishUpdate(); await running })
  return view.result
}

describe('approval against a real HTTP backend', () => {
  let server: AgUiHttpServer
  beforeEach(async () => { server = await startAgUiHttpServer() })
  afterEach(async () => { await server.close() })

  it('sends the reviewed revision over the wire and the backend applies it', async () => {
    const result = await pauseForApproval(server)

    // The mid-run snapshot arrived through SSE; the draft outlived it.
    expect(result.current.editor.draft).toEqual({ name: 'human edit' })
    expect(result.current.editor.latest).toEqual({ id: 'profile', revision: 2, value: { name: 'Agent suggestion' } })
    expect(result.current.editor.isStale).toBe(true)
    expect(result.current.binding.interrupts.map(interrupt => interrupt.id)).toEqual(['review-2'])
    // Nothing is sent against a proposal the person was never shown.
    await expect(result.current.editor.approve('review-2')).rejects.toThrow(/proposal changed/)
    expect(server.requests).toHaveLength(1)

    act(() => result.current.editor.review(result.current.editor.latest!, { keepDraft: true }))
    await act(async () => { await result.current.editor.approve('review-2') })

    expect(server.requests.at(-1)?.resume).toEqual([{
      interruptId: 'review-2',
      status: 'resolved',
      payload: { proposalId: 'profile', expectedRevision: 2, changes: { name: 'human edit' } },
    }])
    expect(server.proposal).toEqual({ id: 'profile', revision: 3, value: { name: 'human edit' } })
    expect(result.current.binding.state.proposal).toEqual(server.proposal)
    expect(result.current.binding.interrupts).toEqual([])
    expect(result.current.binding.error).toBeUndefined()
    // The reply streamed back over the same connection and assembled normally.
    expect(result.current.binding.messages.at(-1)).toMatchObject({ role: 'assistant', content: 'Saved human edit.' })
  })

  it('applies nothing when the backend moved on, and re-asks with the change', async () => {
    const result = await pauseForApproval(server)
    act(() => result.current.editor.review(result.current.editor.latest!, { keepDraft: true }))
    // Another actor writes while this client is paused. No client check can see it.
    server.changeProposal('another actor')

    await act(async () => { await result.current.editor.approve('review-2') })

    expect(server.proposal).toEqual({ id: 'profile', revision: 3, value: { name: 'another actor' } })
    expect(result.current.editor.draft).toEqual({ name: 'human edit' })
    expect(result.current.binding.state.proposal).toEqual(server.proposal)
    expect(result.current.binding.interrupts.map(interrupt => interrupt.id)).toEqual(['review-3'])
    expect(result.current.editor.isStale).toBe(true)

    // The loop closes: review what the server sent back, then approve again.
    act(() => result.current.editor.review(result.current.editor.latest!, { keepDraft: true }))
    await act(async () => { await result.current.editor.approve('review-3') })

    expect(server.proposal).toEqual({ id: 'profile', revision: 4, value: { name: 'human edit' } })
    expect(result.current.binding.interrupts).toEqual([])
    expect(server.requests.map(request => request.resume?.[0]?.payload?.expectedRevision)).toEqual([undefined, 2, 3])
  })
})
