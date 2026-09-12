# Active task

## T10 — 0.2.1 peer compatibility patch

Status: active
Approved: 2026-09-12 (owner requested the documentation site update, which
requires a clean installation alongside the published `1.3.0-rc.1` core
candidate.)

### Scope and expected files

Publish the patch release that expands only the core-library peer range to
include the published `>=1.3.0-rc.1 <1.4.0` prerelease line. Update package and
lockfile versions, the specification release version, and this task record.
Verify the package, a clean registry installation with core `1.3.0-rc.1`, and
the site dependency resolution. No API, implementation, or dependency changes
are in scope.

### Acceptance checks

1. `npm run verify` passes at `0.2.1`.
2. npm publishes `0.2.1` with the expanded core peer range.
3. A clean install resolves `0.2.1` with core `1.3.0-rc.1` without peer errors.


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

Status: complete
Approved: 2026-09-10
Completed: 2026-09-10

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

### Verification record

- `npm run verify` passes: typecheck, 65 tests, build, stylesheet guard, and
  package-boundary inspection are green.
- npm's publish dry run reported a 59.8 kB public tarball containing the
  expected 21 files. Version 0.1.0 is published under the `latest` tag with
  public access, and its registry metadata records git commit `6be4959`.
- A clean temporary consumer installed version 0.1.0 from the npm registry and
  successfully imported the native React entry, the React-free protocol entry,
  and the stylesheet export.
- Annotated tag `v0.1.0` and the corresponding public GitHub release point to
  the published commit.

## T05 — README for AG-UI discovery

Status: complete
Approved: 2026-09-11 (owner: implement the README audit; media to follow)
Completed: 2026-09-11

### Scope and expected files

Revise `README.md` around the live demo, native and CopilotKit integration
routes, quick start, compatibility, and author attribution. Move detailed
adapter guidance into `docs/COPILOTKIT.md`. Record work in this file.
Use existing demo links; the owner will provide images or recordings later.

### Acceptance checks

1. README links and examples match the existing files and public API.
2. Setup states endpoint requirements, peer dependencies, and rendering limits.
3. Adapter guidance remains available through a linked consumer guide.
4. `git diff --check` and `npm run verify` pass.

### Verification record

- README now leads with demo/docs links, npm and CI badges, benefits, and the
  native/CopilotKit integration choices. Endpoint requirements, peer versions,
  plain-text limitations, and author attribution are explicit.
- Adapter details are preserved in `docs/COPILOTKIT.md`; local links and
  section anchors pass an automated existence check. The demo URL returns 200.
- `npm run verify` passes: typecheck, all 65 tests, build, stylesheet guard,
  and package-boundary checks. `git diff --check` passes.
- No product geometry changed. Images and recordings are deferred to the owner.

## T06 — Publish README preview and repository presentation

Status: complete
Approved: 2026-09-11 (owner: add preview, commit/push, and update GitHub metadata)
Completed: 2026-09-11

### Scope and expected files

Extract a preview from the owner's recording into `docs/assets/`, link it to
the demo from `README.md`, and publish the approved T05 documentation changes.
Update GitHub's repository description, homepage, and discovery topics.
Expected files: `README.md`, `docs/assets/agent-preview.webp`, this task record,
and the already prepared `docs/COPILOTKIT.md`.

### Acceptance checks

1. Preview is visually checked and shows weather UI and the approval prompt.
2. README preview links to the live demo; `git diff --check` and `npm run verify` pass.
3. Documentation is committed and pushed, and remote metadata is confirmed.

### Verification record

- Extracted and visually inspected a cropped WebP preview from the owner's
  recording; weather and approval controls remain readable. README links the
  image to the live demo and identifies the scene as scripted.
- `npm run verify` passes: 65 tests, typecheck, build, stylesheet guard, and
  package checks. `git diff --check` passes.
- GitHub description, demo homepage, and eight discovery topics were applied
  and read back successfully. Remote main matched the local base before publication.
- T05 documentation and this preview are published together in the completing commit.

## T07 — Shared state and human interaction coverage

Status: complete
Approved: 2026-09-11 (owner: cover concurrent shared-state edits and approvals)
Completed: 2026-09-11

