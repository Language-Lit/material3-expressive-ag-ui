import { useState } from 'react'
import { Button, Surface, Text } from '@language-lit/material3-expressive'

import { cx } from '../../internal/classNames'
import type { InterruptNode } from '../../protocol/timeline.types'
import { useAgentContext } from '../../runtime/agent-context'
import { sameJson } from '../../internal/sameJson'

export interface InterruptPromptProps {
  node: InterruptNode
  /** Label for the confirming action. Default `'Approve'`. */
  approveLabel?: string
  /** Label for the declining action. Default `'Cancel'`. */
  cancelLabel?: string
  className?: string
}

/**
 * A run that stopped to ask the person something.
 *
 * The agent cannot continue until this is answered, which makes it the one
 * focal element in the thread while it is open — hence a `tertiary-container`
 * surface and a filled confirm. Answering resumes the same run through
 * AG-UI's resume protocol rather than starting a new one.
 */
export function InterruptPrompt({
  node,
  approveLabel = 'Approve',
  cancelLabel = 'Cancel',
  className,
}: InterruptPromptProps) {
  const { resolveInterrupt, state, isRunning } = useAgentContext()
  const [reviewedState, setReviewedState] = useState(() => structuredClone(state))
  const [error, setError] = useState<string>()
  const changed = !sameJson(reviewedState, state)
  const [answering, setAnswering] = useState(false)

  async function answer(status: 'resolved' | 'cancelled') {
    setAnswering(true)
    setError(undefined)
    try {
      await resolveInterrupt(node.id, { status }, status === 'resolved' ? { expectedState: reviewedState } : undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to answer this approval.')
    } finally {
      setAnswering(false)
    }
  }

  return (
    <Surface
      color="tertiary-container"
      shape="large"
      className={cx('m3e-agui-interrupt', className)}
    >
      <Text as="p" variant="bodyLarge" className="m3e-agui-interrupt__message">
        {node.message ?? node.reason}
      </Text>
      {changed ? <>
        <Text as="p" variant="bodyMedium">State changed since this approval opened. Review the updated state before approving.</Text>
        <Text as="div" variant="bodySmall" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(state, null, 2)}</Text>
        <Button variant="text" disabled={answering || isRunning} onClick={() => {
          setReviewedState(structuredClone(state))
          setError(undefined)
        }}>I reviewed the updated state</Button>
      </> : null}
      {error ? <Text as="p" variant="bodyMedium">{error}</Text> : null}
      <div className="m3e-agui-interrupt__actions">
        <Button variant="text" disabled={answering || isRunning} onClick={() => void answer('cancelled')}>
          {cancelLabel}
        </Button>
        <Button variant="filled" disabled={answering || isRunning || changed} onClick={() => void answer('resolved')}>
          {approveLabel}
        </Button>
      </div>
    </Surface>
  )
}
