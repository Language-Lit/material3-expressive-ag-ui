import { useEffect, useMemo, useRef } from 'react'
import { useChatContext, type MessagesProps as SlotProps } from '@copilotkit/react-ui'
import { useCopilotChatInternal } from '@copilotkit/react-core'
import { Text } from '@language-lit/material3-expressive'

export type MessagesProps = SlotProps
export function Messages(props: MessagesProps) {
  const { labels } = useChatContext()
  const { interrupt } = useCopilotChatInternal()
  const { messages: transcript, inProgress, children, chatError, ErrorMessage } = props
  const initial = useMemo(() => (Array.isArray(labels.initial) ? labels.initial : labels.initial ? [labels.initial] : [])
    .map((content, index) => ({ id: 'm3e-initial-' + index, role: 'assistant' as const, content })), [labels.initial])
  const messages = useMemo<MessagesProps['messages']>(() => [...initial, ...transcript], [initial, transcript])
  const scroll = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  useEffect(() => {
    if (scroll.current && pinned.current) scroll.current.scrollTop = scroll.current.scrollHeight
  }, [messages, interrupt, children])
  return (
    <div className="m3e-agui-ck-messages">
      <div className="m3e-agui-thread" ref={scroll} aria-label="Conversation" onScroll={() => {
        const el = scroll.current
        if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 32
      }}>
        {messages.map((message, index) => {
          const Renderer = message.role === 'assistant' && message.toolCalls?.length
            ? props.RenderActionExecutionMessage ?? props.RenderMessage
            : message.role === 'tool' ? props.RenderResultMessage ?? props.RenderMessage
              : message.role === 'activity' ? props.RenderAgentStateMessage ?? props.RenderMessage
                : message.role === 'assistant' || message.role === 'user'
                  ? props.RenderTextMessage ?? props.RenderMessage : props.RenderMessage
          return <Renderer key={message.id} {...props} message={message} messages={messages}
            index={index} isCurrentMessage={index === messages.length - 1}
            onRegenerate={index < initial.length ? undefined : props.onRegenerate}
            onThumbsUp={index < initial.length ? undefined : props.onThumbsUp}
            onThumbsDown={index < initial.length ? undefined : props.onThumbsDown} />
        })}
        {interrupt}
        {chatError ? ErrorMessage ? <ErrorMessage error={chatError} isCurrentMessage />
          : <Text as="p" variant="bodyMedium" className="m3e-agui-thread__error">{chatError.message}</Text> : null}
        {children}
      </div>
      <div role="status" className="m3e-agui-run-status">
        <Text as="span" variant="labelMedium">{chatError ? 'Run failed: ' + chatError.message : interrupt ? 'Response required' : inProgress ? 'Working' : ''}</Text>
      </div>
    </div>
  )
}
