import { useChatContext, type ButtonProps as SlotProps } from '@copilotkit/react-ui'
import { FloatingActionButton, Icon } from '@language-lit/material3-expressive'
import { ChatIcon, CloseIcon } from '../../internal/icons'

export type ButtonProps = SlotProps
export function Button(_props: ButtonProps) {
  const { open, setOpen } = useChatContext()
  return <FloatingActionButton className="m3e-agui-ck-launcher" aria-label={open ? 'Close chat' : 'Open chat'}
    aria-expanded={open} onClick={() => setOpen(!open)}
    icon={<Icon source={open ? CloseIcon : ChatIcon} />} />
}
