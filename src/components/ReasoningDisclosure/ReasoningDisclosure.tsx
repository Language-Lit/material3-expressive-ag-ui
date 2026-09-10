import { useId, useState } from 'react'
import { Button, Icon, Text } from '@language-lit/material3-expressive'

import { cx } from '../../internal/classNames'
import { ChevronIcon, ReasoningIcon } from '../../internal/icons'
import type { ReasoningNode } from '../../protocol/timeline.types'

export interface ReasoningDisclosureProps {
  node: ReasoningNode
  /** Start expanded. Default `false` — reasoning is secondary to the answer. */
  defaultExpanded?: boolean
  className?: string
}

/**
 * The agent's thinking, collapsed by default.
 *
 * Reasoning is supporting evidence, not the answer, so it gets a low-emphasis
 * text button and `on-surface-variant` body copy — it must be reachable
 * without competing with the reply for attention.
 *
 * A provider that returns reasoning as an encrypted blob gives nothing to
 * show. The node is still rendered, without a toggle, because "the agent
 * reasoned here and you may not read it" is itself information.
 */
export function ReasoningDisclosure({
  node,
  defaultExpanded = false,
  className,
}: ReasoningDisclosureProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const bodyId = useId()

  if (node.encrypted) {
    return (
      <div className={cx('m3e-agui-reasoning', className)}>
        <Text as="p" variant="labelLarge" className="m3e-agui-reasoning__encrypted">
          Reasoning withheld by the provider
        </Text>
      </div>
    )
  }

  return (
    <div className={cx('m3e-agui-reasoning', className)} data-expanded={expanded || undefined}>
      <Button
        variant="text"
        size="extra-small"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-controls={bodyId}
        leadingIcon={<Icon source={ReasoningIcon} size={18} />}
        trailingIcon={<Icon source={ChevronIcon} size={18} className="m3e-agui-reasoning__chevron" />}
        className="m3e-agui-reasoning__toggle"
      >
        {node.streaming ? 'Thinking' : 'Thought process'}
      </Button>
      <div id={bodyId} hidden={!expanded} className="m3e-agui-reasoning__body">
        <Text as="p" variant="bodyMedium" className="m3e-agui-reasoning__text">
          {node.content}
        </Text>
      </div>
    </div>
  )
}
