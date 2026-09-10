import type { AssistantMessageProps as SlotProps } from '@copilotkit/react-ui'
import { Button, Text } from '@language-lit/material3-expressive'
import { useState } from 'react'
import { AssistantMessage as Message } from '../../components/AssistantMessage'
import { ToolCallCard } from '../../components/ToolCallCard'
import { toolNodes } from '../internal/messages'

export type AssistantMessageProps = SlotProps

/** CopilotKit owns message content, generative UI and all action callbacks. */
export function AssistantMessage(props: AssistantMessageProps) {
  const { message, isLoading, isGenerating, onCopy, onRegenerate, onThumbsUp, onThumbsDown, feedback } = props
  const [copyError, setCopyError] = useState('')
  const content = message?.content ?? ''
  const custom = message?.generativeUI?.() ?? props.subComponent
  const before = message?.generativeUIPosition === 'before'
  const tools = message && !custom ? toolNodes(message, props.messages ?? [], isLoading || isGenerating) : []
  async function copy() {
    try {
      await navigator.clipboard.writeText(content)
      setCopyError('')
      onCopy?.(content)
    } catch { setCopyError('Could not copy. Select the text to copy it manually.') }
  }
  return (
    <div className="m3e-agui-ck-assistant">
      {before ? custom : null}
      {content ? <Message node={{ kind: 'assistant-text', id: message?.id ?? 'assistant', content, streaming: isGenerating }} /> : null}
      {tools.map((node) => <ToolCallCard key={node.id} node={node} />)}
      {!before ? custom : null}
      {content && !isLoading && !isGenerating ? (
        <div className="m3e-agui-ck-assistant__actions">
          {onRegenerate ? <Button variant="text" onClick={onRegenerate}>Regenerate response</Button> : null}
          <Button variant="text" onClick={() => void copy()}>Copy</Button>
          {onThumbsUp && message ? <Button variant="text" aria-pressed={feedback === 'thumbsUp'} onClick={() => onThumbsUp(message, feedback !== 'thumbsUp')}>Helpful</Button> : null}
          {onThumbsDown && message ? <Button variant="text" aria-pressed={feedback === 'thumbsDown'} onClick={() => onThumbsDown(message, feedback !== 'thumbsDown')}>Not helpful</Button> : null}
        </div>
      ) : null}
      {copyError ? <Text as="p" variant="bodySmall">{copyError}</Text> : null}
    </div>
  )
}
