import type { AbstractAgent, AgentSubscriber } from '@ag-ui/client'
import type { Interrupt, Message, State } from '@ag-ui/core'

import { createRunOverlay, reduceRunOverlay } from '../protocol/run-state'
import type { RunOverlay } from '../protocol/timeline.types'

/**
 * The bridge between a mutable agent and React.
 *
 * `AbstractAgent` is an imperative object: it mutates `messages`, `state` and
 * `isRunning` in place and announces the change through subscriber callbacks.
 * React needs the opposite — an immutable snapshot whose identity changes
 * exactly when something changed. This store is that adapter, shaped for
 * `useSyncExternalStore` so concurrent rendering cannot tear.
 */

export interface AgentSnapshot {
  messages: readonly Message[]
  state: State
  overlay: RunOverlay
  isRunning: boolean
  interrupts: readonly Interrupt[]
}

export interface AgentStore {
  subscribe(listener: () => void): () => void
  getSnapshot(): AgentSnapshot
}

export function createAgentStore(agent: AbstractAgent): AgentStore {
  let overlay = createRunOverlay()
  let finalized = false
  let snapshot = build()
  let detach: (() => void) | undefined
  let scheduled = false
  const listeners = new Set<() => void>()

  function build(): AgentSnapshot {
    return {
      messages: agent.messages.slice(),
      state: agent.state,
      overlay,
      isRunning: agent.isRunning && !finalized,
      interrupts: agent.pendingInterrupts.slice(),
    }
  }

  /**
   * A streaming run fires several callbacks per token — `onEvent` plus
   * `onMessagesChanged` for the same delta. Publishing on each one would
   * re-render the whole thread two or three times per token, so notifications
   * are coalesced into one per microtask.
   */
  function publish(): void {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      snapshot = build()
      for (const listener of [...listeners]) listener()
    })
  }

  const subscriber: AgentSubscriber = {
    onRunInitialized({ input }) {
      finalized = false
      overlay = { ...createRunOverlay(), phase: 'running', runId: input.runId, threadId: input.threadId }
      publish()
    },
    onEvent({ event }) {
      overlay = reduceRunOverlay(overlay, event)
      publish()
    },
    onMessagesChanged() {
      publish()
    },
    onStateChanged() {
      publish()
    },
    onRunFailed({ error }) {
      // Transport failures do not necessarily arrive as RUN_ERROR events.
      // Cancellation is a normal terminal state, not a failed reply.
      overlay = {
        ...overlay,
        phase: error.name === 'AbortError' ? 'idle' : 'error',
        error: error.name === 'AbortError' ? undefined : { message: error.message },
        streamingMessageIds: new Set(),
        streamingToolCallIds: new Set(),
      }
      publish()
    },
    onRunFinalized() {
      // The SDK may notify before resetting isRunning in its finally block.
      finalized = true
      overlay = {
        ...overlay,
        phase: overlay.phase === 'error' ? 'error' : 'idle',
        streamingMessageIds: new Set(),
        streamingToolCallIds: new Set(),
        steps: overlay.steps.filter((step) => step.status !== 'running'),
        subagents: overlay.subagents.filter((subagent) => subagent.status !== 'running'),
      }
      publish()
    },
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      // Attach to the agent only while something is actually rendering it, so
      // an unmounted thread leaves no subscriber behind.
      if (!detach) {
        const subscription = agent.subscribe(subscriber)
        detach = () => subscription.unsubscribe()
      }
      // A run may have advanced between store creation and this subscription.
      snapshot = build()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && detach) {
          detach()
          detach = undefined
        }
      }
    },
    getSnapshot() {
      return snapshot
    },
  }
}
