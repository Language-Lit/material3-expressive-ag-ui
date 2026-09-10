import { CopilotKit, useRenderToolCall } from '@copilotkit/react-core'
import { useInterrupt } from '@copilotkit/react-core/v2'
import { CopilotChat, CopilotPopup } from '@copilotkit/react-ui'
import { Button as M3Button, Material3Provider } from '@language-lit/material3-expressive'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ScriptedAgent, script } from '../../fixtures/scripted-agent'
import { copilotKitComponents, Input, type InputProps } from '../../src/copilotkit'
import type { ComponentProps, ReactNode } from 'react'

const slots = copilotKitComponents satisfies Partial<ComponentProps<typeof CopilotChat>>

function SearchRenderer() {
  useRenderToolCall({ name: 'search', parameters: [{ name: 'query', type: 'string' }],
    render: ({ status, result }) => <p>{status === 'complete' ? String(result) : 'Searching'}</p>,
  })
  return null
}

function InterruptHandler() {
  useInterrupt({ render: ({ resolve }) => <M3Button onClick={() => void resolve('approved')}>Approve operation</M3Button> })
  return null
}

function host(children: ReactNode, agent = new ScriptedAgent({ script: (input) => [script.runStarted(input), script.runFinished(input)] })) {
  return render(<Material3Provider><CopilotKit agents__unsafe_dev_only={{ default: agent }} showDevConsole={false}>{children}</CopilotKit></Material3Provider>)
}

describe('CopilotKit adapter', () => {
  it('retains the CopilotKit interrupt UI and resumes through its runtime', async () => {
    const resumes: unknown[] = []
    const agent = new ScriptedAgent({ script: (input) => {
      resumes.push(input.resume)
      return input.resume?.length
        ? [script.runStarted(input), ...script.text('done', 'Operation approved'), script.runFinished(input)]
        : [script.runStarted(input), script.runInterrupted(input, [{ id: 'approval', reason: 'approval_required' }])]
    } })
    host(<><InterruptHandler /><CopilotChat {...slots} suggestions={[]} /></>, agent)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Message'), 'go{Enter}')
    await user.click(await screen.findByRole('button', { name: 'Approve operation' }))
    expect(await screen.findByText('Operation approved')).toBeDefined()
    expect(resumes[1]).toEqual([expect.objectContaining({ interruptId: 'approval', status: 'resolved', payload: 'approved' })])
  })

  it('stops the real CopilotKit agent from the adapter input', async () => {
    const agent = new ScriptedAgent({ pace: 30, script: (input) => [
      script.runStarted(input), ...script.text('slow', 'A response that should not finish'), script.runFinished(input),
    ] })
    host(<CopilotChat {...slots} suggestions={[]} />, agent)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Message'), 'go{Enter}')
    await user.click(await screen.findByRole('button', { name: 'Stop generating' }))
    await waitFor(() => expect(agent.isRunning).toBe(false))
    expect(screen.queryByText('A response that should not finish')).toBeNull()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDefined()
  })

  it('keeps input text on send rejection and respects IME and Shift+Enter', async () => {
    const send = vi.fn().mockRejectedValue(new Error('Try again'))
    function TestInput(props: InputProps) { return <Input {...props} onSend={send} /> }
    host(<CopilotChat {...slots} Input={TestInput} suggestions={[]} />)
    const user = userEvent.setup()
    const field = screen.getByLabelText('Message') as HTMLTextAreaElement
    await user.type(field, 'one{Shift>}{Enter}{/Shift}two')
    fireEvent.keyDown(field, { key: 'Enter', isComposing: true })
    expect(send).not.toHaveBeenCalled()
    await user.type(field, '{Enter}')
    expect(await screen.findByText('Try again')).toBeDefined()
    expect(field.value).toBe('one\ntwo')
    expect(send).toHaveBeenCalledWith('one\ntwo')
  })

  it('opens and closes the Material dialog and honors its shortcut', async () => {
    // jsdom has no dialog top layer. Supply only native platform operations.
    const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
    const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event('close')) } })
    try {
      host(<CopilotPopup {...slots} suggestions={[]} labels={{ title: 'Material assistant' }} shortcut="j" />)
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Open chat' }))
      expect(await screen.findByRole('dialog', { name: 'Material assistant' })).toBeDefined()
      expect(screen.getByRole('heading', { name: 'Material assistant' })).toBeDefined()
      await user.click(screen.getByRole('dialog').querySelector('button[aria-label="Close chat"]')!)
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      fireEvent.keyDown(document, { key: 'j', ctrlKey: true })
      expect(await screen.findByRole('dialog')).toBeDefined()
    } finally {
      for (const [name, descriptor] of [['showModal', originalShow], ['close', originalClose]] as const) {
        if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
        else Reflect.deleteProperty(HTMLDialogElement.prototype, name)
      }
    }
  })
  it('sends and renders a real agent run through CopilotChat without AgentProvider', async () => {
    const agent = new ScriptedAgent({ script: (input) => [
      script.runStarted(input), ...script.text('a1', 'Looking it up.'),
      ...script.toolCall('c1', 'search', { query: 'tokens' }, 'a1'),
      script.toolResult('t1', 'c1', 'Found tokens'),
      ...script.text('a2', 'Finished searching.'), script.runFinished(input),
    ] })
    render(<Material3Provider>
      <CopilotKit agents__unsafe_dev_only={{ default: agent }} showDevConsole={false}>
        <SearchRenderer />
        <CopilotChat {...slots} suggestions={[]} labels={{ initial: 'Welcome' }} />
      </CopilotKit>
    </Material3Provider>)
    const user = userEvent.setup()
    expect(await screen.findByText('Welcome')).toBeDefined()
    await user.type(screen.getByLabelText('Message'), 'Find tokens{Enter}')
    expect(await screen.findByText('Finished searching.', {}, { timeout: 5000 })).toBeDefined()
    expect(screen.getByText('Found tokens')).toBeDefined()
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(''))
    expect(agent.messages.some((message) => message.role === 'user' && message.content === 'Find tokens')).toBe(true)
  })
})
