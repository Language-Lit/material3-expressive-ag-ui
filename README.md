# @language-lit/material3-expressive-ag-ui

Material 3 Expressive chat and agent components for the
[AG-UI protocol](https://github.com/ag-ui-protocol/ag-ui).

AG-UI standardises how an agent talks to a UI: streaming text, reasoning, tool
calls whose arguments arrive as partial JSON, activity notes, shared state, and
runs that stop to ask permission. This package renders that conversation using
[`@language-lit/material3-expressive`](https://m3e.language-lit.com).

> **Status: `0.1.0`, unreleased.** The AG-UI-native surface is built and tested.
> The CopilotKit adapter is specified and its entry point reserved, but **not
> implemented** — see [ADR 0003](docs/adr/0003-reserved-copilotkit-entry-point.md).

## What you get

- **`useAgent`** — binds an `AbstractAgent` to React through
  `useSyncExternalStore`, so it is tear-free under concurrent rendering.
- **Ten components** — thread, user and assistant turns, reasoning disclosure,
  tool-call card, activity row, interrupt prompt, run status, composer, and the
  assembled `AgentChat`.
- **A React-free projection** at `/protocol` — the same reading of the event
  stream, with no React and no DOM, usable from server code and other hosts.
- **Generative UI** — register a component per tool name and render it while the
  arguments are still streaming.
- **Zero runtime dependencies.**

## Install

```sh
npm install @language-lit/material3-expressive-ag-ui \
            @language-lit/material3-expressive \
            @ag-ui/client @ag-ui/core
```

All four are peers, plus React 18 or 19. You keep one copy of the AG-UI SDK and
one copy of the design system; this package re-exports neither.

## Use

Import both stylesheets once, at your app's root, in this order:

```ts
import '@language-lit/material3-expressive/styles.css'
import '@language-lit/material3-expressive-ag-ui/styles.css'
```

Then mount the design system's provider, bind an agent, and render:

```tsx
'use client'

import { Material3Provider } from '@language-lit/material3-expressive'
import { AgentChat, AgentProvider } from '@language-lit/material3-expressive-ag-ui'
import { HttpAgent } from '@ag-ui/client'
import { useMemo } from 'react'

export function Chat() {
  const agent = useMemo(() => new HttpAgent({ url: '/api/agent' }), [])

  return (
    <Material3Provider>
      <AgentProvider agent={agent}>
        <AgentChat emptyState={<p>Ask about the shape tokens.</p>} />
      </AgentProvider>
    </Material3Provider>
  )
}
```

`AgentChat` is only the most common arrangement of the parts. For a docked
panel, a split view, or a thread with no composer, compose them yourself:

```tsx
<AgentProvider agent={agent}>
  <MessageThread />
  <RunStatus />
  <Composer placeholder="Ask anything" />
</AgentProvider>
```

### Driving it yourself

`useAgentContext()` returns everything the provider bound:

```tsx
const { timeline, state, phase, isRunning, steps, interrupts, error,
        send, run, stop, resolveInterrupt, setState } = useAgentContext()
```

Call `useAgent(agent)` directly only if you are not using the provider — one
agent should be bound once, or you get two subscriptions and two `send` paths.

### Generative UI

Register a component per tool name. It is called while arguments are still
arriving, so `node.args` may be partial — that is what lets the UI fill in
progressively instead of popping in when the call closes.

```tsx
<AgentProvider
  agent={agent}
  toolRenderers={{
    show_weather: ({ node }) => (
      <WeatherCard
        city={node.args?.city as string | undefined}
        temperature={node.args?.temperature as number | undefined}
      />
    ),
  }}
>
  <AgentChat />
</AgentProvider>
```

Tool names with no renderer fall back to `ToolCallCard`.

### Human in the loop

A run that stops for permission finishes with an interrupt. `InterruptPrompt`
renders it inside the transcript and `resolveInterrupt` resumes the run through
the SDK's own `buildResumeArray`, so nothing is replaced and the conversation
continues:

```tsx
await resolveInterrupt(interruptId, { status: 'resolved' })
```

### Without React

The projection is published on its own. No React, no DOM, no `'use client'`:

```ts
import { projectTimeline, reduceRunOverlay, createRunOverlay }
  from '@language-lit/material3-expressive-ag-ui/protocol'
```

Useful for server-rendering a transcript, for analytics over recorded runs, or
for a host that is not React.

## Theming

There is nothing to theme here. Every color, type style, corner, duration, and
easing resolves to a `--m3e-*` token, so the components follow whatever theme
`Material3Provider` supplies, in light and dark, at any density.

To retune one instance, set the design system's public component aliases on an
ancestor you own — never a `.m3e-*` selector.

One integration note, because a chat usually fills a page: `Material3Provider`
scopes the theme to the element it renders. Anything you paint *outside* that
element — typically `body` — resolves tokens against whatever scope encloses it,
so setting `colorMode` on the provider alone will light the chat and leave the
page behind it dark. Keep the document element in step:

```tsx
useEffect(() => {
  document.documentElement.dataset.m3eColorMode = colorMode
}, [colorMode])
```

`playground/App.tsx` does exactly this.

## Development

```sh
npm install
npm run playground   # http://localhost:5273 — five scenarios, no backend
npm test
npm run verify       # typecheck + test + build
```

The playground builds from `src`, so what you see is the source.

## Documentation

- [SPEC.md](docs/SPEC.md) — scope, public surface, accessibility, quality bar
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — how a run becomes pixels
- [ADR 0001](docs/adr/0001-separate-package-boundary.md) — why this is a separate package
- [ADR 0002](docs/adr/0002-projection-over-duplicated-state.md) — projecting the transcript
- [ADR 0003](docs/adr/0003-reserved-copilotkit-entry-point.md) — the reserved CopilotKit adapter

## License

MIT
# material3-expressive-ag-ui
