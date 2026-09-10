import { AbstractAgent } from '@ag-ui/client'
import type { AgentConfig } from '@ag-ui/client'
import { EventType } from '@ag-ui/core'
import type { BaseEvent, RunAgentInput } from '@ag-ui/core'
import { Observable, type Subscriber } from 'rxjs'

/**
 * An agent that replays a scripted event stream.
 *
 * Used by the tests and by the playground so both exercise the real
 * `AbstractAgent` pipeline — event verification, chunk expansion, transcript
 * assembly — without a server. A mock that skipped that pipeline would prove
 * nothing about how the components behave against a real backend.
 *
 * Not part of the published package.
 */

export type Script = (input: RunAgentInput) => readonly BaseEvent[]

export interface ScriptedAgentConfig extends AgentConfig {
  script: Script
  /** Delay between events, in ms. `0` emits synchronously. */
  pace?: number
}

export class ScriptedAgent extends AbstractAgent {
  private readonly script: Script
  private readonly pace: number
  private stream?: Subscriber<BaseEvent>

  override abortRun(): void {
    this.stream?.error(new DOMException('Run cancelled', 'AbortError'))
  }

  constructor({ script, pace = 0, ...config }: ScriptedAgentConfig) {
    super(config)
    this.script = script
    this.pace = pace
  }

  run(input: RunAgentInput): Observable<BaseEvent> {
    const events = this.script(input)
    const pace = this.pace

    return new Observable<BaseEvent>((subscriber) => {
      this.stream = subscriber
      let cancelled = false
      void (async () => {
        for (const event of events) {
          if (cancelled) return
          if (pace > 0) await new Promise((resolve) => setTimeout(resolve, pace))
          if (cancelled) return
          subscriber.next(event)
        }
        if (!cancelled) subscriber.complete()
      })()
      return () => {
        cancelled = true
        if (this.stream === subscriber) this.stream = undefined
      }
    })
  }
}

function chunk(text: string, size: number): string[] {
  if (size <= 0) return [text]
  const parts: string[] = []
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size))
  return parts.length > 0 ? parts : ['']
}

const event = (value: Record<string, unknown>): BaseEvent => value as unknown as BaseEvent

export const script = {
  runStarted: (input: RunAgentInput): BaseEvent =>
    event({ type: EventType.RUN_STARTED, threadId: input.threadId, runId: input.runId }),

  runFinished: (input: RunAgentInput): BaseEvent =>
    event({ type: EventType.RUN_FINISHED, threadId: input.threadId, runId: input.runId }),

  /** Finish a run by stopping to ask the person something. */
  runInterrupted: (
    input: RunAgentInput,
    interrupts: readonly { id: string; reason: string; message?: string }[],
  ): BaseEvent =>
    event({
      type: EventType.RUN_FINISHED,
      threadId: input.threadId,
      runId: input.runId,
      outcome: { type: 'interrupt', interrupts },
    }),

  runError: (message: string, code?: string): BaseEvent =>
    event({ type: EventType.RUN_ERROR, message, code }),

  step: (stepName: string): BaseEvent[] => [
    event({ type: EventType.STEP_STARTED, stepName }),
    event({ type: EventType.STEP_FINISHED, stepName }),
  ],

  stepStarted: (stepName: string): BaseEvent =>
    event({ type: EventType.STEP_STARTED, stepName }),

  stepFinished: (stepName: string): BaseEvent =>
    event({ type: EventType.STEP_FINISHED, stepName }),

  text: (messageId: string, text: string, size = 8): BaseEvent[] => [
    event({ type: EventType.TEXT_MESSAGE_START, messageId, role: 'assistant' }),
    ...chunk(text, size).map((delta) =>
      event({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta }),
    ),
    event({ type: EventType.TEXT_MESSAGE_END, messageId }),
  ],

  reasoning: (messageId: string, text: string, size = 12): BaseEvent[] => [
    event({ type: EventType.REASONING_MESSAGE_START, messageId, role: 'reasoning' }),
    ...chunk(text, size).map((delta) =>
      event({ type: EventType.REASONING_MESSAGE_CONTENT, messageId, delta }),
    ),
    event({ type: EventType.REASONING_MESSAGE_END, messageId }),
  ],

  toolCall: (
    toolCallId: string,
    toolCallName: string,
    args: Record<string, unknown>,
    parentMessageId: string,
    size = 10,
  ): BaseEvent[] => [
    event({ type: EventType.TOOL_CALL_START, toolCallId, toolCallName, parentMessageId }),
    ...chunk(JSON.stringify(args), size).map((delta) =>
      event({ type: EventType.TOOL_CALL_ARGS, toolCallId, delta }),
    ),
    event({ type: EventType.TOOL_CALL_END, toolCallId }),
  ],

  activity: (
    messageId: string,
    activityType: string,
    content: Record<string, unknown>,
  ): BaseEvent =>
    event({ type: EventType.ACTIVITY_SNAPSHOT, messageId, activityType, content }),

  toolResult: (messageId: string, toolCallId: string, content: string): BaseEvent =>
    event({ type: EventType.TOOL_CALL_RESULT, messageId, toolCallId, content, role: 'tool' }),
}