### Scope and expected files

Add deterministic event gates to the real scripted SDK fixture and integration
tests for state snapshots/deltas, concurrent local edits, approval/resume state,
and application-owned drafts and revision validation. Document tested guarantees
and SDK/application boundaries in `README.md` and `docs/SHARED_STATE.md`.
Expected files: `fixtures/scripted-agent.ts`, `tests/runtime/`, and these docs.
Fix package binding defects if exposed; do not invent a generic merge policy.

### Acceptance checks

1. Tests exercise real SDK verification, assembly, and state application with
   deterministic user/event interleavings, without timing sleeps.
2. Tests assert both state visible to React and state/payload sent on resume.
3. Document overwrite behavior and test a version-checked application approval.
4. `npm run verify` and `git diff --check` pass.

### Verification record

- Six new StrictMode integration cases use deterministic gates in ScriptedAgent;
  the real SDK still verifies events, expands chunks, applies state, and resumes.
- Confirmed SDK 0.0.59 can overwrite an in-flight frontend edit even with a
  delta to a different field. Recorded the boundary rather than altering SDK
  semantics or silently introducing a merge policy.
- Approve and cancel both pass the latest paused state into resume, including
  a setState/resume in the same turn before React publishes its next snapshot.
- Separate application drafts survive streamed state/text; modeled backend
  revision validation accepts a current approval and re-interrupts a stale one
  without applying the draft. This is an application contract, not a new library
  or CopilotKit guarantee.
- `npm run verify` passes: 71 tests, typecheck, build, and package checks.
  `git diff --check` passes. No production runtime or component geometry changed.

## T08 — Preserve drafts and guard approvals

Status: complete
Approved: 2026-09-11 (owner: fix shared-state overwrites and stale approval)
Completed: 2026-09-11

### Scope and expected files

Add a public draft hook, guard unsafe active-run state writes and concurrent
resumes, guard the stock approval against changed state, and expose an interrupt
renderer through AgentProvider for versioned forms inside AgentChat. Add an ADR,
SDK-backed runtime/component tests, a working playground example, and consumer
documentation. Files: src/runtime, src/internal, InterruptPrompt, MessageThread,
tests, playground, README, SPEC, ARCHITECTURE, SHARED_STATE and ADR 0005.

### Acceptance checks

1. Draft edits survive snapshots/deltas and failed or stale approvals.
2. Approval rechecks live state before sending, includes proposal identity and
   revision, and rejects duplicate/missing interrupt or active-run attempts.
3. Default approval notices changed state and requires explicit review.
4. Backend example validates revision before applying any changes.
5. Full verify and playground build pass; light/dark browser checks pass.

### Verification record

- Implemented useAgentDraft, isolated edit sessions, explicit keep/reset review,
  live proposal/state validation, revision payloads, and submission locking.
  Active native setState/run/resume conflicts now reject before mutation.
- The stock prompt blocks changed-state approval and displays the updated state
  for explicit review; an expectedState guard catches render-to-click races.
  AgentProvider.interruptRenderer supports custom versioned forms in AgentChat.
- SDK tests cover live state changes before render, proposal ID/revision/value
  changes and removal, network failure/retry, duplicate requests, reset/agent
  replacement, cancellation, and the actual playground form end to end.
- `npm run verify`: 81 tests in 12 files, typecheck, build, styles and package
  checks pass. `npm run playground:build` and `git diff --check` pass.
- Chrome checks at 1280px in light/dark and 390px verify draft retention,
  disabled stale approval, rejection after unseen server change, explicit review,
  and successful save. No page errors or horizontal overflow; screenshots inspected.
- ADR 0005 and SHARED_STATE document migration and the backend atomic validation
  contract. Native source implementation complete; CopilotKit runtime unchanged.
  Not committed, pushed, or released as part of this task.

## Current task

## T09 — HTTP backend contract and 0.2.0 release

Status: complete
Approved: 2026-09-11 (owner: add the real HttpAgent backend fixture, then
prepare the 0.2.0 release)
Completed: 2026-09-11

### Scope and expected files

