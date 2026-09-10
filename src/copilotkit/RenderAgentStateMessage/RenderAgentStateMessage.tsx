import type { RenderMessageProps } from '@copilotkit/react-ui'
import { ActivityRow } from '../../components/ActivityRow'

export type RenderAgentStateMessageProps = RenderMessageProps
export function RenderAgentStateMessage({ message }: RenderAgentStateMessageProps) {
  if (message.role !== 'activity') return null
  return <ActivityRow node={{
    kind: 'activity', id: message.id, activityType: message.activityType,
    content: message.content,
  }} />
}
