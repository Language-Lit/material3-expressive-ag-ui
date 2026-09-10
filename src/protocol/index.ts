/**
 * `@language-lit/material3-expressive-ag-ui/protocol`
 *
 * The React-free half of the package: AG-UI's transcript and event stream
 * projected into a render model. It imports no React and touches no DOM, so it
 * is safe in server code, in tests, and in non-React hosts that want the same
 * reading of the protocol.
 */
export { parsePartialJson } from './partial-json'
export type { PartialJsonResult } from './partial-json'

export { createRunOverlay, reduceRunOverlay } from './run-state'

export { projectTimeline } from './project'

export type {
  ActivityNode,
  AssistantTextNode,
  ErrorNode,
  InterruptLike,
  InterruptNode,
  ProjectTimelineOptions,
  ReasoningNode,
  RunOverlay,
  RunPhase,
  StepRecord,
  SubagentRecord,
  TimelineNode,
  ToolCallNode,
  ToolCallStatus,
  UserNode,
} from './timeline.types'
