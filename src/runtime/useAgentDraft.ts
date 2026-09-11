import { useMemo, useSyncExternalStore } from 'react'
import type { AbstractAgent } from '@ag-ui/client'
import type { State } from '@ag-ui/core'
import type { UseAgentResult } from './useAgent'
import { sameJson } from '../internal/sameJson'

export interface AgentProposal<T> {
  id: string
  revision: string | number
  value: T
}

export interface AgentDraftApproval<T> {
  proposalId: string
  expectedRevision: string | number
  changes: T
}

export interface AgentDraftBinding {
  agent: AbstractAgent
  state: State
  resolveInterrupt: UseAgentResult['resolveInterrupt']
}

export interface UseAgentDraftResult<T> {
  draft: T | undefined
  reviewed: AgentProposal<T> | undefined
  latest: AgentProposal<T> | undefined
  isStale: boolean
  isSubmitting: boolean
  setDraft(value: T): void
  /** Pass the proposal displayed to the user, not a silently refreshed baseline. */
  review(proposal: AgentProposal<T>, options?: { keepDraft?: boolean }): void
  approve(interruptId: string): Promise<void>
}

/** Isolated JSON-compatible form drafts. Requires a backend revision check on resume. */
export function useAgentDraft<T>(
  binding: AgentDraftBinding,
  selectProposal: (state: State) => AgentProposal<T> | undefined,
): UseAgentDraftResult<T> {
  // One edit session per agent, not per incoming state snapshot or render.
  const local = useMemo(() => {
    const reviewed = structuredClone(selectProposal(binding.agent.state))
    let value = { reviewed, draft: structuredClone(reviewed?.value), isSubmitting: false }
    const listeners = new Set<() => void>()
    return {
      getSnapshot: () => value,
      subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
      update: (next: typeof value) => { value = next; listeners.forEach(listener => listener()) },
    }
    // A new selector function on render must not discard edits.
  }, [binding.agent])
  const session = useSyncExternalStore(local.subscribe, local.getSnapshot, local.getSnapshot)
  const latest = selectProposal(binding.state)

  function assertCurrent(proposal: AgentProposal<T> | undefined) {
    if (!proposal || !sameJson(proposal, selectProposal(binding.agent.state))) {
      throw new Error('The proposal changed. Review the latest proposal before approving.')
    }
  }

  return {
    ...session,
    latest,
    isStale: !session.reviewed || !sameJson(session.reviewed, latest),
    setDraft(draft) {
      const current = local.getSnapshot()
      if (current.isSubmitting) throw new Error('Wait for the approval request to finish before editing.')
      local.update({ ...current, draft: structuredClone(draft) })
    },
    review(proposal, options) {
      const current = local.getSnapshot()
      if (current.isSubmitting) throw new Error('An approval request is already active.')
      assertCurrent(proposal)
      local.update({
        ...current,
        reviewed: structuredClone(proposal),
        draft: options?.keepDraft && current.draft !== undefined
          ? current.draft : structuredClone(proposal.value),
      })
    },
    async approve(interruptId) {
      const current = local.getSnapshot()
      if (current.isSubmitting) throw new Error('An approval request is already active.')
      if (binding.agent.isRunning) throw new Error('Wait for the agent to pause before approving.')
      assertCurrent(current.reviewed)
      if (!binding.agent.pendingInterrupts.some(interrupt => interrupt.id === interruptId)) {
        throw new Error('This approval is no longer pending.')
      }
      if (current.draft === undefined) throw new Error('There is no draft to approve.')
      const payload: AgentDraftApproval<T> = {
        proposalId: current.reviewed!.id,
        expectedRevision: current.reviewed!.revision,
        changes: structuredClone(current.draft),
      }
      const expectedState = structuredClone(binding.agent.state)
      local.update({ ...current, isSubmitting: true })
      try {
        await binding.resolveInterrupt(interruptId, { status: 'resolved', payload }, { expectedState })
      } finally {
        local.update({ ...local.getSnapshot(), isSubmitting: false })
      }
    },
  }
}
