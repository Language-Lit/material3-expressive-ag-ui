import { Material3Provider } from '@language-lit/material3-expressive'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SharedStateDemo } from '../../playground/SharedStateDemo'

describe('versioned form in AgentChat', () => {
  it('preserves a typed draft through updates and a rejected approval, then saves after review', async () => {
    render(<Material3Provider><SharedStateDemo /></Material3Provider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Start review' }))
    const input = screen.getByLabelText('Your draft name') as HTMLInputElement
    await user.clear(input)
    await user.type(input, 'Human edited name')
    await user.click(screen.getByRole('button', { name: 'Publish incoming update' }))
    const approve = await screen.findByRole('button', { name: 'Approve draft' }) as HTMLButtonElement
    expect(input.value).toBe('Human edited name')
    expect(approve.disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Review latest and keep my draft' }))
    await user.click(screen.getByRole('button', { name: 'Simulate unseen server change' }))
    await user.click(approve)
    expect(await screen.findByText('The server proposal changed. Review it again; your draft is still here.')).toBeDefined()
    expect(input.value).toBe('Human edited name')
    expect((screen.getByRole('button', { name: 'Approve draft' }) as HTMLButtonElement).disabled).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Review latest and keep my draft' }))
    await user.click(screen.getByRole('button', { name: 'Approve draft' }))
    expect(await screen.findByText('Saved Human edited name.')).toBeDefined()
    expect(input.value).toBe('Human edited name')
  })

  it('replaces the draft only on explicit reset and supports cancellation', async () => {
    render(<Material3Provider><SharedStateDemo /></Material3Provider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Start review' }))
    await user.clear(screen.getByLabelText('Your draft name'))
    await user.type(screen.getByLabelText('Your draft name'), 'Do not save')
    await user.click(screen.getByRole('button', { name: 'Publish incoming update' }))
    await screen.findByRole('button', { name: 'Cancel draft' })
    await user.click(screen.getByRole('button', { name: 'Use server suggestion' }))
    expect((screen.getByLabelText('Your draft name') as HTMLInputElement).value).toBe('Agent suggestion')
    await user.click(screen.getByRole('button', { name: 'Cancel draft' }))
    expect(await screen.findByText('Changes cancelled.')).toBeDefined()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Approve draft' })).toBeNull())
    expect(screen.queryByText(/^Saved /)).toBeNull()
  })
})
