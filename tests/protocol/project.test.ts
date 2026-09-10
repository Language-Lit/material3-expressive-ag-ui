import type { Message } from '@ag-ui/core'
import { describe, expect, it } from 'vitest'

import { projectTimeline } from '../../src/protocol/project'
import { createRunOverlay } from '../../src/protocol/run-state'
import type { RunOverlay, ToolCallNode } from '../../src/protocol/timeline.types'

function overlay(patch: Partial<RunOverlay> = {}): RunOverlay {
  return { ...createRunOverlay(), ...patch }
}

const askAndCall: Message[] = [
  { id: 'u1', role: 'user', content: 'Find the shape tokens' },
  {
    id: 'a1',
    role: 'assistant',
    content: 'Looking that up.',
    toolCalls: [
      { id: 'c1', type: 'function', function: { name: 'search', arguments: '{"q":"shape"}' } },
    ],
  },
  { id: 't1', role: 'tool', toolCallId: 'c1', content: '9 results' },
]

describe('projectTimeline', () => {
  it('merges a result that precedes its issuing call without duplicate keys', () => {
    const calls = projectTimeline([askAndCall[2]!, askAndCall[1]!], overlay())
      .filter((node) => node.kind === 'tool-call')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ id: 'c1', name: 'search', result: '9 results' })
  })

  it('emits repeated orphan results once, using the latest answer consistently', () => {
    const nodes = projectTimeline([
      { id: 't1', role: 'tool', toolCallId: 'c1', content: 'old' },
      { id: 't2', role: 'tool', toolCallId: 'c1', content: '', error: 'failed' },
    ], overlay())
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({ status: 'error', error: 'failed', result: '' })
  })
  it('projects a turn, its text and its call in transcript order', () => {
    const nodes = projectTimeline(askAndCall, overlay())
    expect(nodes.map((node) => node.kind)).toEqual(['user', 'assistant-text', 'tool-call'])
  })

  it('merges a tool result back onto the call that asked for it', () => {
    const [, , call] = projectTimeline(askAndCall, overlay()) as [unknown, unknown, ToolCallNode]
    expect(call.id).toBe('c1')
    expect(call.name).toBe('search')
    expect(call.args).toEqual({ q: 'shape' })
    expect(call.argsComplete).toBe(true)
    expect(call.status).toBe('complete')
    expect(call.result).toBe('9 results')
  })

  it('marks a call whose result carries an error', () => {
    const messages: Message[] = [
      askAndCall[1]!,
      { id: 't1', role: 'tool', toolCallId: 'c1', content: '', error: 'rate limited' },
    ]
    const call = projectTimeline(messages, overlay()).find(
      (node) => node.kind === 'tool-call',
    ) as ToolCallNode
    expect(call.status).toBe('error')
    expect(call.error).toBe('rate limited')
  })

  it('reports a call as awaiting a result until its tool message arrives', () => {
    const call = projectTimeline([askAndCall[1]!], overlay()).find(
      (node) => node.kind === 'tool-call',
    ) as ToolCallNode
    expect(call.status).toBe('awaiting-result')
    expect(call.result).toBeUndefined()
  })

  it('reads partial arguments while the call is still streaming', () => {
    const messages: Message[] = [
      {
        id: 'a1',
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 'c1', type: 'function', function: { name: 'search', arguments: '{"q":"sha' } },
        ],
      },
    ]
    const call = projectTimeline(
      messages,
      overlay({ streamingToolCallIds: new Set(['c1']) }),
    )[0] as ToolCallNode
    expect(call.status).toBe('streaming')
    expect(call.args).toEqual({ q: 'sha' })
    expect(call.argsComplete).toBe(false)
    expect(call.rawArgs).toBe('{"q":"sha')
  })

  it('omits an assistant message that carried only a tool call', () => {
    const messages: Message[] = [{ ...askAndCall[1]!, content: '' } as Message]
    expect(projectTimeline(messages, overlay()).map((node) => node.kind)).toEqual(['tool-call'])
  })

  it('flags the message that is streaming', () => {
    const messages: Message[] = [{ id: 'a1', role: 'assistant', content: 'Partial' }]
    const [node] = projectTimeline(messages, overlay({ streamingMessageIds: new Set(['a1']) }))
    expect(node).toMatchObject({ kind: 'assistant-text', streaming: true })
    const [settled] = projectTimeline(messages, overlay())
    expect(settled).toMatchObject({ streaming: false })
  })

  it('includes reasoning by default and drops it on request', () => {
    const messages: Message[] = [{ id: 'r1', role: 'reasoning', content: 'weighing options' }]
    expect(projectTimeline(messages, overlay())[0]).toMatchObject({
      kind: 'reasoning',
      content: 'weighing options',
      encrypted: false,
    })
    expect(projectTimeline(messages, overlay(), { includeReasoning: false })).toEqual([])
  })

  it('keeps encrypted reasoning as a node with nothing to show', () => {
    const messages: Message[] = [
      { id: 'r1', role: 'reasoning', content: '', encryptedValue: 'opaque' } as Message,
    ]
    expect(projectTimeline(messages, overlay())[0]).toMatchObject({ encrypted: true })
  })

  it('hides system and developer messages unless asked for', () => {
    const messages: Message[] = [
      { id: 's1', role: 'system', content: 'You are helpful' },
      { id: 'd1', role: 'developer', content: 'debug on' },
      { id: 'u1', role: 'user', content: 'hi' },
    ]
    expect(projectTimeline(messages, overlay())).toHaveLength(1)
    expect(projectTimeline(messages, overlay(), { includeSystem: true })).toHaveLength(3)
  })

  it('projects activity messages with their backend-defined type', () => {
    const messages: Message[] = [
      {
        id: 'x1',
        role: 'activity',
        activityType: 'search',
        content: { query: 'shape tokens', hits: 9 },
      } as Message,
    ]
    expect(projectTimeline(messages, overlay())[0]).toMatchObject({
      kind: 'activity',
      activityType: 'search',
      content: { query: 'shape tokens', hits: 9 },
    })
  })

  it('does not lose a tool result whose call is missing from the transcript', () => {
    const messages: Message[] = [{ id: 't9', role: 'tool', toolCallId: 'gone', content: 'orphan' }]
    const [node] = projectTimeline(messages, overlay()) as [ToolCallNode]
    expect(node.kind).toBe('tool-call')
    expect(node.id).toBe('gone')
    expect(node.name).toBe('')
    expect(node.result).toBe('orphan')
  })

  it('appends pending interrupts after the transcript', () => {
    const nodes = projectTimeline(askAndCall, overlay(), {
      interrupts: [{ id: 'i1', reason: 'approval_required', message: 'Delete 3 files?' }],
    })
    expect(nodes.at(-1)).toMatchObject({ kind: 'interrupt', message: 'Delete 3 files?' })
  })

  it('appends a run error last', () => {
    const nodes = projectTimeline(askAndCall, overlay({ error: { message: 'boom', code: '500' } }))
    expect(nodes.at(-1)).toMatchObject({ kind: 'error', message: 'boom', code: '500' })
  })

  it('renders non-string content rather than dropping it', () => {
    const messages: Message[] = [
      { id: 't1', role: 'tool', toolCallId: 'c1', content: { ok: true } } as unknown as Message,
    ]
    expect((projectTimeline(messages, overlay())[0] as ToolCallNode).result).toBe('{"ok":true}')
  })
})
