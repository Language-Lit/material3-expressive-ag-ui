import type { AssistantMessageProps, RenderMessageProps } from '@copilotkit/react-ui'
import { parsePartialJson } from '../../protocol/partial-json'
import type { ToolCallNode } from '../../protocol/timeline.types'

export function toolNodes(
  message: NonNullable<AssistantMessageProps['message']>,
  messages: RenderMessageProps['messages'],
  streaming: boolean,
): ToolCallNode[] {
  return (message.toolCalls ?? []).map((call) => {
    const result = [...messages].reverse().find((item) => item.role === 'tool' && item.toolCallId === call.id)
    const rawArgs = call.function.arguments
    const parsed = parsePartialJson(rawArgs)
    return {
      kind: 'tool-call', id: call.id, messageId: message.id, name: call.function.name,
      rawArgs, args: parsed.value, argsComplete: parsed.complete,
      status: result?.role === 'tool' ? (result.error ? 'error' : 'complete')
        : streaming && !parsed.complete ? 'streaming' : 'awaiting-result',
      result: result?.role === 'tool' ? result.content : undefined,
      error: result?.role === 'tool' ? result.error : undefined,
    }
  })
}
