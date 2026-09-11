# ADR 0005: Isolated drafts and guarded approval

Status: accepted
Date: 2026-09-11
Owner approval: fix shared-state overwrites and stale approval.

SDK 0.0.59 reduces an active run against its own state. Replacing agent.state
mid-run does not update that reducer and can silently lose a local edit on the
next delta. We will not replace its reducer or choose a generic merge policy.

The native binding now rejects setState during an active run. Consumers migrate
editable forms to useAgentDraft(binding, selectProposal). This additive hook
keeps JSON-compatible drafts outside shared state and captures the reviewed
proposal's id, revision and value. Incoming updates never reset the draft.
Explicit review can keep edits or replace them with the displayed proposal.
Approval rechecks live agent state and sends { proposalId, expectedRevision,
changes } through the existing resume payload. Both review and approval reject
stale proposals. Failed submission preserves the draft. Changing agent identity
starts a fresh draft; changing proposal identity requires explicit review.

AgentProvider gains an optional interruptRenderer; AgentChat/MessageThread use
it instead of the default prompt. Custom renderers can use the draft hook while
sharing the existing provider binding. No new public entry point is added.

The stock InterruptPrompt conservatively captures the whole state on mount. If
it changes, approval is disabled and the updated state is shown for explicit
review. It passes expectedState to resolveInterrupt for a final live check.
Cancel remains available. Imperative resolveInterrupt accepts this optional
guard, validates that the interrupt still exists, and refuses overlapping runs.

These guards are local correctness checks, not authorization. Servers MUST
validate proposal identity/revision atomically with execution, reject stale
requests, enforce permissions and prevent replay. An unseen concurrent server
update cannot be detected by a frontend. The playground models that check.

CopilotKit still owns its runtime. The draft hook accepts a minimal binding
contract so an application can bridge it without mounting a native provider;
this change does not alter CopilotKit's state APIs or promise adapter-wide
conflict resolution. The verified ready-to-use flow is native AG-UI.

Rejecting active setState and overlapping operations is an intentional behavior
change from 0.1.0; document it before the next release. This task does not publish.
