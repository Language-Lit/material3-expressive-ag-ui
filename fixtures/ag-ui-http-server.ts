import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { EventType } from '@ag-ui/core'
import type { RunAgentInput } from '@ag-ui/core'

/**
 * A real AG-UI backend, spoken over HTTP.
 *
 * `scripted-agent.ts` drives the SDK in process; this drives it over the wire,
 * so the request body, the SSE framing, and the event schemas are the ones a
 * deployed server has to satisfy. It exists to prove the half of the approval
 * contract that lives on the server: a resume payload carrying
 * `{ proposalId, expectedRevision, changes }` is compared against
 * authoritative state and applied only while that revision still holds.
 *
 * Node's own `http` module only — the package ships no runtime dependencies
 * and its fixtures add none. Not part of the published package.
 */

export interface Proposal {
  id: string
  revision: number
  value: { name: string }
}

/** The resume payload `useAgentDraft` sends, as untrusted input. */
export interface DraftApproval {
  proposalId?: unknown
  expectedRevision?: unknown
  changes?: { name?: unknown }
}

export interface AgUiHttpServer {
  /** The endpoint an `HttpAgent` posts to. */
  url: string
  /** Authoritative state. Only the server sees this; a paused client cannot. */
  readonly proposal: Proposal
  /** Every input the client actually sent, in order. */
  readonly requests: readonly RunAgentInput[]
  /** Let the paused run publish its updated proposal and then interrupt. */
  publishUpdate(): void
  /** A change by another actor, unseen by a client that is already paused. */
  changeProposal(name: string): void
  close(): Promise<void>
}

const INITIAL: Proposal = { id: 'profile', revision: 1, value: { name: 'Alex' } }

export async function startAgUiHttpServer(initial: Proposal = INITIAL): Promise<AgUiHttpServer> {
  let proposal: Proposal = structuredClone(initial)
  const requests: RunAgentInput[] = []
  const pending = new Set<() => void>()

  /**
   * Hold the stream open until the test says the updated proposal lands, so
   * the interleaving of server events and human edits is decided by the test
   * rather than by a sleep racing a socket.
   */
  function paused(): Promise<void> {
    return new Promise<void>((resolve) => {
      const release = () => { pending.delete(release); resolve() }
      pending.add(release)
    })
  }

  /**
   * Compare and apply in one synchronous step. Nothing can interleave between
   * the revision check and the write — the atomicity the contract asks of a
   * real backend's transaction. Returns the rejection message, or `undefined`
   * once the change is applied.
   */
  function applyApproval(payload: DraftApproval | undefined): string | undefined {
    if (payload?.proposalId !== proposal.id || payload.expectedRevision !== proposal.revision) {
      return 'The server proposal changed. Review it again; your draft is still here.'
    }
    const name = payload.changes?.name
    if (typeof name !== 'string' || name.trim() === '') return 'Enter a name before approving.'
    proposal = { id: proposal.id, revision: proposal.revision + 1, value: { name } }
    return undefined
  }

  const server = createServer((request, response) => { void handle(request, response) })

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method !== 'POST' || request.url !== '/agent') {
      response.writeHead(404).end()
      return
    }
    const input = JSON.parse(await readBody(request)) as RunAgentInput
    requests.push(input)

    let open = true
    request.on('close', () => { open = false })
    response.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    })
    response.flushHeaders()
    const emit = (event: Record<string, unknown>) => {
      if (open) response.write(`data: ${JSON.stringify(event)}\n\n`)
    }
    const interrupt = (message: string) => emit({
      type: EventType.RUN_FINISHED,
      threadId: input.threadId,
      runId: input.runId,
      outcome: {
        type: 'interrupt',
        interrupts: [{ id: `review-${proposal.revision}`, reason: 'approval_required', message }],
      },
    })
    const text = (content: string) => {
      const messageId = `a-${input.runId}`
      emit({ type: EventType.TEXT_MESSAGE_START, messageId, role: 'assistant' })
      emit({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: content })
      emit({ type: EventType.TEXT_MESSAGE_END, messageId })
    }

    emit({ type: EventType.RUN_STARTED, threadId: input.threadId, runId: input.runId })
    const resume = input.resume?.[0]
    if (!resume) {
      emit({ type: EventType.STATE_SNAPSHOT, snapshot: { proposal } })
      text('Edit the name while I prepare an updated proposal.')
      await paused()
      if (open) {
        proposal = { ...proposal, revision: proposal.revision + 1, value: { name: 'Agent suggestion' } }
        emit({ type: EventType.STATE_SNAPSHOT, snapshot: { proposal } })
        interrupt('Approve your draft against the reviewed proposal?')
      }
    } else if (resume.status === 'cancelled') {
      text('Changes cancelled.')
      emit({ type: EventType.RUN_FINISHED, threadId: input.threadId, runId: input.runId })
    } else {
      const rejection = applyApproval(resume.payload as DraftApproval | undefined)
      emit({ type: EventType.STATE_SNAPSHOT, snapshot: { proposal } })
      if (rejection !== undefined) {
        // No write happened. Send what the client has not seen and ask again.
        interrupt(rejection)
      } else {
        text(`Saved ${proposal.value.name}.`)
        emit({ type: EventType.RUN_FINISHED, threadId: input.threadId, runId: input.runId })
      }
    }
    response.end()
  }

  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve) })
  const { port } = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${port}/agent`,
    get proposal() { return structuredClone(proposal) },
    get requests() { return requests },
    publishUpdate() { pending.forEach((release) => release()) },
    changeProposal(name: string) {
      proposal = { ...proposal, revision: proposal.revision + 1, value: { name } }
    },
    async close() {
      pending.forEach((release) => release())
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    },
  }
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}
