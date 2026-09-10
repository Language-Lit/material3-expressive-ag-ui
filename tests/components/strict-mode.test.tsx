import type { RunAgentInput } from '@ag-ui/core'
import { Material3Provider } from '@language-lit/material3-expressive'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { describe, expect, it } from 'vitest'

import { ScriptedAgent, script } from '../../fixtures/scripted-agent'
import { AgentChat } from '../../src/components/AgentChat'
import { AgentProvider } from '../../src/runtime/agent-context'

function reply(input: RunAgentInput) {
  return [
    script.runStarted(input),
    ...script.reasoning('r1', 'Thinking it over carefully before answering.'),
    ...script.text('a1', 'Here is the answer.'),
    script.runFinished(input),
  ]
}

describe('under StrictMode', () => {
  it('still delivers a paced run', async () => {
    const user = userEvent.setup()
    const agent = new ScriptedAgent({ script: reply, pace: 8 })
    render(
      <StrictMode>
        <Material3Provider>
          <AgentProvider agent={agent}>
            <AgentChat />
          </AgentProvider>
        </Material3Provider>
      </StrictMode>,
    )

    await user.type(screen.getByLabelText('Message'), 'go')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => expect(screen.getByText('Here is the answer.')).toBeDefined(), {
      timeout: 4000,
    })
    expect(screen.getByRole('button', { name: /Thought process/ })).toBeDefined()
  })
})
