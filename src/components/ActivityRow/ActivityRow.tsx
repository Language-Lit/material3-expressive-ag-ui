import { Surface, Text } from '@language-lit/material3-expressive'

import { cx } from '../../internal/classNames'
import type { ActivityNode } from '../../protocol/timeline.types'

export interface ActivityRowProps {
  node: ActivityNode
  className?: string
}

/**
 * A backend-defined progress note — "searching the index", "editing a file".
 *
 * Both halves of an activity are the backend's to define: `activityType` is an
 * open string and `content` an open record. Neither can be mapped to fixed
 * copy or a fixed icon here without guessing at a schema a given backend may
 * never use, so the type is shown as an overline and the payload rendered
 * plainly. Products that know their own activity shapes should render them
 * with a component of their own.
 */
export function ActivityRow({ node, className }: ActivityRowProps) {
  const entries = Object.entries(node.content)

  return (
    <Surface
      color="surface-container"
      shape="medium"
      className={cx('m3e-agui-activity', className)}
    >
      <Text as="p" variant="labelSmall" className="m3e-agui-activity__type">
        {node.activityType}
      </Text>
      {entries.length > 0 ? (
        <dl className="m3e-agui-activity__fields">
          {entries.map(([key, value]) => (
            // `Text` cannot own `dt`/`dd`, so these carry the type-scale tokens
            // directly — the documented exception, not a shortcut.
            <div key={key} className="m3e-agui-activity__field">
              <dt className="m3e-agui-activity__key">{key}</dt>
              <dd className="m3e-agui-activity__value">
                {typeof value === 'string' ? value : JSON.stringify(value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Surface>
  )
}
