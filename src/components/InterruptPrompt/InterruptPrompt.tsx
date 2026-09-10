import { useState } from 'react'
import { Button, Surface, Text } from '@language-lit/material3-expressive'

import { cx } from '../../internal/classNames'
import type { InterruptNode } from '../../protocol/timeline.types'
import { useAgentContext } from '../../runtime/agent-context'

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
  const { resolveInterrupt } = useAgentContext()
  const [answering, setAnswering] = useState(false)

  async function answer(status: 'resolved' | 'cancelled') {
    setAnswering(true)
    try {
      await resolveInterrupt(node.id, { status })
    } catch {
      // The shared run status reports the failure; allow another attempt.
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
      <div className="m3e-agui-interrupt__actions">
        <Button variant="text" disabled={answering} onClick={() => void answer('cancelled')}>
          {cancelLabel}
        </Button>
        <Button variant="filled" disabled={answering} onClick={() => void answer('resolved')}>
          {approveLabel}
        </Button>
      </div>
    </Surface>
  )
}
