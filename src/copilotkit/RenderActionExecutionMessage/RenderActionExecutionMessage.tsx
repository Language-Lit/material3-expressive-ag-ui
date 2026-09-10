import type { RenderMessageProps } from '@copilotkit/react-ui'
import { RenderTextMessage } from '../RenderTextMessage'

export type RenderActionExecutionMessageProps = RenderMessageProps
// Current v1 slots receive an AG-UI assistant message containing toolCalls.
export function RenderActionExecutionMessage(props: RenderActionExecutionMessageProps) {
  return <RenderTextMessage {...props} />
}
