/**
 * `@language-lit/material3-expressive-ag-ui`
 *
 * Material 3 Expressive components for the AG-UI protocol. The React surface:
 * bind an agent with `AgentProvider`, render it with `AgentChat` or with the
 * individual parts.
 *
 * The protocol projection these components render is available on its own at
 * `@language-lit/material3-expressive-ag-ui/protocol`, with no React in scope.
 */
export * from './runtime'
export * from './components'

export type {
  ActivityNode,
  AssistantTextNode,
  ErrorNode,
  InterruptNode,
  ReasoningNode,
  RunOverlay,
  RunPhase,
  StepRecord,
  SubagentRecord,
  TimelineNode,
  ToolCallNode,
  ToolCallStatus,
  UserNode,
} from './protocol/timeline.types'
