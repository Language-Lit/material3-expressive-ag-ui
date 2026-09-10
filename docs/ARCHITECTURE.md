# Architecture

How an AG-UI run becomes Material 3 pixels, and why each seam is where it is.
The normative rules are in [SPEC.md](SPEC.md); this document explains the
implementation.

## The layers

```text
@ag-ui/client  AbstractAgent          transport, event verification, transcript
      │
      │  agent.messages   (the durable seven-role transcript)
      │  agent.subscribe  (the live event stream)
      ▼
src/protocol/                          React-free — published as ./protocol
      run-state.ts      reduceRunOverlay(overlay, event) -> RunOverlay
      project.ts        projectTimeline(messages, overlay) -> TimelineNode[]
      partial-json.ts   parsePartialJson(raw) -> { value, complete, valid }
      ▼
src/runtime/                           the React binding
      agent-store.ts    useSyncExternalStore adapter over the mutable agent
      useAgent.ts       snapshot -> timeline + actions
      agent-context.tsx one run per provider; the tool-renderer registry
      ▼
src/components/                        Material 3 Expressive surfaces
      ▼
@language-lit/material3-expressive     Surface, Card, Button, Text, Icon, …
```

Each arrow crosses exactly one concern. The protocol layer knows nothing about
React; the runtime layer knows nothing about Material; the components know
nothing about transport.

## Reading a run

**`agent.messages` is the conversation.** The SDK persists all seven roles and
handles the awkward parts — interleaved messages, out-of-order tool results,
resumed runs. Re-reducing the raw event stream into a second message list would
be a second implementation of that, so `projectTimeline` reads what the agent
already holds. See [ADR 0002](adr/0002-projection-over-duplicated-state.md).

**The overlay is what a transcript cannot say.** A message list cannot express
*which message is mid-stream*, *which step is running*, *what phase the run is
in*, or *how it failed*. `reduceRunOverlay` tracks exactly that:

| Field | Source events | Renders as |
| --- | --- | --- |
| `phase` | `RUN_STARTED`, `RUN_FINISHED`, `RUN_ERROR` | the status region's mode |
| `runId`, `threadId` | `RUN_STARTED` | correlation |
| `steps` | `STEP_STARTED`, `STEP_FINISHED` | the named step in `RunStatus` |
| `subagents` | `SUBAGENT_STARTED`, `SUBAGENT_FINISHED` | reserved |
| `streamingMessageIds` | `TEXT_MESSAGE_START` / `_END` | the caret on the live turn |
| `streamingToolCallIds` | `TOOL_CALL_START` / `_END` | `ToolCallStatus: 'streaming'` |
| `error` | `RUN_ERROR` | the `ErrorNode` and the status region |

An event type the reducer does not handle returns **the same overlay
reference**. Unknown events are inert by design, so a newer protocol version
cannot break a UI built against this one.

**Projection merges calls with their results.** `projectTimeline` indexes `tool`
messages by `toolCallId` in a first pass, then walks the assistant messages and
attaches each result to the call that issued it — one `ToolCallNode` carrying
both. A tool message whose call is missing is still emitted, with `name: ''`,
rather than dropped: losing a result silently is worse than rendering an
unattributed one. Interrupts, then the overlay error, are appended last.

The output is a flat `TimelineNode[]`:

```text
UserNode | AssistantTextNode | ReasoningNode | ActivityNode
        | ToolCallNode | InterruptNode | ErrorNode
```

Flat, not a tree, because that is what a transcript is and what a renderer wants.

## Binding a mutable agent to React

`AbstractAgent` mutates `messages`, `state`, and `isRunning` in place and
announces changes through subscriber callbacks. React wants the opposite: an
immutable snapshot whose identity changes exactly when something changed.
`createAgentStore` is that adapter, shaped for `useSyncExternalStore` so
concurrent rendering cannot tear.

Two details are load-bearing:

- **Lazy attach, eager detach.** `agent.subscribe` runs on the first listener
  and unsubscribes on the last, so an unmounted thread leaves no subscriber
  behind. On subscribe the snapshot is rebuilt, because a run may have advanced
  between store creation and subscription.
- **One notification per microtask.** A streaming run fires `onEvent` *and*
  `onMessagesChanged` for the same token. Publishing on each would re-render the
  whole thread two or three times per token, so `publish()` coalesces through
  `queueMicrotask`.

`useAgent(agent, options)` reads that store and returns the render model plus the
actions: `send`, `run`, `stop`, `resolveInterrupt`, `setState`. The agent itself
is owned by the caller, so the same instance can be shared across routes,
persisted, or driven from outside React.

`AgentProvider` is the **only** place `useAgent` is called. Two components each
calling it would create two stores over one agent and, worse, two independent
`send` paths. The provider also carries the tool-renderer registry.

## Streaming tool arguments