Prove the approval contract on the wire before releasing it. Add a
dependency-free Node HTTP/SSE fixture that compares `proposalId` and
`expectedRevision` against authoritative state and applies `changes` in the
same step, and drive it through the SDK's own `HttpAgent` from runtime tests.
Then prepare 0.2.0 — version, README release status, and this record — leaving
the commit, push, publish and tag to the owner's separate confirmation. Files:
`fixtures/ag-ui-http-server.ts`, `tests/runtime/http-agent.test.tsx`,
`docs/SHARED_STATE.md`, `AGENTS.md`, `README.md`, `package.json`, the lockfile
and this file.

### Acceptance checks

1. A real `HttpAgent` run receives a proposal, streams an interrupt, and
   resumes over HTTP with `{ proposalId, expectedRevision, changes }`.
2. A current approval is applied atomically; one overtaken by another actor
   applies nothing, keeps the draft, and returns a new review carrying the
   change the client never saw.
3. The fixture uses `node:http` only, listens on port 0, closes after each
   test, and needs no credentials or private downstream application.
4. `npm run verify` and `npm pack --dry-run` pass.

### Verification record (2026-09-11)

- The two cases run against a real socket: `HttpAgent` posts the run input,
  the fixture answers with SSE, and the SDK verifies every event against its
  own schemas. The resume body recorded server-side is asserted verbatim.
- Deterministic without sleeps: the fixture holds the stream open until the
  test publishes the updated proposal, so the mid-run snapshot always lands
  while the draft is being edited. Five consecutive runs were stable.
- Mutation-checked. Removing the server's revision comparison fails the stale
  case; sending a wrong `expectedRevision` from the hook fails both.
- `npm run verify` passes: typecheck, 83 tests in 13 files, build, stylesheet
  guard and package-boundary checks. `npm pack --dry-run` reports the same 21
  files; the fixture and tests stay out of the tarball.

### Release record (2026-09-11)

- Published by the owner as commit `04c8c1a`. GitHub Actions `Verify` passed on
  that commit before publication.
- `0.2.0` is the `latest` tag on npm. Its registry metadata records gitHead
  `04c8c1a`, 21 files and 253,496 bytes unpacked — the same tarball the dry run
  reported. The annotated `v0.2.0` tag points at that commit.
- A clean temporary consumer installed `0.2.0` from the registry and imported
  the native entry (`useAgent`, `useAgentDraft`, `AgentChat`), the React-free
  protocol entry, and the stylesheet. Zero runtime dependencies.
- The GitHub release "v0.2.0 — Drafts and guarded approval" was published
  on 2026-09-11 from the `v0.2.0` tag, alongside the existing `v0.1.0`
  release. An earlier version of this record said it was missing; that was
  written before the release was created.

## T10 — Announcement and ecosystem listing

Status: complete
Approved: 2026-09-12 (owner: "Should we send the PR as well?" then "go")
Completed: 2026-09-12

### Scope and expected files

Announce the package to the AG-UI community and ask for a listing in the
AG-UI repository's client tables, the way the A2UI companion is listed on
the A2UI ecosystem page. Expected files: none in this repository beyond
this record; the listing itself lives in `ag-ui-protocol/ag-ui`.

### Acceptance checks

1. A Show and tell discussion in `ag-ui-protocol/ag-ui` describes the
   package and links the demo, the source and npm.
2. A pull request against `ag-ui-protocol/ag-ui` adds one Community row to
   the README Clients table and the matching line in
   `docs/integrations.mdx`, and nothing else.
3. The pull request commit is authored by the owner alone.

### Verification record

- Discussion #2723, "Material 3 Expressive React client for AG-UI", posted
  2026-09-11 in Show and tell:
  https://github.com/ag-ui-protocol/ag-ui/discussions/2723
- Pull request #2736, "docs: list Material 3 Expressive as a community
  AG-UI client", opened 2026-09-11 from the owner's fork branch
  `docs/clients-material3-expressive` at commit `347394c`: two files, two
  added lines. https://github.com/ag-ui-protocol/ag-ui/pull/2736
- The AG-UI repository has no contributor license agreement. The pull
  request awaits maintainer review; the README tables are curated by the
  CopilotKit team, and community rows exist there already.
