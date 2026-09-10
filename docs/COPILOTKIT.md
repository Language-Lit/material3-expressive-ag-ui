# CopilotKit integration guide

Use `@language-lit/material3-expressive-ag-ui/copilotkit` to render an existing
CopilotKit application with Material 3 Expressive components. The adapter targets
CopilotKit **1.71.x v1 slots**, tested at 1.71.0. The v2 slot API is not supported.

## Setup

Follow the [package installation and stylesheet setup](../README.md#quick-start),
then install the optional peers:

```sh
npm install @copilotkit/react-core@~1.71.0 @copilotkit/react-ui@~1.71.0
```

Inside your existing `CopilotKit` provider and `Material3Provider`, use:

```tsx
import { CopilotChat } from '@copilotkit/react-ui'
import { copilotKitComponents } from '@language-lit/material3-expressive-ag-ui/copilotkit'

<CopilotChat {...copilotKitComponents} />
```

The preset also works with `CopilotPopup` and `CopilotSidebar`, including a
Material dialog, header, and launcher. Do not mount the native `AgentProvider`:
CopilotKit owns the agent, transport, actions, and interrupts.

Native and protocol entry points import no CopilotKit code. The optional peers
are needed only for `/copilotkit`. CopilotKit's own peers must also be installed;
package managers normally resolve them, but `--legacy-peer-deps` users must
provide `@modelcontextprotocol/sdk@^1.29.0` and `zod@>=3.25` explicitly.

## Layout and styles

Import both Material and AG-UI stylesheets in the order shown in the quick start.
Retain the preset's `m3e-agui-ck-chat` class when adding your own `className`:

```tsx
<CopilotChat
  {...copilotKitComponents}
  className={`${copilotKitComponents.className} my-chat`}
/>
```

CopilotKit styles may still be needed for its other features, such as suggestions
and attachments. The adapter's controls use this package's stylesheet.

## Tools and interrupts

Register tool and interrupt renderers with CopilotKit as usual. Their UI,
placement, and response callbacks are retained.

An unregistered tool can render nothing when CopilotKit supplies an empty
generative-UI wrapper. Register a catch-all through `useDefaultTool` if every
tool should have a visible fallback. The
[working playground example](../playground/CopilotDemo.tsx) demonstrates a
fallback using `ToolCallCard`, alongside approval/resume and popup interactions.

## Text and media

Text is preserved as plain text; Markdown is not rendered. Image content
delegates to the supplied `ImageRenderer`; other media receives an
attachment-type label. Supply custom renderer slots for richer presentation.

## Exported slots

The subpath exports `copilotKitComponents` and the following components with
their corresponding props types:

- `AssistantMessage`, `UserMessage`, `Messages`, `Input`
- `RenderMessage`
- `RenderTextMessage`, `RenderActionExecutionMessage`, `RenderAgentStateMessage`,
  `RenderResultMessage`
- `Window`, `Button`, `Header`

The four legacy `Render*Message` slots accept the AG-UI-shaped props of
CopilotKit 1.71.x, not old GraphQL message instances.

See [ADR 0004](adr/0004-copilotkit-adapter-and-hardening.md) for the adapter's
architecture and compatibility decision.
