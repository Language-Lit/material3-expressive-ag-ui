# Active task

## T01 — AG-UI vertical slice

Status: complete
Approved: 2026-09-10
Completed: 2026-09-10

### Scope

Stand up the package with a working end-to-end slice rather than a scaffold:
the protocol projection, the React binding, the Material 3 components, a
playground that runs with no backend, and tests over recorded event streams.

Delivered:

- Repository, build (tsup: ESM + types), CSS pipeline with the `.m3e-agui`
  namespace guard, and the `.` / `./protocol` / `./styles.css` export map.
- `docs/SPEC.md`, `docs/ARCHITECTURE.md`, ADRs 0001–0003, `README.md`,
  `AGENTS.md`.
- `src/protocol/` — `timeline.types.ts`, `partial-json.ts`, `run-state.ts`,
  `project.ts`. React-free and verified as such in the built chunk.
- `src/runtime/` — `agent-store.ts`, `useAgent.ts`, `agent-context.tsx`.
- Ten components with token-only CSS.
- `fixtures/scripted-agent.ts` and the playground's five scenarios.
- Unit tests across the protocol layer, the components, and `StrictMode`.

### Out of scope, deliberately

- **The CopilotKit adapter.** Specified and its entry point reserved by
  ADR 0003; not implemented. This is T02.
- Publishing. The package is unreleased and has never been pushed to a registry.

### Acceptance checks

1. `npm run verify` passes.
2. `dist/protocol.js` and its shared chunk import nothing but `@ag-ui/core`, and
   carry no `'use client'`.
3. `dist/styles.css` contains no selector outside `.m3e-agui`.
4. The playground completes all five scenarios in both color modes.

### Verification record (2026-09-10)

`npm run verify` green: typecheck clean, 52 tests passing, build and namespace
guard clean. `dist/protocol.js` and its shared chunk import only `@ag-ui/core`,
contain no React and no `'use client'`. No selector in `dist/styles.css` falls
outside `.m3e-agui`.

In the browser, all five scenarios ran to completion — streaming text with
reasoning and a merged tool result, steps with an activity definition list, the
`show_weather` generative renderer replacing the default card, an approval
prompt resumed through `buildResumeArray`, and a failed run reported in both the
transcript and the status region. Light and dark were both checked.

One defect was found and fixed there: the color-mode picker set `colorMode` on
`Material3Provider` only, so `body` — painted by the page but outside that
scope — stayed dark while the chat went light. `playground/App.tsx` now also
writes the mode to the document element, and the README records the trap for
consumers, who will hit it whenever a chat fills a page.

Note for future browser checks: a background tab throttles timers and serves a
stale painted frame to screenshots, so a paced run can look stalled when it has
already finished. Read the live DOM before concluding otherwise.

## Current task

## T02 — CopilotKit adapter

Status: complete
Approved: 2026-09-10 (owner: fix the problems and implement what remains)
Completed: 2026-09-10

### Scope and expected files

Harden the existing slice before adding the adapter: repair run finalization and
transport errors, deduplicate out-of-order tool results, exercise cancellation
through the real SDK, remove design-system violations, and enforce package
boundaries in CI. Expected files: `src/protocol/`, `src/runtime/`, affected
`src/components/`, `fixtures/`, `tests/`, `scripts/`, and `.github/workflows/`.

Implement the adapter below in `src/copilotkit/`, with the separate build target,
optional peers, shared stylesheet, tests and playground coverage. Update
`package.json`, the lockfile, build configuration, README, specification,
architecture and ADRs to describe the approved fourth export. Publishing is
outside this task.

### Acceptance checks

1. Regression tests exercise cancellation and failures through `AbstractAgent`.
2. All eleven adapter slots satisfy installed CopilotKit contracts and have
   interaction/rendering coverage without the native `AgentProvider`.
3. `npm run verify` checks types, tests, build, exact exports, zero runtime
   dependencies, server-safe protocol and optional-peer isolation.
4. Playground interactions and rendering are checked in light and dark modes.

