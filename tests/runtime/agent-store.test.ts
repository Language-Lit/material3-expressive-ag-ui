import { AbstractAgent } from '@ag-ui/client'
import type { BaseEvent, RunAgentInput } from '@ag-ui/core'
import { Observable } from 'rxjs'
import { describe, expect, it, vi } from 'vitest'
import { ScriptedAgent, script } from '../../fixtures/scripted-agent'
import { createAgentStore } from '../../src/runtime/agent-store'

// This transport fails after delivering valid events through the SDK pipeline.
class FailingAgent extends AbstractAgent {
  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable((subscriber) => {
      subscriber.next(script.runStarted(input))
      for (const event of script.text('a1', 'partial').slice(0, -1)) subscriber.next(event)
      const timer = setTimeout(() => subscriber.error(new Error('Connection lost')), 10)
      return () => clearTimeout(timer)
    })
  }
}
describe('agent store lifecycle', () => {
  it('reports transport failures and clears live markers without RUN_ERROR', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const agent = new FailingAgent()
    const store = createAgentStore(agent)
    const detach = store.subscribe(() => {})
    try {
      await expect(agent.runAgent()).rejects.toThrow('Connection lost')
      await Promise.resolve()
      expect(store.getSnapshot()).toMatchObject({
        isRunning: false,
        overlay: { phase: 'error', error: { message: 'Connection lost' } },
      })
      expect(store.getSnapshot().overlay.streamingMessageIds.size).toBe(0)
      expect(store.getSnapshot().messages).toEqual([expect.objectContaining({ content: 'partial' })])
    } finally { detach(); log.mockRestore() }
  })

  it('detaches on the last listener and supports subscribe/unsubscribe replay', async () => {
    const agent = new ScriptedAgent({ script: (input) => [script.runStarted(input), script.runFinished(input)] })
    const subscribe = vi.spyOn(agent, 'subscribe')
    const store = createAgentStore(agent)
    expect(subscribe).not.toHaveBeenCalled()
    const first = store.subscribe(() => {})
    const unsubscribe = vi.spyOn(subscribe.mock.results[0]!.value, 'unsubscribe')
    const second = store.subscribe(() => {})
    expect(subscribe).toHaveBeenCalledTimes(1)
    first()
    expect(unsubscribe).not.toHaveBeenCalled()
    second()
    expect(unsubscribe).toHaveBeenCalledOnce()
    const third = store.subscribe(() => {})
    await agent.runAgent()
    await Promise.resolve()
    expect(store.getSnapshot()).toMatchObject({ isRunning: false, overlay: { phase: 'idle' } })
    third()
  })
})