`TOOL_CALL_ARGS` arrives as deltas, so a call's arguments are invalid JSON for
most of their life. `parsePartialJson` makes them usable anyway:

1. `scan()` walks the string once, tracking the closer stack, whether it is
   inside a string or an escape, and the last safe value boundary.
2. `repairPrefix()` closes an open string, drops a half-written key, trims a
   dangling `,`, `:`, or partial literal, and appends the missing closers.
3. If the repaired text still does not parse, it retries over progressively
   shorter prefixes, up to `MAX_ATTEMPTS`.

It reports `{ value, complete, valid }`, so a renderer can tell a finished
argument object from a partial one. This is why generative UI can render on the
first delta instead of waiting for `TOOL_CALL_END`.

`@ag-ui/client` solves the same problem with `untruncate-json`. This package
ships zero runtime dependencies, so it is implemented here and tested against
*every* prefix of a payload.

## Human in the loop

A run that needs permission finishes with `RUN_FINISHED` carrying
`outcome: { type: 'interrupt', interrupts }`. The agent exposes
`pendingInterrupts`; projection appends an `InterruptNode` per entry;
`InterruptPrompt` renders it. Answering calls `buildResumeArray` — the SDK's own
helper, so the resume shape stays the SDK's business — and starts a new run with
`{ resume }`. The transcript continues; nothing is replaced.

## Components

Ten components. Each is a directory of `<Name>.tsx`, `<Name>.css`, and
`index.ts`. Types live in the `.tsx` — a deliberate deviation from the design
system's `<Name>.types.ts` split, recorded in [SPEC.md §6](SPEC.md).

| Component | Renders | Notes |
| --- | --- | --- |
| `AgentChat` | thread + status + composer | the one-line integration |
| `MessageThread` | the timeline | sticks to the bottom only while pinned |
| `UserMessage` | `UserNode` | `primary-container` bubble, `shape="large"` |
| `AssistantMessage` | `AssistantTextNode` | flush text; caret while streaming |
| `ReasoningDisclosure` | `ReasoningNode` | collapsed; handles encrypted reasoning |
| `ToolCallCard` | `ToolCallNode` | passive outlined `Card`; status glyph |
| `ActivityRow` | `ActivityNode` | `<dl>` of the payload's pairs |
| `InterruptPrompt` | `InterruptNode` | `tertiary-container`; approve / cancel |
| `RunStatus` | the overlay | the thread's only `role="status"` |
| `Composer` | input | Enter sends; send/stop swap; IME-safe |

Presentational components take a node as a prop and read context only for what is
genuinely ambient. That keeps them reusable by the CopilotKit adapter,
whose slots supply data from CopilotKit rather than from `useAgent`
([ADR 0003](adr/0003-reserved-copilotkit-entry-point.md)).

### CopilotKit adapter

`src/copilotkit/` is a separate entry point over the shared presentation
components. It consumes CopilotKit 1.71.x v1 slot props and ambient CopilotKit
context, never the native runtime. Its eleven named slots and unified
`RenderMessage` preserve CopilotKit-owned generative UI, callbacks and interrupts.
The `copilotKitComponents` preset includes the current slots and layout class.
See [ADR 0004](adr/0004-copilotkit-adapter-and-hardening.md) for compatibility
and fallback-renderer semantics.

Transport failures and cancellation are finalized in the native store through
SDK lifecycle callbacks, since they need not produce terminal protocol events.
The transcript remains the SDK's; only ephemeral overlay state is repaired.

### Two rules the components never break

**Nothing reaches into library internals.** `.m3e-*` class names are private.
Where a library component needed different geometry — the 16px spinner in
`RunStatus` and `ToolCallCard` — it is set through the sanctioned alias
(`--m3e-comp-circular-progress-diameter`) on an ancestor, never by sizing a
wrapper and clipping.

**Every selector lives under `.m3e-agui`.** `scripts/build-styles.mjs` inlines
the component stylesheets, then walks the result and throws on any selector
outside the namespace. The guard strips comments first, skips at-rule preludes,
and allows keyframe selectors. It has been verified non-vacuously by feeding it
a violating rule and confirming it fails.

## Testing

`fixtures/scripted-agent.ts` is a real `AbstractAgent` subclass that replays an
event array through an rxjs `Observable`, optionally paced. It is not a mock:
events flow through the SDK's verification, chunk expansion, and transcript
assembly, so a passing test says something about behaviour against a real
backend. `pace: 0` emits synchronously for fast tests; a non-zero pace exercises
the streaming path.

The suite covers the protocol layer directly (including a fuzz over every prefix
of a streaming JSON payload), the components against scripted runs, a full
interrupt → approve → resume cycle asserting the resume array the agent
receives, and `StrictMode`.

The playground (`npm run playground`) runs the same components against the same
fixture with five scenarios and no backend, because layout, state layers,
elevation, focus rings, and color mode are invisible to jsdom. It builds from
`src`, never `dist`, so what is on screen is the source.
