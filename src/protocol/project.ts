import type { Message, ToolCall } from '@ag-ui/core'

import { parsePartialJson } from './partial-json'
import type {
  ProjectTimelineOptions,
  RunOverlay,
  TimelineNode,
  ToolCallNode,
  ToolCallStatus,
} from './timeline.types'

/**
 * Project an AG-UI transcript and run overlay into the render model.
 *
 * Two joins happen here, and they are the whole reason this module exists:
 *
 * 1. A tool call is issued on an assistant message and answered by a separate
 *    `tool` message that can be any distance further down the transcript. The
 *    UI has to draw them as one thing, so results are merged back onto the call
 *    rather than rendered where they appear.
 * 2. The transcript has no notion of "still arriving". The overlay supplies it,
 *    which is what lets a caret blink on the streaming message and a tool card
 *    fill in as its arguments parse.
 */

function asRecord(content: unknown): Record<string, unknown> {
  return typeof content === 'object' && content !== null && !Array.isArray(content)
    ? (content as Record<string, unknown>)
    : {}
}

function asText(content: unknown): string {
  if (typeof content === 'string') return content
  if (content === undefined || content === null) return ''
  try {
    return JSON.stringify(content)
  } catch {
    return String(content)
  }
}

interface ToolAnswer {
  content: string
  error?: string
}

function indexToolAnswers(messages: readonly Message[]): Map<string, ToolAnswer> {
  const answers = new Map<string, ToolAnswer>()
  for (const message of messages) {
    if (message.role !== 'tool') continue
    answers.set(message.toolCallId, {
      content: asText(message.content),
      error: message.error,
    })
  }
  return answers
}

function toolCallStatus(
  toolCallId: string,
  answer: ToolAnswer | undefined,
  overlay: RunOverlay,
): ToolCallStatus {
  if (answer) return answer.error === undefined ? 'complete' : 'error'
  return overlay.streamingToolCallIds.has(toolCallId) ? 'streaming' : 'awaiting-result'
}

function projectToolCall(
  toolCall: ToolCall,
  messageId: string,
  overlay: RunOverlay,
  answers: Map<string, ToolAnswer>,
  subagentRunId: string | undefined,
): ToolCallNode {
  const rawArgs = toolCall.function.arguments ?? ''
  const parsed = parsePartialJson(rawArgs)
  const answer = answers.get(toolCall.id)

  return {
    kind: 'tool-call',
    id: toolCall.id,
    messageId,
    name: toolCall.function.name,
    rawArgs,
    args: parsed.value,
    argsComplete: parsed.complete,
    status: toolCallStatus(toolCall.id, answer, overlay),
    result: answer?.content,
    error: answer?.error,
    subagentRunId,
  }
}

export function projectTimeline(
  messages: readonly Message[],
  overlay: RunOverlay,
  options: ProjectTimelineOptions = {},
): TimelineNode[] {
  const { includeSystem = false, includeReasoning = true, interrupts = [] } = options
  const answers = indexToolAnswers(messages)
  const answeredCallIds = new Set<string>()
  const nodes: TimelineNode[] = []

  for (const message of messages) {
    const subagentRunId = message.subagentRunId

    switch (message.role) {
      case 'system':
      case 'developer': {
        // Prompt plumbing, not conversation. Opt in when building a debugger.
        if (!includeSystem) break
        nodes.push({ kind: 'user', id: message.id, content: asText(message.content), name: message.role })
        break
      }

      case 'user': {
        nodes.push({
          kind: 'user',
          id: message.id,
          content: asText(message.content),
          name: message.name,
        })
        break
      }

      case 'reasoning': {
        if (!includeReasoning) break
        const content = asText(message.content)
        nodes.push({
          kind: 'reasoning',
          id: message.id,
          content,
          streaming: overlay.streamingMessageIds.has(message.id),
          encrypted: content === '' && Boolean(message.encryptedValue),
          subagentRunId,
        })
        break
      }

      case 'activity': {
        nodes.push({
          kind: 'activity',
          id: message.id,
          activityType: message.activityType,
          content: asRecord(message.content),
          subagentRunId,
        })
        break
      }

      case 'assistant': {
        const content = asText(message.content)
        if (content !== '') {
          nodes.push({
            kind: 'assistant-text',
            id: message.id,
            content,
            streaming: overlay.streamingMessageIds.has(message.id),
            subagentRunId,
          })
        }
        for (const toolCall of message.toolCalls ?? []) {
          answeredCallIds.add(toolCall.id)
          nodes.push(projectToolCall(toolCall, message.id, overlay, answers, subagentRunId))
        }
        break
      }

      case 'tool': {
        // Answered in the assistant pass above. A `tool` message whose call is
        // absent — a snapshot that dropped the issuing message — would
        // otherwise vanish, so it is emitted with an empty `name`; renderers
        // fall back to the id.
        if (answeredCallIds.has(message.toolCallId)) break
        const answer = answers.get(message.toolCallId)
        nodes.push({
          kind: 'tool-call',
          id: message.toolCallId,
          messageId: message.id,
          name: '',
          rawArgs: '',
          args: undefined,
          argsComplete: false,
          status: message.error === undefined ? 'complete' : 'error',
          result: answer?.content,
          error: answer?.error,
          subagentRunId,
        })
        break
      }
    }
  }

  for (const interrupt of interrupts) {
    nodes.push({
      kind: 'interrupt',
      id: interrupt.id,
      reason: interrupt.reason,
      message: interrupt.message,
      toolCallId: interrupt.toolCallId,
      responseSchema: interrupt.responseSchema,
      expiresAt: interrupt.expiresAt,
    })
  }

  if (overlay.error) {
    nodes.push({
      kind: 'error',
      id: `${overlay.runId ?? 'run'}:error`,
      message: overlay.error.message,
      code: overlay.error.code,
    })
  }

  return nodes
}
