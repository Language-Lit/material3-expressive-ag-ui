import { Surface, Text } from '@language-lit/material3-expressive'

import { cx } from '../../internal/classNames'
import type { UserNode } from '../../protocol/timeline.types'

export interface UserMessageProps {
  node: UserNode
  className?: string
}

/**
 * A turn the person took.
 *
 * Given a bubble on `primary-container`, which is the one place in the thread
 * that earns a filled container: it is what makes a long transcript scannable
 * as an alternation rather than a wall of text. `Surface` pairs the `on-*`
 * content colour itself, so the bubble stays legible in both colour modes.
 */
export function UserMessage({ node, className }: UserMessageProps) {
  return (
    <div className={cx('m3e-agui-user-message', className)}>
      <Surface
        color="primary-container"
        shape="large"
        className="m3e-agui-user-message__bubble"
      >
        <Text as="p" variant="bodyLarge" className="m3e-agui-user-message__text">
          {node.content}
        </Text>
      </Surface>
    </div>
  )
}
