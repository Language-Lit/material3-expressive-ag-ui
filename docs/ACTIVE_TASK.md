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

## Next task

## T02 — CopilotKit adapter

Status: not started; requires owner approval

Add `./copilotkit` per ADR 0003: components satisfying CopilotKit's renderer
slots (`AssistantMessage`, `UserMessage`, `Messages`, `Input`,
`RenderTextMessage`, `RenderActionExecutionMessage`, `RenderAgentStateMessage`,
`RenderResultMessage`, `Window`, `Button`, `Header`), with
`@copilotkit/react-core` and `@copilotkit/react-ui` as optional peers, reusing
the presentational components and the CSS namespace, and sharing none of the
`useAgent` binding.