Add `./copilotkit` per ADR 0003: components satisfying CopilotKit's renderer
slots (`AssistantMessage`, `UserMessage`, `Messages`, `Input`,
`RenderTextMessage`, `RenderActionExecutionMessage`, `RenderAgentStateMessage`,
`RenderResultMessage`, `Window`, `Button`, `Header`), with
`@copilotkit/react-core` and `@copilotkit/react-ui` as optional peers, reusing
the presentational components and the CSS namespace, and sharing none of the
`useAgent` binding.

### Verification record

- `npm run verify`: typecheck, 65 tests across eight files, ESM/declaration
  build, stylesheet guard and package-boundary inspection pass.
- `npm run playground:build` and `git diff --check` pass.
- Real `CopilotKit`/`CopilotChat` tests run a `ScriptedAgent` through the SDK:
  send, registered generative renderer, stop, interrupt/approve/resume, rejected
  input recovery, IME/newlines, feedback, and popup controls. Native tests cover
  transport failure, cancellation and out-of-order tool results.
- Headless Chrome: all five scenarios complete in both light and dark modes
  for both native and CopilotKit demos, with no page errors. Screenshots were
  inspected. The popup composer stays inside the dialog; at 390px the page has
  no horizontal overflow; Escape closes the dialog and restores launcher focus.
  Browser QA found and corrected the popup chat-wrapper flex layout and the
  playground's wrapping controls.
- The exact four exports, client directives, React/DOM-free protocol, absence
  of runtime dependencies, and separation from optional CopilotKit peers are
  enforced by `scripts/verify-package.mjs` and `.github/workflows/verify.yml`.
- CopilotKit support is explicitly 1.71.x v1 slots; upstream's different v2
  slot API is not part of this task. Application-owned tool/interrupt renderers
  remain authoritative. The README and ADR 0004 document setup and limitations.
- Development tooling: Vitest updated to 4.1.11 to resolve its reported
  advisory. npm still reports one low-severity esbuild development-server
  advisory through the existing build toolchain; no runtime dependencies ship.

### Remaining

Publishing is not performed.

## T03 — CopilotKit playground layout

Status: complete
Approved: 2026-09-10 (owner: fix the UI bugs shown in the CopilotKit playground)
Completed: 2026-09-10

### Scope and expected files

Repair the clipped CopilotKit introduction and missing or hidden popup launcher
shown in the playground, including any directly related responsive containment
issue. Expected files are the playground shell and, only if the defect is in the
adapter rather than its host, the CopilotKit launcher/window styles.

### Acceptance checks

1. The AG-UI and CopilotKit playground modes render without clipped content at
   desktop and mobile widths.
2. The CopilotKit launcher remains visible and opens a usable popup.
3. Both light and dark color modes are visually checked.
4. `npm run verify` passes.

### Verification record

- Live-browser geometry confirmed the popup launcher was correctly fixed to the
  viewport but clipped by the playground surface's `overflow: hidden`; the
  CopilotKit introduction also started on that exact clipping edge.
- CopilotKit mode now permits its viewport-level popup controls to escape the
  demo surface, while native AG-UI mode retains clipped chat containment.
- The introduction and lazy-loading state have a consistent inset and reset
  margin.
- Desktop dark (1756px), desktop light (1280px), and mobile dark (390px) checks
  show a visible launcher, an opening dialog within the viewport, no horizontal
  overflow, and no page errors.
- `npm run verify` passes: typecheck, 65 tests, build, stylesheet guard, and
  package-boundary inspection are green.

## T04 — Initial public release

Status: active
Approved: 2026-09-10

### Scope and expected files

Prepare and publish version 0.1.0 as the package's initial public npm release.
Update the README's release status and record the release here, verify and
inspect the final tarball, commit and push the preparation, then publish only
after the owner's separate final confirmation. After publication, verify clean
installation from npm and create the matching `v0.1.0` Git tag and GitHub
release. Expected files: `README.md` and `docs/ACTIVE_TASK.md`.

### Acceptance checks

1. The packaged README identifies 0.1.0 as the initial release.
2. `npm run verify` and the final `npm pack --dry-run` pass from a clean tree.
3. `@language-lit/material3-expressive-ag-ui@0.1.0` is publicly available from
   the npm registry and installs successfully in a clean consumer fixture.
4. The `v0.1.0` tag and GitHub release point to the published commit.
