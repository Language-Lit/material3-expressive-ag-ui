# ADR 0003: `./copilotkit` is reserved, not implemented

Status: accepted (implementation deferred)
Date: 2026-09-10

## Context

Two audiences want Material 3 agent UI, and they arrive through different doors.

The first drives AG-UI directly: they hold an `AbstractAgent`, and they want a
React binding and components. That is the `.` entry point.

The second is already on CopilotKit, which renders `CopilotChat` and exposes
renderer slots — `AssistantMessage`, `UserMessage`, `Messages`, `Input`,
`RenderTextMessage`, `RenderActionExecutionMessage`, `RenderAgentStateMessage`,
`RenderResultMessage`, `Window`, `Button`, `Header`. For them the ask is not a
binding at all: it is a set of components that satisfy those slot contracts, with
CopilotKit still owning the run.

Serving the second audience from the first entry point would be wrong. The slot
components receive CopilotKit's props, not this package's timeline nodes, and
CopilotKit's runtime would become a peer of the AG-UI-native surface for users
who never installed it.

## Decision

`./copilotkit` is reserved as a public path and left unimplemented in `0.1.0`.

The package ships `.` and `./protocol` now. The adapter will be additive: a
separate entry point, a separate build target, `@copilotkit/react-core` and
`@copilotkit/react-ui` as **optional** peers, and no import from `.` back into
it.

The two surfaces will share the presentational components and the CSS namespace.
They will not share the binding: `useAgent` and `AgentProvider` are for the
AG-UI-native surface only, since under CopilotKit the run is CopilotKit's.

## Consequences

- `0.1.0` serves the AG-UI-native audience completely and the CopilotKit
  audience not at all. The README must say so plainly rather than implying
  coverage.
- Reserving the path now means adding it later is additive, not breaking.
- The presentational components must stay independent of `useAgent` — they take
  data as props and read context only for what is genuinely ambient. This is a
  constraint on the current slice, honoured so the adapter does not require
  rewriting them.
- Pinning the slot list here records what the adapter is measured against, so
  the deferred work has a definition of done rather than an open-ended surface.
