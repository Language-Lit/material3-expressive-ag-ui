# Material 3 Expressive AG-UI Specification

Status: native slice, CopilotKit v1 adapter, and guarded drafts implemented; released
Specification date: 2026-09-11
Current version: `0.2.0`

This document defines the product, boundary, architecture, and quality bar for
`@language-lit/material3-expressive-ag-ui`.

The terms **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY**
describe normative requirements.

## 1. Product

An agent talks in a shape no general component library has a primitive for: a
transcript that streams, reasons out loud, calls tools whose arguments arrive as
partial JSON, reports intermediate activity, and sometimes stops to ask
permission. AG-UI standardises that conversation as a protocol. This package
renders it in Material 3 Expressive.

It is the UI half only. Transport, agent orchestration, and backend adapters
belong to `@ag-ui/*` and MUST NOT be reimplemented here.

### 1.1 Scope

In scope: projecting an AG-UI run into a render model, binding an
`AbstractAgent` to React, and the conformant M3 surfaces that display the
result — user and assistant turns, reasoning, tool calls, activity, interrupts,
run status, and the composer.

Out of scope: HTTP or SSE clients, agent frameworks, prompt construction,
persistence, authentication, markdown rendering, syntax highlighting, virtual
scrolling, and icon fonts. A consumer that needs any of these composes it.

### 1.2 Relationship to `@language-lit/material3-expressive`

This package is a **consumer** of the design system, not an extension of it. It
holds the same relationship to the library that any application does, and the
library's rules apply here without exception:

- App code MUST NOT target `.m3e-*` selectors or use `!important` against a
  library class. The sanctioned override surface is `--m3e-comp-*` custom
  properties set on an ancestor this package owns.
- Only the four public entry points may be imported: the package root,
  `/theme`, `/tokens`, and `/styles.css`. Deep imports are forbidden.
- Every color, type style, corner, duration, easing, elevation, and state
  opacity MUST resolve to an `--m3e-*` token.
- Components that the design system already ships MUST be used rather than
  re-implemented. This package adds only the compositions AG-UI needs and the
  design system deliberately leaves to the app.

Consumers MUST import `@language-lit/material3-expressive/styles.css` and mount
`Material3Provider` themselves; this package neither re-exports nor re-bundles
them.

### 1.3 Why a separate package

The design system's own specification forbids housing this code in it. Its
§1.2 fixes the public export map at exactly four paths and makes any addition a
breaking change requiring owner approval and an ADR, and its §1.3 requires CI to
continuously verify *the absence of runtime dependencies and of any peer beyond
React and React DOM*. AG-UI's client pulls rxjs, zod, and uuid. Adding an
AG-UI surface to that package would fail its own CI by construction.

See [ADR 0001](adr/0001-separate-package-boundary.md).

## 2. Public surface

The package MUST export exactly:

```text
@language-lit/material3-expressive-ag-ui
@language-lit/material3-expressive-ag-ui/protocol
@language-lit/material3-expressive-ag-ui/styles.css
@language-lit/material3-expressive-ag-ui/copilotkit
```

`./copilotkit` implements the reserved path with owner approval; see
[ADR 0004](adr/0004-copilotkit-adapter-and-hardening.md). Adding, renaming, or
removing another public path requires owner approval and an ADR.

- **`.`** — the React surface. Carries `'use client'`. Exports `useAgent`,
  `AgentProvider` and its hooks, the ten components, and the timeline types.
- **`./copilotkit`** — carries `'use client'`. Exports the eleven v1 renderer
  slots from ADR 0003, their props types, the unified `RenderMessage` slot and
  `copilotKitComponents` preset. Targets CopilotKit 1.71.x. It MUST NOT use the
  native agent binding, and the native entry MUST NOT import this adapter or
  either optional CopilotKit peer. CopilotKit owns generative UI and interrupts.
- **`./protocol`** — the React-free surface. Exports `projectTimeline`,
  `createRunOverlay`, `reduceRunOverlay`, `parsePartialJson`, and the types. It
  MUST NOT import React, touch the DOM, or carry `'use client'`, so it stays
  usable from server modules, non-React hosts, and plain unit tests. CI SHOULD
  verify this by inspecting the built chunk's imports.
- **`./styles.css`** — one precompiled stylesheet. It defines no tokens, ships
  no reset, and every selector in it MUST live under the `.m3e-agui` namespace.
  `scripts/build-styles.mjs` enforces that and fails the build otherwise. It is
  compiled by lightningcss against the targets in `docs/browser-support.json`,
  which MUST stay aligned with the design system's own support floor — a
  consumer loads both stylesheets, so a wider floor here would be a false
  promise.

### 2.1 Dependency policy

The package MUST ship **zero runtime dependencies**. `@ag-ui/client`,
`@ag-ui/core`, `@language-lit/material3-expressive`, `react`, and `react-dom`
are peers. Anything the package needs but a peer does not provide is
implemented in-house or not used — `parsePartialJson` exists for exactly this
reason.

`@copilotkit/react-core` and `@copilotkit/react-ui` are optional peers used only
by `./copilotkit`. Neither the protocol nor native surface requires them.

## 3. Architecture

### 3.1 The transcript is the agent's, not the UI's

`AbstractAgent` already persists a seven-role transcript (`developer`, `system`,
`assistant`, `user`, `tool`, `activity`, `reasoning`) and already runs event
verification, chunk expansion, and message assembly. A UI that also reduced the
raw event stream into its own message list would maintain a second, divergent
copy of a state machine the SDK owns.

