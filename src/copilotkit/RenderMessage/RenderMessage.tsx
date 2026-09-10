import type { RenderMessageProps as SlotProps } from '@copilotkit/react-ui'
import { RenderTextMessage } from '../RenderTextMessage'
import { RenderResultMessage } from '../RenderResultMessage'
import { RenderAgentStateMessage } from '../RenderAgentStateMessage'
import { ReasoningDisclosure } from '../../components/ReasoningDisclosure'

export type RenderMessageProps = SlotProps
/** Unified renderer used by current CopilotKit v1 releases. */
export function RenderMessage(props: RenderMessageProps) {
  const { message, inProgress, isCurrentMessage } = props
  switch (message.role) {
    case 'user': case 'assistant': return <RenderTextMessage {...props} />
    case 'tool': return <RenderResultMessage {...props} />
    case 'activity': return <RenderAgentStateMessage {...props} />
    case 'reasoning': return <ReasoningDisclosure node={{
      kind: 'reasoning', id: message.id, content: message.content ?? '',
      encrypted: !message.content && Boolean(message.encryptedValue),
      streaming: inProgress && isCurrentMessage,
    }} />
    default: return null
  }
}
