import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { buildResumeArray, randomUUID } from '@ag-ui/client'
import type { AbstractAgent, RunAgentParameters } from '@ag-ui/client'
import type { Context, Interrupt, Message, State, Tool } from '@ag-ui/core'

import { projectTimeline } from '../protocol/project'
import type { RunPhase, StepRecord, TimelineNode } from '../protocol/timeline.types'
import { createAgentStore } from './agent-store'

/** Answer to one interrupt, mirroring `buildResumeArray`'s response shape. */
export type InterruptResponse =
  | { status: 'resolved'; payload?: unknown; metadata?: Record<string, unknown> }
  | { status: 'cancelled'; metadata?: Record<string, unknown> }

export interface UseAgentOptions {
  /** Show reasoning nodes. Default `true`. */
  includeReasoning?: boolean
  /** Show `system` and `developer` messages. Default `false`. */
  includeSystem?: boolean
  /** Frontend tools advertised to the agent on every run. */
  tools?: readonly Tool[]
  /** Ambient context sent with every run. */
  context?: readonly Context[]
  /** Backend-specific payload forwarded verbatim on every run. */
  forwardedProps?: Record<string, unknown>
}

export interface UseAgentResult {
  agent: AbstractAgent
  /** The render model: the transcript joined with live run state. */
  timeline: TimelineNode[]
  messages: readonly Message[]
  /** Shared state the agent maintains through `STATE_SNAPSHOT`/`STATE_DELTA`. */
  state: State
  phase: RunPhase
  isRunning: boolean
  steps: readonly StepRecord[]
  /** Interrupts awaiting an answer before the run can continue. */
  interrupts: readonly Interrupt[]
  error: { message: string; code?: string } | undefined
  /** Append a user message and start a run. */
  send(text: string): Promise<void>
  /** Start a run without adding a message — a retry, or a resume. */
  run(parameters?: RunAgentParameters): Promise<void>
  /** Abort the run in flight. */
  stop(): void
  /** Answer one interrupt and resume the run. */
  resolveInterrupt(interruptId: string, response: InterruptResponse): Promise<void>
  setState(state: State): void
}

/**
 * Bind an AG-UI agent to a React tree.
 *
 * The agent is the source of truth for the transcript and shared state; this
 * hook adds the run overlay the transcript cannot express and hands back a
 * ready-to-render timeline. Ownership of the agent stays with the caller, so
 * the same instance can be shared across components, persisted between routes,
 * or driven imperatively from outside React.
 */
export function useAgent(agent: AbstractAgent, options: UseAgentOptions = {}): UseAgentResult {
  const { includeReasoning = true, includeSystem = false, tools, context, forwardedProps } = options

  const store = useMemo(() => createAgentStore(agent), [agent])
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)

  const timeline = useMemo(
    () =>
      projectTimeline(snapshot.messages, snapshot.overlay, {
        includeReasoning,
        includeSystem,
        interrupts: snapshot.interrupts,
      }),
    [snapshot, includeReasoning, includeSystem],
  )

  const runParameters = useMemo<RunAgentParameters>(
    () => ({
      ...(tools ? { tools: [...tools] } : {}),
      ...(context ? { context: [...context] } : {}),
      ...(forwardedProps ? { forwardedProps } : {}),
    }),
    [tools, context, forwardedProps],
  )

  const run = useCallback(
    async (parameters?: RunAgentParameters) => {
      await agent.runAgent({ ...runParameters, ...parameters })
    },
    [agent, runParameters],
  )

  const send = useCallback(
    async (text: string) => {
      const content = text.trim()
      if (content === '') return
      agent.addMessage({ id: randomUUID(), role: 'user', content })
      await agent.runAgent(runParameters)
    },
    [agent, runParameters],
  )

  const stop = useCallback(() => {
    agent.abortRun()
  }, [agent])

  const resolveInterrupt = useCallback(
    async (interruptId: string, response: InterruptResponse) => {
      const resume = buildResumeArray([...agent.pendingInterrupts], { [interruptId]: response })
      await agent.runAgent({ ...runParameters, resume })
    },
    [agent, runParameters],
  )

  const setState = useCallback(
    (next: State) => {
      agent.setState(next)
    },
    [agent],
  )

  return {
    agent,
    timeline,
    messages: snapshot.messages,
    state: snapshot.state,
    phase: snapshot.overlay.phase,
    isRunning: snapshot.isRunning,
    steps: snapshot.overlay.steps,
    interrupts: snapshot.interrupts,
    error: snapshot.overlay.error,
    send,
    run,
    stop,
    resolveInterrupt,
    setState,
  }
}
