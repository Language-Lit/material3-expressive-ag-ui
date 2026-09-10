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
  let snapshot = build()
  let detach: (() => void) | undefined
  let scheduled = false
  const listeners = new Set<() => void>()

  function build(): AgentSnapshot {
    return {
      messages: agent.messages.slice(),
      state: agent.state,
      overlay,
      isRunning: agent.isRunning,
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
    onRunFailed() {
      publish()
    },
    onRunFinalized() {
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
