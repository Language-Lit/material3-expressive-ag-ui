# Shared state, editing, and guarded approvals

The draft and approval guards described here are available from **0.2.0**.
Version 0.1.0 has neither the draft hook nor the active-run `setState()` guard.

## Migrate live editing to a draft

`useAgentContext().setState(next)` now throws while the agent is running.
SDK 0.0.59 keeps a separate state for that run; a later delta can overwrite a
frontend replacement even when it targets another field. Calls directly to the
SDK bypass our guard. Paused/idle `setState` still replaces state for the next run.

Use `useAgentDraft` for editable forms instead. It creates a local edit session
without a second agent subscription and never copies incoming updates over
your draft. The proposal selector maps your application's shared state to an
identity, revision, and JSON-compatible editable value:

```tsx
import { useAgentContext, useAgentDraft } from '@language-lit/material3-expressive-ag-ui'
import type { AgentProposal } from '@language-lit/material3-expressive-ag-ui'

function useProfileDraft() {
  const binding = useAgentContext()
  return useAgentDraft(binding, state =>
    state.proposal as AgentProposal<{ name: string }> | undefined,
  )
}
```

Validate backend data before returning it from your selector. A proposal must
have a stable ID and a string/number revision. Its revision must change when
the backend changes what is being approved. Values must be JSON-compatible.
Treat `draft`, `reviewed` and `latest` as read-only values; edit via `setDraft`.

The hook exposes:

- `draft`, `setDraft(value)`: your isolated editable value; absent if there was
  no proposal when the session started. You can still start a draft while streaming.
- `latest`: the currently displayed proposal from shared state.
- `reviewed`: a copy of the proposal captured when editing began or explicitly
  reviewed. Incoming updates do not move this baseline.
- `isStale`: missing/changed proposal identity, revision, or contents.
- `review(displayedProposal, { keepDraft: true })`: explicitly accept the
  displayed proposal as the new baseline while retaining edits. The method
  rejects if it has already changed in the live agent. Without `keepDraft`, it
  replaces the draft with the proposal value; label that action accordingly.
- `approve(interruptId)`: recheck live state, pending interrupt, and run status;
  then resume with a versioned payload. It rejects stale, missing, active-run,
  or duplicate submissions. Submission failures preserve the draft. Editing
  is rejected while submission is in progress; disable the form with
  `isSubmitting`.

Keep the hook mounted above the transcript if the draft must survive a new
interrupt replacing the old one. Switching to a different agent resets the
session. A different proposal on the same agent requires explicit review.
Unmounting the editor discards its local draft; persist drafts in your app if
they must survive navigation. A successful resume does not clear the draft.

## Use it inside AgentChat

Pass `interruptRenderer={YourApprovalComponent}` to `AgentProvider`. The renderer
receives `{ node, agent }` and replaces the stock prompt inside `MessageThread`
and `AgentChat`. Put the draft hook in a stable parent and share it with the
renderer through your application context. Display the latest proposal and
draft together before offering the explicit review action. For example:

```tsx
// In your approval renderer, using the parent-owned editor:
await editor.approve(node.id)
// To decline, no draft is committed:
await agent.resolveInterrupt(node.id, { status: 'cancelled' })
```

See the complete [SharedStateDemo](../playground/SharedStateDemo.tsx) for the form,
context, renderer, and scripted backend. In the playground, select **Shared
state**, start a review, edit the name, and publish the incoming update. Review
the latest proposal while keeping the draft, then approve. The **Simulate unseen
server change** action exercises backend rejection and a new review.

## Server contract: compare and apply atomically

The hook sends the existing AG-UI resume response with this payload:

```ts
{
  status: 'resolved',
  payload: {
    proposalId: reviewed.id,
    expectedRevision: reviewed.revision,
    changes: draft,
  },
}
```

Your backend must validate identity and revision against authoritative state
and apply the change in the same transaction/atomic operation. Validate the
draft, enforce permissions, bind the pending interrupt to the proposal, and
prevent replay. On mismatch, perform no action; send the updated proposal and
a new interrupt for review. Client checks cannot detect an unseen server change.
The playground demonstrates the identity/revision check before any write; it
is not a deployed backend or a substitute for your server's authorization.

`fixtures/ag-ui-http-server.ts` is the smallest server that satisfies this
contract: a Node HTTP endpoint streaming SSE, which compares `proposalId` and
`expectedRevision` against its own state and applies `changes` in the same
synchronous step. Tests drive it through the SDK's own `HttpAgent`, so the
request body, the event schemas, and the rejection path are the real ones.

## Default prompt and imperative callers

`InterruptPrompt` captures shared state when it opens. When state changes, it
disables approval, displays the updated state, and requires explicit review.
The final click is checked against live state, even if React has not rendered
the latest update yet. Cancel remains available when the run is paused.

The default prompt still sends status only. Use a versioned renderer and the
draft hook when the backend needs a proposal/revision payload. Imperative
callers can also supply `resolveInterrupt(id, response, { expectedState })` to
reject changes since their own reviewed snapshot. Without that optional guard,
imperative callers own their review policy. All native resumes reject missing
interrupts and overlapping active runs.

## Verification and limits

SDK-backed tests exercise snapshots/deltas, rejected live `setState`, preserved
drafts, explicit review, approve/cancel resume state, updates between render and
click, retries, duplicate calls, and backend revision rejection. They run through
event verification and chunk expansion under deterministic gates; draft
integration tests also run under StrictMode.

Two of them run over HTTP against the fixture server above: an approval whose
reviewed revision still holds is applied, and one overtaken by another actor
applies nothing, keeps the draft, and comes back as a fresh interrupt carrying
the change the client had not seen.

A protocol interrupt ends its run. The tests do not claim that the interrupted
stream keeps emitting while approval is pending, nor that state is magically
merged across actors. The draft and server validation contract address those
actors without replacing the SDK reducer.

CopilotKit owns its state and callbacks. Its adapter remains unchanged; the
verified ready-to-use flow here is native AG-UI. Applications can bridge the
minimal `AgentDraftBinding` contract to another owner, but must verify that
integration and its callback semantics themselves.
