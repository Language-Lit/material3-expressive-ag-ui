import type { RenderMessageProps } from '@copilotkit/react-ui'
import { ToolCallCard } from '../../components/ToolCallCard'

export type RenderResultMessageProps = RenderMessageProps
export function RenderResultMessage({ message, messages, index }: RenderResultMessageProps) {
  if (message.role !== 'tool') return null
  if (messages.some((item) => item.role === 'assistant' && item.toolCalls?.some((call) => call.id === message.toolCallId))) return null
  if (messages.some((item, i) => i > index && item.role === 'tool' && item.toolCallId === message.toolCallId)) return null
  return <ToolCallCard node={{
    kind: 'tool-call', id: message.toolCallId, messageId: message.id,
    name: '', rawArgs: '', args: undefined, argsComplete: true,
    status: message.error ? 'error' : 'complete', result: message.content, error: message.error,
  }} />
}
