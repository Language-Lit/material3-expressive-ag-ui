/**
 * Reading a JSON document that is still arriving.
 *
 * `TOOL_CALL_ARGS` streams a tool call's arguments as text fragments, so
 * between `TOOL_CALL_START` and `TOOL_CALL_END` the accumulated text is almost
 * never valid JSON — it is a document cut at an arbitrary character. Waiting
 * for the close is the reason generative UI pops in fully formed instead of
 * filling in; a renderer that can read the truncated document paints as the
 * arguments arrive.
 *
 * `@ag-ui/client` depends on `untruncate-json` for this. This package declares
 * no runtime dependencies, so the repair is implemented here: close what is
 * open, discard the incomplete tail, and never invent a value that was not in
 * the text.
 */

export interface PartialJsonResult {
  /** The object read, or `undefined` when nothing readable has arrived. */
  value: Record<string, unknown> | undefined
  /** `true` only when the raw text parsed as-is, with no repair. */
  complete: boolean
  /** `false` when even the repaired text would not parse. */
  valid: boolean
}

const CLOSER: Record<string, string> = { '{': '}', '[': ']' }

/** How many progressively shorter prefixes to try before giving up. Bounds the
 *  work on a long document whose tail resists repair. */
const MAX_ATTEMPTS = 64

interface ScanResult {
  closers: string[]
  inString: boolean
  escaped: boolean
  /** Index of the quote opening the string still being scanned, else -1. */
  stringStart: number
  /** Indices safe to cut at: just inside a container, just after one closes,
   *  and immediately before a comma. */
  boundaries: number[]
}

function scan(source: string): ScanResult {
  const closers: string[] = []
  const boundaries: number[] = []
  let inString = false
  let escaped = false
  let stringStart = -1

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]!
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') {
        inString = false
        stringStart = -1
      }
      continue
    }
    if (ch === '"') {
      inString = true
      stringStart = i
    } else if (ch === '{' || ch === '[') {
      closers.push(CLOSER[ch]!)
      boundaries.push(i + 1)
    } else if (ch === '}' || ch === ']') {
      closers.pop()
      boundaries.push(i + 1)
    } else if (ch === ',') {
      // Before the comma, so cutting here drops it with the member it joined.
      boundaries.push(i)
    }
  }

  return { closers, inString, escaped, stringStart, boundaries }
}

function isCompleteLiteral(token: string): boolean {
  try {
    JSON.parse(token)
    return true
  } catch {
    return false
  }
}

/** Remove a complete `"…"` token from the end, honouring escaped quotes. */
function dropTrailingStringToken(input: string): string {
  if (!input.endsWith('"')) return input
  for (let i = input.length - 2; i >= 0; i -= 1) {
    if (input[i] !== '"') continue
    let backslashes = 0
    for (let j = i - 1; j >= 0 && input[j] === '\\'; j -= 1) backslashes += 1
    if (backslashes % 2 === 0) return input.slice(0, i)
  }
  return input
}

/**
 * A string cut mid-escape cannot simply be closed: `"a\` and `"a\u12` both
 * become invalid the moment a quote is appended. Drop the broken escape first.
 */
function trimBrokenEscape(input: string): string {
  const truncatedUnicode = /\\u[0-9a-fA-F]{0,3}$/.exec(input)
  if (truncatedUnicode) return input.slice(0, truncatedUnicode.index)
  let backslashes = 0
  for (let i = input.length - 1; i >= 0 && input[i] === '\\'; i -= 1) backslashes += 1
  return backslashes % 2 === 1 ? input.slice(0, -1) : input
}

/** Is the string starting at `stringStart` an object key rather than a value? */
function isObjectKey(input: string, stringStart: number, closers: readonly string[]): boolean {
  if (closers[closers.length - 1] !== '}') return false
  for (let i = stringStart - 1; i >= 0; i -= 1) {
    const ch = input[i]!
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') continue
    return ch === '{' || ch === ','
  }
  return false
}

/**
 * Strip a trailing fragment that cannot stand as a value: a dangling comma, a
 * key with no value yet, or a half-written number or keyword.
 */
function trimIncompleteTail(input: string): string {
  let out = input.replace(/\s+$/, '')
  for (let guard = 0; guard < 8; guard += 1) {
    const before = out
    if (out.endsWith(',')) {
      out = out.slice(0, -1).replace(/\s+$/, '')
    } else if (out.endsWith(':')) {
      out = out.slice(0, -1).replace(/\s+$/, '')
      out = dropTrailingStringToken(out).replace(/\s+$/, '')
    } else {
      const bare = /[^\s{}[\],:"]+$/.exec(out)
      if (bare && !isCompleteLiteral(bare[0])) {
        out = out.slice(0, bare.index).replace(/\s+$/, '')
      }
    }
    if (out === before) break
  }
  return out
}

/** Repair the prefix `source.slice(0, cut)` into a parseable document. */
function repairPrefix(source: string, cut: number): string | undefined {
  const head = source.slice(0, cut)
  const state = scan(head)
  let out = head

  if (state.inString) {
    out = isObjectKey(out, state.stringStart, state.closers)
      ? out.slice(0, state.stringStart).replace(/\s+$/, '')
      : `${trimBrokenEscape(out)}"`
  }
  out = trimIncompleteTail(out)
  if (out === '') return undefined

  // The trims can change depth, so the closer stack is recomputed rather than
  // carried over from the first scan.
  const settled = scan(out)
  if (settled.inString) return undefined
  return out + settled.closers.slice().reverse().join('')
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

/**
 * Read tool-call arguments that may still be arriving.
 *
 * Returns the object read so far, whether it came from complete text, and
 * whether anything readable could be recovered at all.
 */
export function parsePartialJson(raw: string): PartialJsonResult {
  const source = raw.trim()
  if (source === '') return { value: undefined, complete: false, valid: true }

  try {
    const record = asRecord(JSON.parse(source))
    if (record) return { value: record, complete: true, valid: true }
  } catch {
    // Expected while the document is still arriving; fall through to repair.
  }

  const { boundaries } = scan(source)
  const cuts = [source.length, ...boundaries.slice().reverse()].slice(0, MAX_ATTEMPTS)
  for (const cut of cuts) {
    const candidate = repairPrefix(source, cut)
    if (candidate === undefined) continue
    try {
      const record = asRecord(JSON.parse(candidate))
      if (record) return { value: record, complete: false, valid: true }
    } catch {
      // Try the next-shorter prefix.
    }
  }

  return { value: undefined, complete: false, valid: false }
}
