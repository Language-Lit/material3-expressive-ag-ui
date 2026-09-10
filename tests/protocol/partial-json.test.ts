import { describe, expect, it } from 'vitest'

import { parsePartialJson } from '../../src/protocol/partial-json'

describe('parsePartialJson', () => {
  it('reads complete text without repairing it', () => {
    const result = parsePartialJson('{"query":"materials","limit":5}')
    expect(result).toEqual({ value: { query: 'materials', limit: 5 }, complete: true, valid: true })
  })

  it('closes a value string cut mid-word', () => {
    const result = parsePartialJson('{"query": "mat')
    expect(result.value).toEqual({ query: 'mat' })
    expect(result.complete).toBe(false)
  })

  it('drops a key fragment rather than inventing a value for it', () => {
    expect(parsePartialJson('{"a": 1, "na').value).toEqual({ a: 1 })
  })

  it('drops a key whose value has not started', () => {
    expect(parsePartialJson('{"a":').value).toEqual({})
    expect(parsePartialJson('{"a": ').value).toEqual({})
  })

  it('drops a half-written keyword', () => {
    expect(parsePartialJson('{"ok": tru').value).toEqual({})
    expect(parsePartialJson('{"a": 1, "ok": fal').value).toEqual({ a: 1 })
  })

  it('drops a half-written number', () => {
    expect(parsePartialJson('{"a": 1, "b": 2.').value).toEqual({ a: 1 })
    expect(parsePartialJson('{"a": 1, "b": -').value).toEqual({ a: 1 })
  })

  it('closes nested containers to the right depth', () => {
    expect(parsePartialJson('{"a": {"b": [{"c": "d').value).toEqual({ a: { b: [{ c: 'd' }] } })
  })

  it('keeps complete array elements and drops the dangling comma', () => {
    expect(parsePartialJson('{"items": [1, 2,').value).toEqual({ items: [1, 2] })
  })

  it('does not close a string on a truncated escape', () => {
    expect(parsePartialJson('{"a": "x\\').value).toEqual({ a: 'x' })
    expect(parsePartialJson('{"a": "x\\u12').value).toEqual({ a: 'x' })
  })

  it('preserves escaped quotes inside a value', () => {
    expect(parsePartialJson('{"a": "he said \\"hi\\" and').value).toEqual({
      a: 'he said "hi" and',
    })
  })

  it('treats empty text as readable but empty', () => {
    expect(parsePartialJson('')).toEqual({ value: undefined, complete: false, valid: true })
    expect(parsePartialJson('   ').value).toBeUndefined()
  })

  it('reports text that is not JSON at all as invalid', () => {
    expect(parsePartialJson('not json at all').valid).toBe(false)
  })

  it('reports a non-object document as invalid, since tool arguments are objects', () => {
    expect(parsePartialJson('[1,2,3]').valid).toBe(false)
  })

  it('reads every prefix of a document as it streams in', () => {
    const complete = '{"path":"src/app.tsx","edits":[{"line":12,"text":"ok"}],"dry":false}'
    for (let end = 1; end <= complete.length; end += 1) {
      const result = parsePartialJson(complete.slice(0, end))
      // Every prefix must either read as an object or say it cannot — it must
      // never throw, and never claim a truncated document is complete.
      expect(result.valid || result.value === undefined).toBe(true)
      if (end < complete.length) expect(result.complete).toBe(false)
    }
    expect(parsePartialJson(complete).complete).toBe(true)
  })
})
