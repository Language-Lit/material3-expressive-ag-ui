import { Material3Provider } from '@language-lit/material3-expressive'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ScriptedAgent, script } from '../../fixtures/scripted-agent'
import { AgentChat } from '../../src/components/AgentChat'
import { AgentProvider } from '../../src/runtime/agent-context'

function setup() {
  let resumes = 0
  const agent = new ScriptedAgent({ initialState: { files: 3 }, script: input => {
    if (input.resume?.length) { resumes++; return [script.runStarted(input), script.runFinished(input)] }
    return [script.runStarted(input), script.runInterrupted(input, [{ id: 'i1', reason: 'review', message: 'Review file cleanup' }])]
  } })
  render(<Material3Provider><AgentProvider agent={agent}><AgentChat /></AgentProvider></Material3Provider>)
  return { agent, resumes: () => resumes }
}

describe('default approval state guard', () => {
  it('shows changed state, blocks approval, then allows explicit review', async () => {
    const { agent, resumes } = setup()
    await act(async () => { await agent.runAgent() })
    await screen.findByRole('button', { name: 'Approve' })
    await act(async () => { agent.setState({ files: 4 }) })
    expect((screen.getByRole('button', { name: 'Approve' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/"files": 4/)).toBeDefined()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'I reviewed the updated state' }))
    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(resumes()).toBe(1))
  })

  it('blocks an update arriving between render and click; cancellation still works', async () => {
    const { agent, resumes } = setup()
    await act(async () => { await agent.runAgent() })
    const button = await screen.findByRole('button', { name: 'Approve' })
    await act(async () => {
      agent.setState({ files: 9 })
      fireEvent.click(button)
    })
    expect(resumes()).toBe(0)
    expect(screen.getByText(/The state changed\./)).toBeDefined()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(resumes()).toBe(1))
  })
})