So the render model is a **projection**: `projectTimeline(messages, overlay)`
reads `agent.messages` and returns a flat `TimelineNode[]`. Tool messages are
indexed by `toolCallId` and merged back onto the call that issued them, so a
call and its result render as one node. An orphaned tool message is still
emitted rather than dropped.

### 3.2 The run overlay covers what the transcript cannot say

A transcript cannot express *which message is still streaming*, *which step is
running*, *what phase the run is in*, or *how it failed*. `reduceRunOverlay` is
a pure reducer over the event stream that tracks exactly those ephemeral facts
and nothing that the transcript already holds. Unknown event types MUST be
inert: the reducer returns the same overlay reference, so a protocol version
that adds events cannot break a UI built against this one.

See [ADR 0002](adr/0002-projection-over-duplicated-state.md).

### 3.3 The React binding

`createAgentStore` adapts the mutable agent to `useSyncExternalStore`, which is
what makes the binding tear-free under concurrent rendering. Two properties are
load-bearing:

- The agent subscription is attached on the first listener and detached on the
  last, so an unmounted thread leaves nothing behind.
- Notifications are coalesced into one per microtask. A streaming run fires
  `onEvent` *and* `onMessagesChanged` for the same token; publishing on each
  would re-render the thread two or three times per token.

`useAgent` is the only hook that reads the store. `AgentProvider` is the only
place `useAgent` is called, so a thread and its composer share one run rather
than starting two.

### 3.3.1 Editing and approval guards

The native binding MUST reject `setState` during a run and MUST reject
overlapping run/resume calls. `useAgentDraft` holds JSON-compatible drafts
separately from incoming SDK state. It MUST preserve drafts until explicitly
replaced or the agent identity changes. Review and approval MUST compare the
displayed/reviewed proposal with live agent state; approval carries proposal
identity, expected revision and draft changes in the resume payload.

`AgentProvider.interruptRenderer` permits a versioned form in the stock thread.
The default `InterruptPrompt` MUST require explicit review when its captured
state changes and MUST recheck at click time via `expectedState`.
Backend atomic revision validation and authorization remain application duties.
See [ADR 0005](adr/0005-drafts-and-guarded-approval.md). These safeguards ship
in 0.2.0.

### 3.4 Streaming tool arguments

`TOOL_CALL_ARGS` deltas mean a tool call's arguments are unparseable JSON for
most of their life. `parsePartialJson` repairs a truncated prefix — closing open
strings, dropping a half-written key, trimming a dangling `,` or `:` or literal,
appending the missing closers — and reports whether the result is `complete`.
Generative-UI renderers therefore receive a usable object on the first delta and
can render progressively, which is the whole point of streaming arguments.

## 4. Accessibility

The design system's components carry native semantics; this package MUST NOT add
`role`, `tabIndex`, or synthesised activation on top of them. It owns only what
the platform cannot infer.

- **One live region per thread.** `RunStatus` is a single `role="status"` and is
  the thread's only announcement point. The transcript MUST NOT be a live
  region: a streaming reply would re-announce on every token. `RunStatus` stays
  mounted while idle so assistive technology has a stable region to watch, and
  its spinner is `aria-hidden` because the region's text is what gets announced.
- **Disclosures are real buttons** with `aria-expanded` and `aria-controls`.
  Reasoning and tool-call details are collapsed by default.
- **Icon-only controls carry `aria-label`** — send and stop, at minimum.
- **The composer** sends on Enter, inserts a newline on Shift+Enter, and MUST
  respect IME composition: a key event with `isComposing` set MUST NOT send.
- **Activity** renders as a definition list, so a key/value payload is exposed
  as pairs rather than as a flattened string.
- Motion driven by this package MUST be guarded by `prefers-reduced-motion`.

## 5. Quality bar

CI MUST verify:

1. `tsc --noEmit` over `src`, `tests`, `fixtures`, and `playground`, with
   `strict` and `noUncheckedIndexedAccess`.
2. The unit suite, which MUST exercise the protocol layer against recorded event
   streams and the components against a real `AbstractAgent` subclass — never a
   hand-rolled mock that skips the SDK pipeline, which would prove nothing about
   behaviour against a real backend.
3. The build, including the CSS namespace guard.
4. That `./protocol` carries no React import and no `'use client'`.
5. The exact public export map.

Tests MUST cover, at minimum: partial-JSON repair over *every* prefix of a
streaming payload; the overlay reducer's phase, step, and error transitions;
projection including tool-result merging and orphan handling; a full
interrupt → approve → resume cycle asserting the resume array the agent
receives; and correct behaviour under `StrictMode`.

Visual and interactive behaviour is invisible to jsdom, so the playground
(`npm run playground`) MUST run the same components against the same scripted
agent with no backend, and SHOULD be checked in both color modes before release.

## 6. Deliberate deviations from the design system's repository conventions

- **Component types live in `<Name>.tsx`, not `<Name>.types.ts`.** The design
  system splits them because its components carry large discriminated prop
  unions consumed by its documentation pipeline. These components have small
  prop surfaces and no such pipeline; a second file per component would be
  ceremony. If a prop union here ever grows a documented variant axis, this
  deviation SHOULD be revisited.
- **No `component-inventory.json`.** That file backs the design system's
  conformance claim against the Material specification. This package implements
  no Material component; it composes them.
