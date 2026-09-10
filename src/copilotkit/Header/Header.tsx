import { useChatContext, type HeaderProps as SlotProps } from '@copilotkit/react-ui'
import { Icon, IconButton, Text } from '@language-lit/material3-expressive'
import { CloseIcon } from '../../internal/icons'

export type HeaderProps = SlotProps
export function Header(_props: HeaderProps) {
  const { setOpen, labels } = useChatContext()
  return <div className="m3e-agui-ck-header">
    <Text as="h2" variant="titleLarge">{labels.title}</Text>
    <IconButton aria-label="Close chat" onClick={() => setOpen(false)}><Icon source={CloseIcon} /></IconButton>
  </div>
}
