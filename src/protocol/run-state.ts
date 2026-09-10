import { EventType } from '@ag-ui/core'
import type { AGUIEvent, BaseEvent } from '@ag-ui/core'

import type { RunOverlay, StepRecord, SubagentRecord } from './timeline.types'

/**
 * The run overlay reducer.
 *
 * It answers only the questions the transcript cannot: is a run in flight,
 * which message or tool call is still open, which step is executing, and how
 * did the run end. Message content is deliberately absent — `AbstractAgent`
 * already owns that, and keeping a second copy here would be a second state
 * machine to keep in sync with the SDK's.
 */

export function createRunOverlay(): RunOverlay {
  return {
    phase: 'idle',
    steps: [],
    subagents: [],
    streamingMessageIds: new Set(),
    streamingToolCallIds: new Set(),
  }
}

function withAdded(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (set.has(id)) return set
  const next = new Set(set)
  next.add(id)
  return next
}

function withRemoved(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!set.has(id)) return set
  const next = new Set(set)
  next.delete(id)
  return next
}

function markStep(
  steps: readonly StepRecord[],
  name: string,
  status: StepRecord['status'],
): readonly StepRecord[] {
  const index = steps.findIndex((step) => step.name === name && step.status === 'running')
  if (index === -1) return status === 'running' ? [...steps, { name, status }] : steps
  const next = steps.slice()
  next[index] = { name, status }
  return next
}

function markSubagent(
  subagents: readonly SubagentRecord[],
  runId: string,
  patch: Partial<SubagentRecord>,
): readonly SubagentRecord[] {
  const index = subagents.findIndex((subagent) => subagent.runId === runId)
  if (index === -1) return [...subagents, { runId, status: 'running', ...patch }]
  const next = subagents.slice()
  next[index] = { ...next[index]!, ...patch }
  return next
}

/**
 * Fold one AG-UI event into the overlay.
 *
 * Returns the same object reference when the event changes nothing, so a React
 * binding can skip the render. Unknown and unhandled event types are inert by
 * design: the protocol adds events faster than any UI package can adopt them,
 * and an unrecognised event must never break a run in progress.
 */
export function reduceRunOverlay(overlay: RunOverlay, rawEvent: BaseEvent): RunOverlay {
  const event = rawEvent as AGUIEvent

  switch (event.type) {
    case EventType.RUN_STARTED:
      return {
        ...overlay,
        phase: 'running',
        runId: event.runId,
        threadId: event.threadId,
        steps: [],
        subagents: [],
        streamingMessageIds: new Set(),
        streamingToolCallIds: new Set(),
        error: undefined,
      }

    case EventType.RUN_FINISHED:
      return {
        ...overlay,
        phase: 'idle',
        streamingMessageIds: new Set(),
        streamingToolCallIds: new Set(),
      }

    case EventType.RUN_ERROR:
      return {
        ...overlay,
        phase: 'error',
        streamingMessageIds: new Set(),
        streamingToolCallIds: new Set(),
        error: { message: event.message, code: event.code },
      }

    case EventType.STEP_STARTED:
      return { ...overlay, steps: markStep(overlay.steps, event.stepName, 'running') }

    case EventType.STEP_FINISHED:
      return { ...overlay, steps: markStep(overlay.steps, event.stepName, 'finished') }

    case EventType.SUBAGENT_STARTED:
      return {
        ...overlay,
        subagents: markSubagent(overlay.subagents, event.subagentRunId, {
          name: event.name,
          status: 'running',
        }),
      }

    case EventType.SUBAGENT_FINISHED:
      return {
        ...overlay,
        subagents: markSubagent(overlay.subagents, event.subagentRunId, { status: 'finished' }),
      }

    case EventType.SUBAGENT_ERROR:
      return {
        ...overlay,
        subagents: markSubagent(overlay.subagents, event.subagentRunId, { status: 'error' }),
      }

    case EventType.TEXT_MESSAGE_START:
    case EventType.REASONING_MESSAGE_START:
      return {
        ...overlay,
        streamingMessageIds: withAdded(overlay.streamingMessageIds, event.messageId),
      }

    case EventType.TEXT_MESSAGE_END:
    case EventType.REASONING_MESSAGE_END:
      return {
        ...overlay,
        streamingMessageIds: withRemoved(overlay.streamingMessageIds, event.messageId),
      }

    // `@ag-ui/client` normally expands chunk events into start/content/end
    // before a subscriber sees them. They are handled anyway so the reducer
    // stays correct when it is driven from a raw event stream.
    case EventType.TEXT_MESSAGE_CHUNK:
    case EventType.REASONING_MESSAGE_CHUNK:
      return event.messageId
        ? { ...overlay, streamingMessageIds: withAdded(overlay.streamingMessageIds, event.messageId) }
        : overlay

    case EventType.TOOL_CALL_START:
      return {
        ...overlay,
        streamingToolCallIds: withAdded(overlay.streamingToolCallIds, event.toolCallId),
      }

    case EventType.TOOL_CALL_END:
      return {
        ...overlay,
        streamingToolCallIds: withRemoved(overlay.streamingToolCallIds, event.toolCallId),
      }

    case EventType.TOOL_CALL_CHUNK:
      return event.toolCallId
        ? {
            ...overlay,
            streamingToolCallIds: withAdded(overlay.streamingToolCallIds, event.toolCallId),
          }
        : overlay

    default:
      return overlay
  }
}
