import type { ComponentType } from 'react'

/**
 * Icon artwork for this package's own affordances.
 *
 * The base library deliberately bundles no icon font and no SVG set — serving
 * Material Symbols is the application's job. A component package cannot make
 * that choice for its consumer, and a chat whose send button is an invisible
 * ligature because the host never loaded the font is a broken chat. So the
 * handful of glyphs these components need are drawn here as SVG sources.
 *
 * They satisfy `IconSource`: the props `Icon` passes are spread onto the root,
 * no `fill` is set so the library's `fill: currentColor` rule applies, and no
 * width or height is set so `Icon` owns sizing.
 */

interface IconSourceProps {
  readonly className: string
  readonly 'aria-hidden': true
  readonly focusable: 'false'
}

type Glyph = ComponentType<IconSourceProps>

export const SendIcon: Glyph = (props) => (
  <svg {...props} viewBox="0 0 24 24">
    <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10.1 15.3 12 3.4 13.9Z" />
  </svg>
)

export const StopIcon: Glyph = (props) => (
  <svg {...props} viewBox="0 0 24 24">
    <rect x="6" y="6" width="12" height="12" rx="2.5" />
  </svg>
)

export const ChevronIcon: Glyph = (props) => (
  <svg {...props} viewBox="0 0 24 24">
    <path d="M12 15.4 5.6 9l1.4-1.4 5 5 5-5L18.4 9Z" />
  </svg>
)

export const CheckIcon: Glyph = (props) => (
  <svg {...props} viewBox="0 0 24 24">
    <path d="M9.6 17.6 4 12l1.4-1.4 4.2 4.2 9-9L20 7.2Z" />
  </svg>
)

export const ErrorIcon: Glyph = (props) => (
  <svg {...props} viewBox="0 0 24 24">
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2Zm0-4h-2V7h2Z" />
  </svg>
)

export const ToolIcon: Glyph = (props) => (
  <svg {...props} viewBox="0 0 24 24">
    <path d="M9.4 3.6a5.5 5.5 0 0 1 7.1 7.1l4.4 4.4a2 2 0 0 1-2.8 2.8l-4.4-4.4a5.5 5.5 0 0 1-7.1-7.1L9 8.8l2.4-.4.4-2.4Z" />
  </svg>
)

export const ReasoningIcon: Glyph = (props) => (
  <svg {...props} viewBox="0 0 24 24">
    <path d="M12 2.5 13.8 8 19.5 9.8 13.8 11.6 12 17.1 10.2 11.6 4.5 9.8 10.2 8Zm5.8 10.9.9 2.7 2.8.9-2.8.9-.9 2.7-.9-2.7-2.8-.9 2.8-.9Z" />
  </svg>
)
