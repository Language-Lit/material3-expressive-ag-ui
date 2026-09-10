import { useMemo } from 'react'
import { CopilotKit, useDefaultTool } from '@copilotkit/react-core'
import { useInterrupt } from '@copilotkit/react-core/v2'
import { CopilotPopup } from '@copilotkit/react-ui'
import { Button, Surface, Text } from '@language-lit/material3-expressive'
import { copilotKitComponents } from '../src/copilotkit'
import { ToolCallCard } from '../src/components/ToolCallCard'
import { createDemoAgent } from './demo-agent'

function Renderers() {
  // Consumers own renderer registration. A wildcard gives unnamed backend
  // tools a Material fallback while named application renderers still win.
  useDefaultTool({ render: ({ name, args, status, result }) => <ToolCallCard node={{
    kind: 'tool-call', id: name, messageId: name, name,
    rawArgs: JSON.stringify(args), args, argsComplete: status !== 'inProgress',
    status: status === 'complete' ? 'complete' : status === 'inProgress' ? 'streaming' : 'awaiting-result',
    result: result === undefined ? undefined : String(result),
  }} /> })
  useInterrupt({ render: ({ interrupt, resolve, cancel }) => <Surface color="tertiary-container" shape="large" className="m3e-agui-interrupt">
    <Text as="p" variant="bodyLarge">{interrupt?.message ?? 'Approval required'}</Text>
    <Button variant="text" onClick={() => void cancel()}>Cancel</Button>
    <Button variant="filled" onClick={() => void resolve('approved')}>Approve</Button>
  </Surface> })
  return null
}

export function CopilotDemo() {
  const agents = useMemo(() => ({ default: createDemoAgent() }), [])
  return <CopilotKit agents__unsafe_dev_only={agents} showDevConsole={false} enableInspector={false}>
    <Renderers />
    <Text as="p" variant="bodyLarge">Open the chat to run the same five scenarios through CopilotKit.</Text>
    <CopilotPopup {...copilotKitComponents} suggestions={[]} labels={{ title: 'Material assistant', initial: 'Send a message to begin.' }} />
  </CopilotKit>
}
