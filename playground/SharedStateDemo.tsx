import { createContext, useContext, useMemo, useState } from 'react'
import { Button, Card, Text, TextField } from '@language-lit/material3-expressive'
import { EventType, type BaseEvent, type State } from '@ag-ui/core'
import { AgentChat } from '../src/components/AgentChat'
import { AgentProvider, useAgentContext, type InterruptRendererProps } from '../src/runtime/agent-context'
import { useAgentDraft, type AgentProposal, type UseAgentDraftResult } from '../src/runtime/useAgentDraft'
import { ScriptedAgent, script } from '../fixtures/scripted-agent'

type Profile = { name: string }
const DraftContext = createContext<UseAgentDraftResult<Profile> | undefined>(undefined)
const selectProposal = (state: State) => state.proposal as AgentProposal<Profile> | undefined

/** Scripted server contract: validate identity/revision before applying changes. */
export function createSharedStateDemo() {
  let proposal: AgentProposal<Profile> = { id: 'profile', revision: 1, value: { name: 'Alex' } }
  let release: (() => void) | undefined
  let gate: Promise<void> = Promise.resolve()
  let gatedEvent: BaseEvent | undefined
  const stateEvent = (): BaseEvent => ({ type: EventType.STATE_SNAPSHOT, snapshot: { proposal: structuredClone(proposal) } } as BaseEvent)
  const interrupt = (input: Parameters<typeof script.runStarted>[0], message: string) =>
    script.runInterrupted(input, [{ id: `review-${proposal.revision}`, reason: 'approval_required', message }])
  const agent = new ScriptedAgent({
    initialState: { proposal: structuredClone(proposal) },
    beforeEvent: event => event === gatedEvent ? gate : Promise.resolve(),
    script: input => {
      if (input.resume?.length) {
        const response = input.resume[0]!
        if (response.status === 'cancelled') return [script.runStarted(input), ...script.text(`cancel-${input.runId}`, 'Changes cancelled.'), script.runFinished(input)]
        const payload = response.payload as { proposalId?: unknown; expectedRevision?: unknown; changes?: { name?: unknown } } | undefined
        if (payload?.proposalId !== proposal.id || payload?.expectedRevision !== proposal.revision) {
          return [script.runStarted(input), stateEvent(), interrupt(input, 'The server proposal changed. Review it again; your draft is still here.')]
        }
        if (typeof payload.changes?.name !== 'string' || !payload.changes.name.trim()) {
          return [script.runStarted(input), interrupt(input, 'Enter a name before approving.')]
        }
        // In a real backend this check and write must be one atomic operation.
        proposal = { ...proposal, revision: Number(proposal.revision) + 1, value: { name: payload.changes.name } }
        return [script.runStarted(input), stateEvent(), ...script.text(`done-${input.runId}`, `Saved ${proposal.value.name}.`), script.runFinished(input)]
      }
      gate = new Promise<void>(resolve => { release = resolve })
      proposal = { ...proposal, revision: Number(proposal.revision) + 1, value: { name: 'Agent suggestion' } }
      gatedEvent = stateEvent()
      return [script.runStarted(input),
        { type: EventType.TEXT_MESSAGE_CHUNK, messageId: `a-${input.runId}`, role: 'assistant', delta: 'Edit the name while I prepare an updated proposal. ' } as BaseEvent,
        gatedEvent,
        { type: EventType.TEXT_MESSAGE_CHUNK, messageId: `a-${input.runId}`, delta: 'The updated proposal is ready for review.' } as BaseEvent,
        interrupt(input, 'Approve your draft against the reviewed proposal?')]
    },
  })
  return {
    agent,
    advance: () => release?.(),
    changeServer: () => { proposal = { ...proposal, revision: Number(proposal.revision) + 1, value: { name: 'New server suggestion' } } },
  }
}

function ReviewApproval({ node, agent }: InterruptRendererProps) {
  const editor = useContext(DraftContext)!
  const [error, setError] = useState<string>()
  async function answer(approve: boolean) {
    setError(undefined)
    try {
      if (approve) await editor.approve(node.id)
      else await agent.resolveInterrupt(node.id, { status: 'cancelled' })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Approval failed.') }
  }
  return <Card variant="filled" className="pg-review-card">
    <Text as="p" variant="bodyLarge">{node.message}</Text>
    {editor.isStale ? <Text as="p" variant="bodyMedium">Review the latest proposal above before approving.</Text> : null}
    {error ? <Text as="p" variant="bodyMedium">{error}</Text> : null}
    <div className="pg-bar__actions">
      <Button variant="text" disabled={agent.isRunning || editor.isSubmitting} onClick={() => void answer(false)}>Cancel draft</Button>
      <Button disabled={editor.isStale || editor.isSubmitting || agent.isRunning} onClick={() => void answer(true)}>Approve draft</Button>
    </div>
  </Card>
}

function DraftSession({ demo }: { demo: ReturnType<typeof createSharedStateDemo> }) {
  const binding = useAgentContext()
  const editor = useAgentDraft(binding, selectProposal)
  const [error, setError] = useState<string>()
  const [serverChanged, setServerChanged] = useState(false)
  function review(keepDraft: boolean) {
    try { editor.review(editor.latest!, { keepDraft }); setError(undefined) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Review failed.') }
  }
  return <DraftContext.Provider value={editor}>
    <div className="pg-review-layout">
      <Card variant="outlined" className="pg-review-card">
        <Text as="h2" variant="titleLarge">Edit while the agent works</Text>
        <Text as="p" variant="bodyMedium">Start a review, edit your draft, then publish the incoming update. Your edit stays intact.</Text>
        <TextField label="Your draft name" value={editor.draft?.name ?? ''} disabled={editor.isSubmitting}
          onChange={event => editor.setDraft({ name: event.target.value })} />
        <Text as="p" variant="bodyMedium">Latest proposal: {editor.latest?.value.name} · revision {editor.latest?.revision}</Text>
        <Text as="p" variant="bodyMedium">{editor.isStale ? 'Proposal changed. Your draft has been preserved.' : `Reviewed revision ${editor.reviewed?.revision}.`}</Text>
        <div className="pg-bar__actions">
          <Button disabled={binding.isRunning || binding.interrupts.length > 0} onClick={() => {
            setServerChanged(false)
            void binding.send('Review this profile').catch(cause => setError(String(cause)))
          }}>Start review</Button>
          <Button variant="outlined" disabled={!binding.isRunning} onClick={demo.advance}>Publish incoming update</Button>
          {editor.isStale && editor.latest ? <>
            <Button variant="outlined" disabled={editor.isSubmitting} onClick={() => review(true)}>Review latest and keep my draft</Button>
            <Button variant="text" disabled={editor.isSubmitting} onClick={() => review(false)}>Use server suggestion</Button>
          </> : null}
        </div>
        {binding.interrupts.length > 0 ? <>
          <Button variant="text" disabled={binding.isRunning} onClick={() => { demo.changeServer(); setServerChanged(true) }}>Simulate unseen server change</Button>
          {serverChanged ? <Text as="p" variant="bodyMedium">The server changed independently. Approval will require a fresh review.</Text> : null}
        </> : null}
        {error ? <Text as="p" variant="bodyMedium">{error}</Text> : null}
      </Card>
      <AgentChat emptyState={<Text as="p" variant="bodyLarge">Start a review above.</Text>} />
    </div>
  </DraftContext.Provider>
}

export function SharedStateDemo() {
  const demo = useMemo(createSharedStateDemo, [])
  return <AgentProvider agent={demo.agent} interruptRenderer={ReviewApproval}><DraftSession demo={demo} /></AgentProvider>
}
