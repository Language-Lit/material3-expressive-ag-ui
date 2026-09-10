import { Material3Provider } from '@language-lit/material3-expressive'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { RenderMessageProps } from '@copilotkit/react-ui'
import { AssistantMessage, RenderActionExecutionMessage, RenderAgentStateMessage, RenderResultMessage, RenderTextMessage } from '../../src/copilotkit'

const base = { messages: [], inProgress: false, index: 0, isCurrentMessage: true } satisfies Omit<RenderMessageProps, 'message'>
describe('CopilotKit renderer slots', () => {
  it('renders text and activity without a native agent context', () => {
    render(<Material3Provider>
      <RenderTextMessage {...base} message={{ id: 'u', role: 'user', content: 'Hello' }} />
      <RenderAgentStateMessage {...base} message={{ id: 's', role: 'activity', activityType: 'progress', content: { step: 'Reading' } }} />
    </Material3Provider>)
    expect(screen.getByText('Hello')).toBeDefined()
    expect(screen.getByText('Reading').tagName).toBe('DD')
  })

  it('merges tool results and renders orphans through their legacy slots', async () => {
    const message: RenderMessageProps['message'] = { id: 'a', role: 'assistant', toolCalls: [{ id: 'call', type: 'function', function: { name: 'lookup', arguments: '{"q":"tokens"}' } }] }
    const result: RenderMessageProps['message'] = { id: 't', role: 'tool', toolCallId: 'call', content: 'Answer' }
    const messages = [result, message]
    render(<Material3Provider>
      <RenderActionExecutionMessage {...base} messages={messages} message={message} />
      <RenderResultMessage {...base} messages={messages} message={result} />
      <RenderResultMessage {...base} message={{ id: 'orphan', role: 'tool', toolCallId: 'gone', content: 'Orphan result' }} />
    </Material3Provider>)
    const user = userEvent.setup()
    expect(screen.getAllByRole('button', { name: 'lookup' })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'lookup' }))
    expect(screen.getByText('Answer')).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'gone' }))
    expect(screen.getByText('Orphan result')).toBeDefined()
  })

  it('preserves generative UI position and forwards feedback and regenerate callbacks', async () => {
    const thumbs = vi.fn()
    const regenerate = vi.fn()
    const message = { id: 'a', role: 'assistant' as const, content: 'Answer', generativeUIPosition: 'before' as const, generativeUI: () => <p>Custom card</p> }
    const { container } = render(<Material3Provider><AssistantMessage message={message} rawData={message}
      isLoading={false} isGenerating={false} feedback="thumbsUp" onThumbsUp={thumbs} onRegenerate={regenerate} />
    </Material3Provider>)
    expect(container.textContent!.indexOf('Custom card')).toBeLessThan(container.textContent!.indexOf('Answer'))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Helpful' }))
    expect(thumbs).toHaveBeenCalledWith(message, false)
    await user.click(screen.getByRole('button', { name: 'Regenerate response' }))
    expect(regenerate).toHaveBeenCalledOnce()
  })
})
