/**
 * The render model.
 *
 * AG-UI gives a consumer two things: a transcript (`agent.messages`, seven
 * discriminated roles) and an event stream. Neither is directly renderable.
 * The transcript carries a tool call on the assistant message that produced it
 * and its result on a separate `tool` message that may arrive many entries
 * later; it says nothing about what is still streaming. The event stream knows
 * what is streaming but is not a transcript.
 *
 * A `TimelineNode` is the join of the two: one ordered list where every entry
 * is directly renderable by one component, tool results are already merged
 * back onto their call, and anything mid-flight is flagged as such.
 */

/** Lifecycle of a single tool call, derived from the transcript and the run. */
export type ToolCallStatus =
  /** `TOOL_CALL_START` seen, `TOOL_CALL_END` not yet — `args` may be partial. */
  | 'streaming'
  /** Arguments are complete; no `tool` message has arrived to answer it. */
  | 'awaiting-result'
  /** A `tool` message answered it. */
  | 'complete'
  /** A `tool` message answered it with `error` set. */
  | 'error'

export interface UserNode {
  kind: 'user'
  id: string
  content: string
  /** Participant name, when the backend distinguishes several users. */
  name?: string
}

export interface AssistantTextNode {
  kind: 'assistant-text'
  id: string
  content: string
  /** `TEXT_MESSAGE_START` seen without its matching `TEXT_MESSAGE_END`. */
  streaming: boolean
  /** Present when the text came from a subagent rather than the root agent. */
  subagentRunId?: string
}

export interface ReasoningNode {
  kind: 'reasoning'
  id: string
  content: string
  streaming: boolean
  /**
   * The provider returned the reasoning as an opaque encrypted blob, so there
   * is nothing to display. The node is kept so the UI can still show that the
   * agent reasoned.
   */
  encrypted: boolean
  subagentRunId?: string
}

export interface ActivityNode {
  kind: 'activity'
  id: string
  /** Backend-defined discriminator, e.g. `"search"`, `"file_edit"`. */
  activityType: string
  /**
   * The activity payload, kept as the structured record the protocol carries.
   * Its shape is defined by the backend, so this package cannot flatten it to
   * a sentence without losing what a custom renderer would need.
   */
  content: Record<string, unknown>
  subagentRunId?: string
}

export interface ToolCallNode {
  kind: 'tool-call'
  /** The `toolCallId` — stable across the call and its result. */
  id: string
  /** Id of the assistant message that issued the call. */
  messageId: string
  name: string
  /** Raw argument text exactly as streamed, including a truncated tail. */
  rawArgs: string
  /**
   * `rawArgs` parsed. While streaming this is the best-effort reading of a
   * truncated document, so a generative-UI renderer can paint before the call
   * closes. `undefined` when nothing parseable has arrived yet.
   */
  args: Record<string, unknown> | undefined
  /** `false` while `args` is a reading of a truncated document. */
  argsComplete: boolean
  status: ToolCallStatus
  /** Result payload from the answering `tool` message. */
  result?: string
  /** Error text from the answering `tool` message. */
  error?: string
  subagentRunId?: string
}

export interface InterruptNode {
  kind: 'interrupt'
  id: string
  /** Machine-readable cause, defined by the backend. */
  reason: string
  /** Human-readable prompt, when the backend supplied one. */
  message?: string
  /** Set when the interrupt is asking to approve a specific tool call. */
  toolCallId?: string
  /** JSON Schema the resume value must satisfy, when supplied. */
  responseSchema?: Record<string, unknown>
  expiresAt?: string
}

export interface ErrorNode {
  kind: 'error'
  id: string
  message: string
  code?: string
}

export type TimelineNode =
  | UserNode
  | AssistantTextNode
  | ReasoningNode
  | ActivityNode
  | ToolCallNode
  | InterruptNode
  | ErrorNode

/** Whether the agent is between runs, inside one, or stopped by an error. */
export type RunPhase = 'idle' | 'running' | 'error'

export interface StepRecord {
  name: string
  status: 'running' | 'finished'
}

export interface SubagentRecord {
  runId: string
  name?: string
  status: 'running' | 'finished' | 'error'
}

/**
 * Run facts the transcript does not record.
 *
 * `AbstractAgent` already owns `messages` and `state`, and re-deriving them
 * here would mean maintaining a second copy of the SDK's state machine that
 * could drift from it. This overlay deliberately holds only what the transcript
 * cannot express: what is mid-stream, where the run is, and how it ended.
 */
export interface RunOverlay {
  phase: RunPhase
  runId?: string
  threadId?: string
  steps: readonly StepRecord[]
  subagents: readonly SubagentRecord[]
  /** Message ids between a `*_MESSAGE_START` and its `*_MESSAGE_END`. */
  streamingMessageIds: ReadonlySet<string>
  /** Tool call ids between `TOOL_CALL_START` and `TOOL_CALL_END`. */
  streamingToolCallIds: ReadonlySet<string>
  error?: { message: string; code?: string }
}

export interface ProjectTimelineOptions {
  /** Include `system` and `developer` messages. Off by default: they are
   *  prompt plumbing, not conversation. */
  includeSystem?: boolean
  /** Drop reasoning nodes, for products that do not surface thinking. */
  includeReasoning?: boolean
  /** Unresolved interrupts, normally `agent.pendingInterrupts`. */
  interrupts?: readonly InterruptLike[]
}

/** Structural shape of `@ag-ui/core`'s `Interrupt`, restated so `./protocol`
 *  can be consumed without the SDK's types in scope. */
export interface InterruptLike {
  id: string
  reason: string
  message?: string
  toolCallId?: string
  responseSchema?: Record<string, unknown>
  expiresAt?: string
}
