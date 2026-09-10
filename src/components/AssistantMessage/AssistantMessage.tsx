import { Text } from '@language-lit/material3-expressive'

import { cx } from '../../internal/classNames'
import type { AssistantTextNode } from '../../protocol/timeline.types'

export interface AssistantMessageProps {
  node: AssistantTextNode
  className?: string
}

/**
 * A turn the agent took.
 *
 * Deliberately not a bubble. Agent replies are long-form, and a container
 * around a screen of prose adds a second boundary the eye has to parse without
 * adding meaning — the alternation is already carried by the user's bubble.
 * The text sits on the thread surface and takes `on-surface`.
 *
 * The streaming caret is decorative and hidden from assistive technology: the
 * text is announced by the thread's own policy, not per token.
 */
export function AssistantMessage({ node, className }: AssistantMessageProps) {
  return (
    <div className={cx('m3e-agui-assistant-message', className)}>
      <Text as="div" variant="bodyLarge" className="m3e-agui-assistant-message__text">
        {node.content}
        {node.streaming ? <span className="m3e-agui-caret" aria-hidden="true" /> : null}
      </Text>
    </div>
  )
}
