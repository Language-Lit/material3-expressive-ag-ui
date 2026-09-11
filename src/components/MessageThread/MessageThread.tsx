import { Fragment, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Text } from '@language-lit/material3-expressive'

import { cx } from '../../internal/classNames'
import type { TimelineNode } from '../../protocol/timeline.types'
import { useAgentContext, useToolRenderers, useInterruptRenderer } from '../../runtime/agent-context'
import type { ToolRendererRegistry, InterruptRenderer } from '../../runtime/agent-context'
import type { UseAgentResult } from '../../runtime/useAgent'
import { ActivityRow } from '../ActivityRow'
import { AssistantMessage } from '../AssistantMessage'
import { InterruptPrompt } from '../InterruptPrompt'
import { ReasoningDisclosure } from '../ReasoningDisclosure'
import { ToolCallCard } from '../ToolCallCard'
import { UserMessage } from '../UserMessage'

export interface MessageThreadProps {
  /** Shown while the transcript is empty. */
  emptyState?: ReactNode
  className?: string
}

function renderNode(
  node: TimelineNode,
  renderers: ToolRendererRegistry,
  agent: UseAgentResult,
  CustomInterrupt?: InterruptRenderer,
): ReactNode {
  switch (node.kind) {
    case 'user':
      return <UserMessage node={node} />
    case 'assistant-text':
      return <AssistantMessage node={node} />
    case 'reasoning':
      return <ReasoningDisclosure node={node} />
    case 'activity':
      return <ActivityRow node={node} />
    case 'interrupt':
      return CustomInterrupt ? <CustomInterrupt node={node} agent={agent} /> : <InterruptPrompt node={node} />
    case 'error':
      return (
        <Text as="p" variant="bodyMedium" className="m3e-agui-thread__error">
          {node.message}
        </Text>
      )
    case 'tool-call': {
      const Renderer = renderers[node.name]
      return Renderer ? <Renderer node={node} agent={agent} /> : <ToolCallCard node={node} />
    }
  }
}

/**
 * The transcript.
 *
 * Not a live region. A streaming reply appends text many times a second, and
 * an `aria-live` container around it would re-announce the whole turn on every
 * token; `RunStatus` owns announcement for the thread instead.
 *
 * Scrolling follows the reader rather than the stream: the view stays pinned
 * to the newest content only while the reader is already at the bottom, so
 * scrolling up to re-read something is never yanked away mid-run.
 */
export function MessageThread({ emptyState, className }: MessageThreadProps) {
  const agent = useAgentContext()
  const renderers = useToolRenderers()
  const interruptRenderer = useInterruptRenderer()
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)
  const { timeline } = agent

  useEffect(() => {
    const element = scrollRef.current
    if (!element || !pinnedRef.current) return
    element.scrollTop = element.scrollHeight
  }, [timeline])

  function onScroll() {
    const element = scrollRef.current
    if (!element) return
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
    pinnedRef.current = distanceFromBottom < 32
  }

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className={cx('m3e-agui-thread', className)}
      aria-label="Conversation"
    >
      {timeline.length === 0 && emptyState ? (
        <div className="m3e-agui-thread__empty">{emptyState}</div>
      ) : null}
      {timeline.map((node) => (
        <Fragment key={`${node.kind}:${node.id}`}>{renderNode(node, renderers, agent, interruptRenderer)}</Fragment>
      ))}
    </div>
  )
}
