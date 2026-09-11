import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  Card,
  Material3Provider,
  SegmentedButtonGroup,
  Surface,
  Text,
} from '@language-lit/material3-expressive'

import { AgentChat } from '../src/components/AgentChat'
import { AgentProvider } from '../src/runtime/agent-context'
import type { ToolRendererRegistry } from '../src/runtime/agent-context'
import { createDemoAgent } from './demo-agent'
import { SharedStateDemo } from './SharedStateDemo'

const CopilotDemo = lazy(() => import('./CopilotDemo').then((module) => ({ default: module.CopilotDemo })))

type ColorMode = 'light' | 'dark' | 'system'

/**
 * Generative UI: `show_weather` renders as a real card instead of the default
 * tool disclosure. It is called while arguments are still streaming, so every
 * field is read defensively — that is what makes the card fill in rather than
 * appear all at once.
 */
const toolRenderers: ToolRendererRegistry = {
  show_weather: ({ node }) => {
    const city = typeof node.args?.city === 'string' ? node.args.city : '…'
    const temperature = typeof node.args?.temperature === 'number' ? node.args.temperature : null
    const condition = typeof node.args?.condition === 'string' ? node.args.condition : ''

    return (
      <Card variant="filled" as="div" className="pg-weather">
        <Text as="span" variant="displaySmall" className="pg-weather__temp">
          {temperature === null ? '--' : `${temperature}°`}
        </Text>
        <div>
          <Text as="p" variant="titleMedium" style={{ margin: 0 }}>
            {city}
          </Text>
          <Text as="p" variant="bodyMedium" style={{ margin: 0 }}>
            {condition || (node.argsComplete ? '' : 'Loading…')}
          </Text>
        </div>
      </Card>
    )
  },
}

export function App() {
  const [colorMode, setColorMode] = useState<ColorMode>('system')
  const [demo, setDemo] = useState('native')
  const agent = useMemo(() => createDemoAgent(), [])

  // `body` is painted by this page but sits outside the provider's div, so it
  // resolves tokens against the theme scope on `<html>`. Setting `colorMode` on
  // the provider alone would light the chat and leave the page behind it dark.
  // Any app that paints the page owes the document element the same update.
  useEffect(() => {
    document.documentElement.dataset.m3eColorMode = colorMode
  }, [colorMode])

  return (
    <Material3Provider colorMode={colorMode} style={{ blockSize: '100%' }}>
      <div className="pg-shell">
        <div className="pg-bar">
          <Text as="h1" variant="titleLarge" style={{ margin: 0 }}>
            AG-UI · Material 3 Expressive
          </Text>
          <div className="pg-bar__actions">
            <SegmentedButtonGroup segments={[{ value: 'native', label: 'AG-UI' }, { value: 'copilotkit', label: 'CopilotKit' }, { value: 'state', label: 'Shared state' }]}
              value={demo} onValueChange={setDemo} />
            <SegmentedButtonGroup
              segments={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
              value={colorMode}
              onValueChange={(value) => setColorMode(value as ColorMode)}
            />
          </div>
        </div>

        <Surface color="surface" className={`pg-chat${demo === 'copilotkit' ? ' pg-chat--copilotkit' : ''}`}>
          {demo === 'state' ? <SharedStateDemo /> : demo === 'copilotkit' ? <Suspense fallback={<Text className="pg-chat__status">Loading CopilotKit…</Text>}><CopilotDemo /></Suspense> :
          <AgentProvider agent={agent} toolRenderers={toolRenderers}>
            <AgentChat
              emptyState={
                <>
                  <Text as="p" variant="bodyLarge" style={{ margin: 0 }}>
                    Send anything to start.
                  </Text>
                  <Text as="p" variant="bodyMedium" style={{ margin: '4px 0 0' }}>
                    Each turn demonstrates a different part of the protocol: streaming text and
                    reasoning, tool calls, steps and activity, generative UI, an approval prompt,
                    and a failed run.
                  </Text>
                </>
              }
            />
          </AgentProvider>}
        </Surface>
      </div>
    </Material3Provider>
  )
}
