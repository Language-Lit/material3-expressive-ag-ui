import type { RunAgentInput } from '@ag-ui/core'
import { Material3Provider } from '@language-lit/material3-expressive'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import { ScriptedAgent, script } from '../../fixtures/scripted-agent'
import { AgentChat } from '../../src/components/AgentChat'
import { MessageThread } from '../../src/components/MessageThread'
import { AgentProvider } from '../../src/runtime/agent-context'
import type { ToolRendererRegistry } from '../../src/runtime/agent-context'

function reply(input: RunAgentInput) {
  return [
    script.runStarted(input),
    ...script.reasoning('r1', 'The shape tokens live in the token reference.'),
    ...script.text('a1', 'Let me look that up.'),
    ...script.toolCall('c1', 'search_docs', { query: 'shape tokens' }, 'a1'),
    script.toolResult('t1', 'c1', '9 matches in tokens.md'),
    ...script.text('a2', 'Found 9 matches.'),
    script.runFinished(input),
  ]
}

function mount(ui: ReactNode, agent: ScriptedAgent, toolRenderers?: ToolRendererRegistry) {
  return render(
    <Material3Provider>
      <AgentProvider agent={agent} toolRenderers={toolRenderers}>
        {ui}
      </AgentProvider>
    </Material3Provider>,
  )
}

