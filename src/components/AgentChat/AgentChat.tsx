import type { ReactNode } from 'react'
import { Surface } from '@language-lit/material3-expressive'

import { cx } from '../../internal/classNames'
import { Composer } from '../Composer'
import type { ComposerProps } from '../Composer'
import { MessageThread } from '../MessageThread'
import { RunStatus } from '../RunStatus'

export interface AgentChatProps {
  /** Shown while the transcript is empty. */
  emptyState?: ReactNode
  /** Forwarded to the `Composer`. */
  composer?: ComposerProps
  className?: string
}

/**
 * The assembled chat: transcript, status line, composer.
 *
 * Requires an `AgentProvider` above it. Use the parts directly whenever the
 * product needs a different arrangement — a docked panel, a split view, a
 * thread with no composer — since this is only their most common composition.
 */
export function AgentChat({ emptyState, composer, className }: AgentChatProps) {
  return (
    <Surface color="surface" className={cx('m3e-agui-chat', className)}>
      <MessageThread emptyState={emptyState} className="m3e-agui-chat__thread" />
      <div className="m3e-agui-chat__footer">
        <RunStatus />
        <Composer {...composer} />
      </div>
    </Surface>
  )
}
