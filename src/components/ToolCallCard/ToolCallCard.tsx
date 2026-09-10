import { useId, useState } from 'react'
import { Card, CircularProgress, Icon, Text } from '@language-lit/material3-expressive'

import { cx } from '../../internal/classNames'
import { CheckIcon, ChevronIcon, ErrorIcon, ToolIcon } from '../../internal/icons'
import type { ToolCallNode } from '../../protocol/timeline.types'

export interface ToolCallCardProps {
  node: ToolCallNode
  /** Start with arguments and result revealed. Default `false`. */
  defaultExpanded?: boolean
  className?: string
}

const STATUS_LABEL: Record<ToolCallNode['status'], string> = {
  streaming: 'Preparing',
  'awaiting-result': 'Running',
  complete: 'Done',
  error: 'Failed',
}

function StatusIndicator({ node }: { node: ToolCallNode }) {
  const label = `${STATUS_LABEL[node.status]}: ${node.name || node.id}`

  if (node.status === 'streaming' || node.status === 'awaiting-result') {
    return <CircularProgress aria-label={label} className="m3e-agui-tool-call__spinner" />
  }
  return (
    <Icon
      source={node.status === 'error' ? ErrorIcon : CheckIcon}
      size={18}
      decorative={false}
      label={label}
      className={
        node.status === 'error' ? 'm3e-agui-tool-call__failed' : 'm3e-agui-tool-call__done'
      }
    />
  )
}

function formatArgs(node: ToolCallNode): string {
  if (node.args !== undefined) return JSON.stringify(node.args, null, 2)
  return node.rawArgs === '' ? '—' : node.rawArgs
}

/**
 * The default rendering of one tool call.
 *
 * A passive outlined card, because it holds its own disclosure button — an
 * interactive card is a `<button>`, and nesting a control inside one is
 * invalid. Outlined rather than filled so a run with several calls does not
 * turn the thread into a stack of competing blocks.
 *
 * Register a `ToolRenderer` on `AgentProvider` to replace this with real
 * generative UI for a given tool name.
 */
export function ToolCallCard({ node, defaultExpanded = false, className }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const bodyId = useId()
  const hasResult = node.result !== undefined || node.error !== undefined

  return (
    <Card
      variant="outlined"
      as="div"
      className={cx('m3e-agui-tool-call', className)}
      data-status={node.status}
      data-expanded={expanded || undefined}
    >
      <div className="m3e-agui-tool-call__header">
        <Icon source={ToolIcon} size={18} className="m3e-agui-tool-call__glyph" />
        <button
          type="button"
          className="m3e-agui-tool-call__toggle"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls={bodyId}
        >
          <Text as="span" variant="titleSmall" className="m3e-agui-tool-call__name">
            {node.name || node.id}
          </Text>
          <Icon source={ChevronIcon} size={18} className="m3e-agui-tool-call__chevron" />
        </button>
        <StatusIndicator node={node} />
      </div>

      <div id={bodyId} hidden={!expanded} className="m3e-agui-tool-call__body">
        <Text as="p" variant="labelSmall" className="m3e-agui-tool-call__legend">
          Arguments{node.argsComplete ? '' : ' (still arriving)'}
        </Text>
        <pre className="m3e-agui-tool-call__code">{formatArgs(node)}</pre>
        {hasResult ? (
          <>
            <Text as="p" variant="labelSmall" className="m3e-agui-tool-call__legend">
              {node.error === undefined ? 'Result' : 'Error'}
            </Text>
            <pre className="m3e-agui-tool-call__code">{node.error ?? node.result}</pre>
          </>
        ) : null}
      </div>
    </Card>
  )
}
