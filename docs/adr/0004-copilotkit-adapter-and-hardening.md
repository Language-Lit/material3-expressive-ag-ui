# ADR 0004: Implement the CopilotKit v1 slot adapter and harden the native binding

Status: accepted
Date: 2026-09-10
Owner approval: fix the reviewed problems and implement the remaining adapter.

## Decision

Activate the path reserved in ADR 0003. The exact public export map is now `.`,
`./protocol`, `./styles.css`, and `./copilotkit`. This explicitly approved change
supersedes ADR 0003's deferred implementation and the previous three-path limit.
The package remains unreleased; publishing is a separate action.

The adapter targets `@copilotkit/react-core` and `@copilotkit/react-ui` 1.71.x,
tested at 1.71.0. Both are optional peers, external to all bundles. CopilotKit's
current v1 slots receive AG-UI messages, not legacy GraphQL message objects.
The eleven slots recorded in ADR 0003 remain exported, and `RenderMessage` is
also exported because current v1 uses that unified slot. `copilotKitComponents`
is a ready-to-spread preset for the current v1 chat, popup and sidebar props.
It includes the layout class; consumers adding a class must retain it.

CopilotKit v1 is deprecated upstream. The differently shaped v2 slot API is not
claimed as supported. The narrow peer range makes the tested contract explicit;
widening it requires compatibility checks. See the upstream
[v1 reference](https://docs.copilotkit.ai/reference/v1/index).

CopilotKit owns the run, tool-renderer registration, generative UI, and interrupt
handling. The adapter preserves generative UI and its before/after placement,
and renders CopilotKit's interrupt element. It never creates the native store
or mounts `AgentProvider`. Plain messages without supplied generative UI receive
Material tool cards. When CopilotKit supplies its own renderer wrapper, that
wrapper is authoritative, including when it renders nothing. Applications can
register a Material fallback through CopilotKit's `useDefaultTool`; the
playground demonstrates this without altering an application's registry.

Shared presentation components remain props-driven. The adapter uses Material
controls throughout, including a modal `Dialog` for the window slot, with native
focus management and controlled outside-click/Escape dismissal. A single status
region belongs to each adapter message list; custom application renderers must
coordinate their own announcements. Text remains plain; markdown rendering is
outside this package's scope. Media rendering is delegated through the image
slot; other attachment kinds receive a type label.

## Native lifecycle repairs

SDK lifecycle notifications complement protocol events: `onRunFailed` records
transport errors (except cancellation), and `onRunFinalized` clears active
streaming/step markers even without a terminal protocol event. Finalization
explicitly records that the run ended because the SDK may notify before resetting
`isRunning`. DOM handlers consume rejected promises after the shared status has
reported them; imperative `send`/`run` still reject for callers.

Projection indexes issuing calls across the whole transcript before emitting
orphan results, preventing duplicate keys when a result precedes its call.

## Verification

CI runs types, SDK-backed native and CopilotKit integration tests, build, and
package inspection. Inspection traverses built imports to enforce optional-peer
isolation, protocol server safety, client directives and zero dependencies. It
also checks source design values and public design-system imports. CSS namespace
validation requires an owned selector prefix and rejects private `.m3e-*`
selectors. Browser checks remain necessary for geometry and focus behavior.
