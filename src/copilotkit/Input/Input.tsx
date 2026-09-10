import { useRef, useState } from 'react'
import { useChatContext, type InputProps as SlotProps } from '@copilotkit/react-ui'
import { Button, Icon, IconButton, Text, TextArea } from '@language-lit/material3-expressive'
import { SendIcon, StopIcon } from '../../internal/icons'

export type InputProps = SlotProps
export function Input({ inProgress, onSend, onStop, onUpload, hideStopButton, chatReady = true, isVisible = true }: InputProps) {
  const { labels } = useChatContext()
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const locked = useRef(false)
  const disabled = !chatReady || inProgress || sending
  async function send() {
    if (disabled || locked.current || !value.trim()) return
    locked.current = true
    setSending(true)
    setError('')
    const text = value
    setValue('')
    try { await onSend(text.trim()) }
    catch (cause) {
      setValue((current) => current || text)
      setError(cause instanceof Error ? cause.message : 'Could not send message')
    } finally { locked.current = false; setSending(false) }
  }
  if (!isVisible) return null
  return (
    <div className="m3e-agui-ck-input">
      <div className="m3e-agui-composer">
        {onUpload ? <Button variant="text" disabled={disabled} onClick={onUpload}>Attach</Button> : null}
        <TextArea label="Message" placeholder={labels.placeholder} value={value}
          rows={Math.min(8, Math.max(1, value.split('\n').length))}
          disabled={!chatReady} className="m3e-agui-composer__field"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
            event.preventDefault()
            void send()
          }}
        />
        {inProgress && !hideStopButton && onStop
          ? <IconButton variant="tonal" aria-label={labels.stopGenerating} onClick={onStop}><Icon source={StopIcon} /></IconButton>
          : <IconButton variant="filled" aria-label="Send message" disabled={disabled || !value.trim()} onClick={() => void send()}><Icon source={SendIcon} /></IconButton>}
      </div>
      {error ? <Text as="p" variant="bodySmall" className="m3e-agui-thread__error">{error}</Text> : null}
    </div>
  )
}
