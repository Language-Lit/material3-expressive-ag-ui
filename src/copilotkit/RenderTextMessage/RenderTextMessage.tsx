import type { RenderMessageProps } from '@copilotkit/react-ui'
import { AssistantMessage as DefaultAssistant } from '../AssistantMessage'
import { UserMessage as DefaultUser } from '../UserMessage'
import { Text } from '@language-lit/material3-expressive'

export type RenderTextMessageProps = RenderMessageProps
function MissingImage() { return <Text as="p" variant="bodySmall">Image attachment</Text> }
export function RenderTextMessage({
  message, messages, inProgress, isCurrentMessage,
  AssistantMessage = DefaultAssistant, UserMessage = DefaultUser,
  ImageRenderer = MissingImage, onRegenerate, onCopy, onThumbsUp, onThumbsDown,
  messageFeedback, markdownTagRenderers,
}: RenderTextMessageProps) {
  if (message.role === 'user') return <UserMessage message={message} rawData={message} ImageRenderer={ImageRenderer} />
  if (message.role !== 'assistant') return null
  return <AssistantMessage
    message={message} messages={messages} rawData={message}
    isLoading={inProgress && isCurrentMessage && !message.content}
    isGenerating={inProgress && isCurrentMessage && Boolean(message.content)}
    isCurrentMessage={isCurrentMessage}
    onRegenerate={onRegenerate ? () => onRegenerate(message.id) : undefined}
    onCopy={onCopy} onThumbsUp={onThumbsUp} onThumbsDown={onThumbsDown}
    feedback={messageFeedback?.[message.id]} markdownTagRenderers={markdownTagRenderers}
    ImageRenderer={ImageRenderer}
  />
}
