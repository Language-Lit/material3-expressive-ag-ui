# ADR 0002: Project the agent's transcript; do not duplicate its state machine

Status: accepted
Date: 2026-09-10

## Context

A chat UI for a streaming protocol has to decide where the conversation lives.
Two designs are available.

The first is for the UI to subscribe to the raw event stream and reduce it into
its own message list: `TEXT_MESSAGE_START` opens a message, each
`TEXT_MESSAGE_CONTENT` appends, `TOOL_CALL_START` opens a call, and so on. This
is what most protocol chat UIs do.

The second is to let the SDK own the conversation and render what it holds.
`AbstractAgent` already persists a seven-role transcript — `developer`,
`system`, `assistant`, `user`, `tool`, `activity`, `reasoning` — and already
performs event verification, chunk expansion, and message assembly, including
the parts that are easy to get wrong: interleaved messages, tool results
arriving out of order, and resumed runs.

The first design means maintaining a second implementation of a state machine
the SDK owns. Every protocol change lands twice, and the two copies drift in the
gap between releases.

## Decision

The transcript is the agent's. The UI projects it.

`projectTimeline(messages, overlay, options)` maps `agent.messages` to a flat
`TimelineNode[]`. Tool messages are indexed by `toolCallId` first and merged
onto the assistant tool call that issued them, so one call and its result render
as one node; an orphaned tool result is still emitted rather than silently
dropped.

What the transcript cannot express is held in a small **run overlay**:
which messages and tool calls are still streaming, which steps are running,
which subagents are active, the run phase, and the error. `reduceRunOverlay` is
a pure reducer over the event stream covering exactly that and nothing the
transcript already holds.

Unknown event types are inert by construction — the reducer returns the same
overlay reference — so a protocol version that adds events cannot break a UI
built against this one.

## Consequences

- Protocol semantics have one implementation, in the SDK. Bug fixes there are
  inherited rather than reimplemented.
- The projection is a pure function of `(messages, overlay)`, so the whole render
  model is testable with no React, no DOM, and no timers. This is why
  `./protocol` can be a public, server-safe entry point.
- The UI cannot render anything the SDK does not persist. Where that bites —
  streaming identity, step progress, failure — the overlay covers it explicitly,
  and any future gap must be closed by an overlay field with a stated reason,
  not by shadowing the transcript.
- Projection runs on every snapshot. It is memoised on the snapshot identity,
  and the store coalesces notifications to one per microtask, so a streaming run
  projects once per frame's worth of tokens rather than once per token.
