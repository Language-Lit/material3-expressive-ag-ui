// Assemble the authored stylesheet and compile it to dist/styles.css.
//
// Unlike the base library this emits no token definitions. Tokens are the base
// package's contract; this package only consumes them, so its stylesheet is
// component rules alone and both stylesheets must be loaded by the consumer.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { compileCss } from './compile-css.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const sourceRoot = path.join(root, 'src')

function assembleAuthoredCss(entry, ancestors = []) {
  if (ancestors.includes(entry)) {
    const cycle = [...ancestors, entry].map((file) => path.relative(root, file)).join(' -> ')
    throw new Error(`Circular stylesheet import: ${cycle}`)
  }

  const source = readFileSync(entry, 'utf8')
  return source.replace(/@import\s+['"]([^'"]+)['"];?/g, (statement, specifier) => {
    if (!specifier.startsWith('.')) {
      throw new Error(`Stylesheet imports must be relative: ${statement}`)
    }
    const imported = path.resolve(path.dirname(entry), specifier)
    if (imported !== sourceRoot && !imported.startsWith(`${sourceRoot}${path.sep}`)) {
      throw new Error(`Stylesheet import escapes src: ${specifier}`)
    }
    if (path.extname(imported) !== '.css') {
      throw new Error(`Stylesheet imports must target CSS files: ${specifier}`)
    }
    return assembleAuthoredCss(imported, [...ancestors, entry]).trim()
  })
}

const authored = assembleAuthoredCss(path.join(sourceRoot, 'styles/styles.css'))
if (/@import\s/.test(authored)) {
  throw new Error('Stylesheet contains an unsupported import syntax after assembly')
}

// The namespace guard: this package must never define a token or reset an
// element, because both belong to the base library's stylesheet. Comments are
// stripped first and at-rule preludes skipped, so only real selectors are
// checked.
const KEYFRAME_SELECTOR = /^(from|to|\d+(\.\d+)?%)$/

const withoutComments = authored.replace(/\/\*[\s\S]*?\*\//g, '')
for (const block of withoutComments.matchAll(/(?:^|[{}])\s*([^{}]+?)\s*\{/g)) {
  const head = block[1]
  if (head.startsWith('@')) continue
  for (const part of head.split(',').map((value) => value.trim())) {
    if (part === '' || KEYFRAME_SELECTOR.test(part)) continue
    if (!part.includes('.m3e-agui')) {
      throw new Error(`Selector outside the m3e-agui namespace: ${part}`)
    }
  }
}

mkdirSync(dist, { recursive: true })
const result = compileCss('src/styles/styles.css', authored)
writeFileSync(path.join(dist, 'styles.css'), result.code)
writeFileSync(path.join(dist, 'styles.css.map'), result.map)

console.log(`Generated dist/styles.css (${result.code.length} bytes).`)
