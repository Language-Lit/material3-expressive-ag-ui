# Repository instructions

## Required context

Before changing this package, read:

1. `docs/SPEC.md`
2. `docs/ACTIVE_TASK.md`
3. `docs/ARCHITECTURE.md`
4. The ADRs relevant to the change in `docs/adr/`

The specification is normative. Only the task recorded in `ACTIVE_TASK.md` may
be implemented. State a new task's scope, expected files, and acceptance checks
and obtain owner approval before changing its status to active.

## Safety boundary

- Private downstream applications are outside this repository. Never record
  their internals here or read/edit their repositories as part of package work.
- **`@language-lit/material3-expressive` is a peer, not a subtree.** Never edit
  it from here, never patch `node_modules`, and never fork one of its components
  to change its geometry. A genuine defect or gap there is reported to that
  repository with a reproduction; work around it in this package's own code only
  if the workaround is idiomatic.
- The package exports exactly `.`, `./protocol`, `./styles.css`, and
  `./copilotkit` (approved by ADR 0004). Adding, renaming, or
  removing a public path is a breaking change that requires owner approval and
  an ADR.
- The package ships no runtime dependencies. Everything else is a peer. If a
  change needs a library a peer does not provide, implement it here or do
  without it — do not add a dependency without an ADR.
- `./protocol` must stay free of React and of DOM access. It is a public,
  server-safe entry point.

## Design system rules that apply here without exception

This package is a consumer of the design system, held to the same standard as
any application:

- Never target a `.m3e-*` selector and never use `!important` against a library
  class. The sanctioned override surface is `--m3e-comp-*` custom properties set
  on an ancestor this package owns.
- Import only the four public entry points. No deep imports.
- Every color, type style, corner, duration, easing, elevation, and state
  opacity must resolve to an `--m3e-*` token. A literal hex, px font size, px
  radius, or `200ms ease` in this package's CSS is a defect even when it matches
  the current theme, because it will not follow theme, density, color mode, or
  reduced motion.
- Use the shipped component rather than re-implementing it. A hand-written
  `div` "card", "chip", or "button" here is the defect.
- The components render real `button`, `input`, and `dialog` elements. Do not
  add `role`, `tabIndex`, or synthesised activation on top of them. Do supply
  what the platform cannot infer: accessible names for icon-only controls,
  label association, heading structure, live-region policy.

## Conventions

- Follow the layers in `docs/ARCHITECTURE.md`. The protocol layer knows nothing
  about React; the runtime layer knows nothing about Material; the components
  know nothing about transport.
- Every selector this package writes lives under the `.m3e-agui` namespace. The
  build enforces it.
- One directory per component: `<Name>.tsx`, `<Name>.css`, `index.ts`. Types
  live in the `.tsx` — a deliberate deviation from the design system's
  `<Name>.types.ts` split, recorded in `docs/SPEC.md` §6.
- Public components use named exports and exported props types.
- Presentational components take their data as props and read context only for
  what is genuinely ambient, so the CopilotKit adapter can reuse them.
- Do not deep-import another component's private files.
- Record cross-component or public-API decisions in an ADR.
- The library ships no icon font. Glyphs are hand-authored SVG in
  `src/internal/icons.tsx`, with no `fill` and no intrinsic size, so
  `currentColor` and the `Icon` component own color and sizing.

## Verification

Use the narrowest relevant command while iterating. Before completing a task:

```bash
npm run verify   # typecheck + test + build
```

Tests must exercise the real SDK pipeline. `fixtures/scripted-agent.ts` is an
`AbstractAgent` subclass, not a mock: a test that bypassed event verification,
chunk expansion, and transcript assembly would prove nothing about behaviour
against a real backend. Do not replace it with a stub.

The unit tests run in jsdom, which has no layout and no paint. After changing
component geometry, elevation, state layers, or color, also look at it:

```bash
npm run playground   # http://localhost:5273
```

Check both color modes. Note that a **background browser tab** throttles timers
and serves a stale painted frame to screenshots, so a paced run can look stalled
when it has already finished — read the live DOM before concluding otherwise.
