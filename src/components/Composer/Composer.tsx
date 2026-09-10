import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Icon, IconButton, TextArea } from '@language-lit/material3-expressive'

import { cx } from '../../internal/classNames'
import { SendIcon, StopIcon } from '../../internal/icons'
import { useAgentContext } from '../../runtime/agent-context'

export interface ComposerProps {
  /** Field label. Required by `TextArea` and rendered as a real `<label>`. */
  label?: string
  placeholder?: string
  sendLabel?: string
  stopLabel?: string
  /** Tallest the field grows before it scrolls. Default `8`. */
  maxRows?: number
  disabled?: boolean
  className?: string
}

/**
 * The input, plus the one control that starts and stops a run.
 *
 * Send and stop share a slot rather than sitting side by side: only one of
 * them is ever actionable, and a permanently disabled button next to an active
 * one is noise. The field grows with its content up to `maxRows` — `TextArea`
 * has no autogrow, so the row count is computed here from the value.
 */
export function Composer({
  label = 'Message',
  placeholder,
  sendLabel = 'Send message',
  stopLabel = 'Stop generating',
  maxRows = 8,
  disabled = false,
  className,
}: ComposerProps) {
  const { send, stop, isRunning } = useAgentContext()
  const [value, setValue] = useState('')

  const rows = Math.min(maxRows, Math.max(1, value.split('\n').length))
  const canSend = value.trim() !== '' && !isRunning && !disabled

  function submit() {
    if (!canSend) return
    const text = value
    setValue('')
    void send(text)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter is a newline. `isComposing` guards IME
    // candidate selection, which also arrives as Enter.
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    submit()
  }

  return (
    <div className={cx('m3e-agui-composer', className)}>
      <TextArea
        label={label}
        placeholder={placeholder}
        variant="outlined"
        rows={rows}
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        className="m3e-agui-composer__field"
      />
      {isRunning ? (
        <IconButton
          variant="tonal"
          aria-label={stopLabel}
          onClick={stop}
          className="m3e-agui-composer__action"
        >
          <Icon source={StopIcon} />
        </IconButton>
      ) : (
        <IconButton
          variant="filled"
          aria-label={sendLabel}
          disabled={!canSend}
          onClick={submit}
          className="m3e-agui-composer__action"
        >
          <Icon source={SendIcon} />
        </IconButton>
      )}
    </div>
  )
}