describe('AgentChat', () => {
  it('sends a message and renders the whole run', async () => {
    const user = userEvent.setup()
    mount(<AgentChat />, new ScriptedAgent({ script: reply }))

    await user.type(screen.getByLabelText('Message'), 'Where are the shape tokens?')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    // The person's turn is in the transcript immediately.
    expect(await screen.findByText('Where are the shape tokens?')).toBeDefined()

    // Both assistant turns stream in and the tool call is named.
    await waitFor(() => expect(screen.getByText('Found 9 matches.')).toBeDefined())
    expect(screen.getByText('Let me look that up.')).toBeDefined()
    expect(screen.getByText('search_docs')).toBeDefined()

    // Reasoning is present but collapsed behind its own control.
    const thinking = screen.getByRole('button', { name: /Thought process/ })
    expect(thinking.getAttribute('aria-expanded')).toBe('false')
    await user.click(thinking)
    expect(screen.getByText(/The shape tokens live in the token reference\./)).toBeDefined()
  })

  it('merges the tool result onto its call and reports success', async () => {
    const user = userEvent.setup()
    mount(<AgentChat />, new ScriptedAgent({ script: reply }))

    await user.type(screen.getByLabelText('Message'), 'go')
    await user.click(screen.getByRole('button', { name: 'Send message' }))
    await waitFor(() => expect(screen.getByText('Found 9 matches.')).toBeDefined())

    expect(screen.getByRole('img', { name: 'Done: search_docs' })).toBeDefined()

    await user.click(screen.getByRole('button', { name: /search_docs/ }))
    expect(screen.getByText('9 matches in tokens.md')).toBeDefined()
    expect(screen.getByText(/"query": "shape tokens"/)).toBeDefined()
  })

  it('clears the composer on send and disables sending an empty message', async () => {
    const user = userEvent.setup()
    mount(<AgentChat />, new ScriptedAgent({ script: reply }))

    const field = screen.getByLabelText('Message') as HTMLTextAreaElement
    expect(screen.getByRole('button', { name: 'Send message' }).hasAttribute('disabled')).toBe(true)

    await user.type(field, 'hello')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    expect(field.value).toBe('')
    await waitFor(() => expect(screen.getByText('Found 9 matches.')).toBeDefined())
  })

  it('sends on Enter and inserts a newline on Shift+Enter', async () => {
    const user = userEvent.setup()
    mount(<AgentChat />, new ScriptedAgent({ script: reply }))

    const field = screen.getByLabelText('Message') as HTMLTextAreaElement
    await user.type(field, 'first{Shift>}{Enter}{/Shift}second')
    expect(field.value).toBe('first\nsecond')

    await user.type(field, '{Enter}')
    expect(field.value).toBe('')
    // Testing Library collapses whitespace when matching, so the newline the
    // assertion above proved is present reads as a space here.
    await waitFor(() => expect(screen.getByText('first second')).toBeDefined())
  })

  it('surfaces a run error in the transcript and in the status region', async () => {
    const user = userEvent.setup()
    const agent = new ScriptedAgent({
      script: (input) => [script.runStarted(input), script.runError('upstream refused', '502')],
    })
    mount(<AgentChat />, agent)

    await user.type(screen.getByLabelText('Message'), 'go')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => expect(screen.getByText('upstream refused')).toBeDefined())
    expect(screen.getByRole('status').textContent).toContain('Run failed')
  })

  it('names the running step in the status region', async () => {
    const user = userEvent.setup()
    const agent = new ScriptedAgent({
      script: (input) => [
        script.runStarted(input),
        script.stepStarted('Searching the index'),
        ...script.text('a1', 'done'),
        script.stepFinished('Searching the index'),
        script.runFinished(input),
      ],
      pace: 2,
    })
    mount(<AgentChat />, agent)

    await user.type(screen.getByLabelText('Message'), 'go')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('Searching the index'),
    )
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(''))
  })

  it('offers a stop control only while a run is in flight', async () => {
    const user = userEvent.setup()
    const agent = new ScriptedAgent({ script: reply, pace: 4 })
    mount(<AgentChat />, agent)

    expect(screen.queryByRole('button', { name: 'Stop generating' })).toBeNull()

    await user.type(screen.getByLabelText('Message'), 'go')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Stop generating' })).toBeDefined(),
    )
    await waitFor(
      () => expect(screen.queryByRole('button', { name: 'Stop generating' })).toBeNull(),
      { timeout: 3000 },
    )
  })

  it('hands a tool call to a registered renderer instead of the default card', async () => {
    const user = userEvent.setup()
    mount(<AgentChat />, new ScriptedAgent({ script: reply }), {
      search_docs: ({ node }) => (
        <p data-testid="custom">
          Searching for {String(node.args?.query ?? '…')} ({node.status})
        </p>
      ),
    })

    await user.type(screen.getByLabelText('Message'), 'go')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => expect(screen.getByTestId('custom')).toBeDefined())
    expect(screen.getByTestId('custom').textContent).toBe('Searching for shape tokens (complete)')
    expect(screen.queryByRole('button', { name: /search_docs/ })).toBeNull()
  })

  it('prompts on an interrupt and resumes the run when it is answered', async () => {
    const user = userEvent.setup()
    const resumed: unknown[] = []
    let turn = 0
    const agent = new ScriptedAgent({
      script: (input) => {
        resumed.push(input.resume)
        turn += 1
        return turn === 1
          ? [
              script.runStarted(input),
              ...script.text('a1', 'This will delete 3 files.'),
              script.runInterrupted(input, [
                { id: 'i1', reason: 'approval_required', message: 'Delete 3 files?' },
              ]),
            ]
          : [script.runStarted(input), ...script.text('a2', 'Deleted.'), script.runFinished(input)]
      },
    })
    mount(<AgentChat />, agent)

    await user.type(screen.getByLabelText('Message'), 'clean up')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('Delete 3 files?')).toBeDefined()

    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(screen.getByText('Deleted.')).toBeDefined())

    // The answer resumed the same run rather than starting a fresh one.
    expect(resumed[1]).toEqual([
      expect.objectContaining({ interruptId: 'i1', status: 'resolved' }),
    ])
    expect(screen.queryByText('Delete 3 files?')).toBeNull()
  })

  it('shows the empty state until the first turn', async () => {
    const user = userEvent.setup()
    mount(
      <MessageThread emptyState={<span>Ask the agent anything</span>} />,
      new ScriptedAgent({ script: reply }),
    )
    expect(screen.getByText('Ask the agent anything')).toBeDefined()
  })

  it('explains itself when used without a provider', () => {
    expect(() => render(<MessageThread />)).toThrowError(/AgentProvider/)
  })
})
