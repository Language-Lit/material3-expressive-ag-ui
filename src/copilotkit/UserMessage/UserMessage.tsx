import type { UserMessageProps as SlotProps } from '@copilotkit/react-ui'
import { UserMessage as Message } from '../../components/UserMessage'
import { Text } from '@language-lit/material3-expressive'

export type UserMessageProps = SlotProps
export function UserMessage({ message, ImageRenderer }: UserMessageProps) {
  if (!message) return null
  const content = typeof message.content === 'string' ? message.content
    : message.content.filter((part) => part.type === 'text').map((part) => part.text).join('\n')
  return (
    <div className="m3e-agui-ck-user">
      {content ? <Message node={{ kind: 'user', id: message.id, content }} /> : null}
      {typeof message.content !== 'string' ? message.content.map((part, index) =>
        part.type === 'image' ? <ImageRenderer key={index} source={part.source} />
          : part.type !== 'text' ? <Text as="p" variant="bodySmall" key={index}>{part.type} attachment</Text> : null,
      ) : null}
    </div>
  )
}
