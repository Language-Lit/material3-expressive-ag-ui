import { EventType } from '@ag-ui/core'
import type { BaseEvent } from '@ag-ui/core'
import { describe, expect, it } from 'vitest'

import { createRunOverlay, reduceRunOverlay } from '../../src/protocol/run-state'

function fold(events: readonly BaseEvent[]) {
  return events.reduce(reduceRunOverlay, createRunOverlay())
}

const started = { type: EventType.RUN_STARTED, threadId: 't1', runId: 'r1' } as unknown as BaseEvent

describe('reduceRunOverlay', () => {
  it('starts idle', () => {
    const overlay = createRunOverlay()
    expect(overlay.phase).toBe('idle')
    expect(overlay.steps).toEqual([])
  })

  it('enters the running phase and records the run', () => {
    const overlay = fold([started])
    expect(overlay.phase).toBe('running')
    expect(overlay.runId).toBe('r1')
    expect(overlay.threadId).toBe('t1')
  })

  it('tracks a message between start and end', () => {
    const streaming = fold([
      started,
      { type: EventType.TEXT_MESSAGE_START, messageId: 'm1', role: 'assistant' } as unknown as BaseEvent,
    ])
    expect(streaming.streamingMessageIds.has('m1')).toBe(true)

    const settled = reduceRunOverlay(streaming, {
      type: EventType.TEXT_MESSAGE_END,
      messageId: 'm1',
    } as unknown as BaseEvent)
    expect(settled.streamingMessageIds.has('m1')).toBe(false)
  })

  it('tracks reasoning messages on the same channel as text', () => {
    const overlay = fold([
      started,
      { type: EventType.REASONING_MESSAGE_START, messageId: 'r' } as unknown as BaseEvent,
    ])
    expect(overlay.streamingMessageIds.has('r')).toBe(true)
  })

  it('tracks a tool call between start and end', () => {
    const streaming = fold([
      started,
      { type: EventType.TOOL_CALL_START, toolCallId: 'c1', toolCallName: 'search' } as unknown as BaseEvent,
    ])
    expect(streaming.streamingToolCallIds.has('c1')).toBe(true)

    const settled = reduceRunOverlay(streaming, {
      type: EventType.TOOL_CALL_END,
      toolCallId: 'c1',
    } as unknown as BaseEvent)
    expect(settled.streamingToolCallIds.has('c1')).toBe(false)
  })

  it('records steps and resolves them by name', () => {
    const overlay = fold([
      started,
      { type: EventType.STEP_STARTED, stepName: 'plan' } as unknown as BaseEvent,
      { type: EventType.STEP_STARTED, stepName: 'search' } as unknown as BaseEvent,
      { type: EventType.STEP_FINISHED, stepName: 'plan' } as unknown as BaseEvent,
    ])
    expect(overlay.steps).toEqual([
      { name: 'plan', status: 'finished' },
      { name: 'search', status: 'running' },
    ])
  })

  it('records subagents and their outcome', () => {
    const overlay = fold([
      started,
      { type: EventType.SUBAGENT_STARTED, subagentRunId: 's1', name: 'researcher' } as unknown as BaseEvent,
      { type: EventType.SUBAGENT_FINISHED, subagentRunId: 's1' } as unknown as BaseEvent,
    ])
    expect(overlay.subagents).toEqual([{ runId: 's1', name: 'researcher', status: 'finished' }])
  })

  it('clears streaming state when a run finishes', () => {
    const overlay = fold([
      started,
      { type: EventType.TEXT_MESSAGE_START, messageId: 'm1' } as unknown as BaseEvent,
      { type: EventType.TOOL_CALL_START, toolCallId: 'c1', toolCallName: 'x' } as unknown as BaseEvent,
      { type: EventType.RUN_FINISHED, threadId: 't1', runId: 'r1' } as unknown as BaseEvent,
    ])
    expect(overlay.phase).toBe('idle')
    expect(overlay.streamingMessageIds.size).toBe(0)
    expect(overlay.streamingToolCallIds.size).toBe(0)
  })

  it('captures a run error and stops streaming', () => {
    const overlay = fold([
      started,
      { type: EventType.TEXT_MESSAGE_START, messageId: 'm1' } as unknown as BaseEvent,
      { type: EventType.RUN_ERROR, message: 'upstream refused', code: '502' } as unknown as BaseEvent,
    ])
    expect(overlay.phase).toBe('error')
    expect(overlay.error).toEqual({ message: 'upstream refused', code: '502' })
    expect(overlay.streamingMessageIds.size).toBe(0)
  })

  it('clears a previous error when the next run starts', () => {
    const overlay = fold([
      started,
      { type: EventType.RUN_ERROR, message: 'boom' } as unknown as BaseEvent,
      { type: EventType.RUN_STARTED, threadId: 't1', runId: 'r2' } as unknown as BaseEvent,
    ])
    expect(overlay.phase).toBe('running')
    expect(overlay.error).toBeUndefined()
  })

  it('is inert for event types it does not handle, so an unknown event cannot break a run', () => {
    const overlay = fold([started])
    const unchanged = reduceRunOverlay(overlay, {
      type: 'SOME_FUTURE_EVENT',
    } as unknown as BaseEvent)
    expect(unchanged).toBe(overlay)
    expect(reduceRunOverlay(overlay, { type: EventType.RAW } as unknown as BaseEvent)).toBe(overlay)
  })
})
