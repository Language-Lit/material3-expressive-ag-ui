import { useEffect } from 'react'
import { useChatContext, type WindowProps as SlotProps } from '@copilotkit/react-ui'
import { Dialog } from '@language-lit/material3-expressive'

export type WindowProps = SlotProps
export function Window({ children, clickOutsideToClose, hitEscapeToClose, shortcut }: WindowProps) {
  const { open, setOpen, labels } = useChatContext()
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== shortcut.toLowerCase() || !(event.metaKey || event.ctrlKey) || event.repeat) return
      const target = event.target
      if (!open && target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      event.preventDefault()
      setOpen(!open)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, setOpen, shortcut])
  return <Dialog open={open} onOpenChange={setOpen}
    dismissOnEscape={hitEscapeToClose} dismissOnOutsideClick={clickOutsideToClose}
    aria-label={labels.title} className="m3e-agui-ck-window">
    <div className="m3e-agui-ck-window__content">{children}</div>
  </Dialog>
}
