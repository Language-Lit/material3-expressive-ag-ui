import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
assert.deepEqual(Object.keys(pkg.exports).sort(), ['.', './copilotkit', './protocol', './styles.css'])
assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0, 'Runtime dependencies are forbidden')
for (const peer of ['@copilotkit/react-core', '@copilotkit/react-ui']) {
  assert.ok(pkg.peerDependencies[peer])
  assert.equal(pkg.peerDependenciesMeta[peer].optional, true)
}

function graph(entry) {
  const sources = new Map()
  const external = new Set()
  function visit(file) {
    if (sources.has(file)) return
    const source = readFileSync(file, 'utf8')
    sources.set(file, source)
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
    function walk(node) {
      let specifier
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifier = node.moduleSpecifier.text
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) specifier = node.arguments[0].text
      if (specifier) {
        if (specifier.startsWith('.')) visit(path.resolve(path.dirname(file), specifier))
        else external.add(specifier)
      }
      ts.forEachChild(node, walk)
    }
    walk(ast)
  }
  visit(path.join(root, 'dist', entry))
  return { sources, external }
}

const protocol = graph('protocol.js')
assert.deepEqual([...protocol.external].sort(), ['@ag-ui/core'])
for (const [file, source] of protocol.sources) {
  assert.doesNotMatch(source, /['"]use client['"]|\b(?:window|document|navigator)\b/, file)
}
const native = graph('index.js')
assert.ok([...native.external].every((name) => !name.startsWith('@copilotkit/')), 'Native entry reaches an optional peer')
const adapter = graph('copilotkit.js')
for (const source of adapter.sources.values()) {
  assert.doesNotMatch(source, /\b(?:createAgentStore|useAgentContext|AgentProvider)\b/, 'Adapter includes the native binding')
}
for (const entry of ['index.js', 'copilotkit.js']) {
  assert.match(readFileSync(path.join(root, 'dist', entry), 'utf8'), /^['"]use client['"];?/, entry)
}

function checkSources(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) { checkSources(file); continue }
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    if (/\.tsx?$/.test(file)) {
      const imports = ts.preProcessFile(source).importedFiles.map((item) => item.fileName)
      for (const name of imports) {
        if (name.startsWith('@language-lit/material3-expressive')) {
          assert.ok(['@language-lit/material3-expressive', '@language-lit/material3-expressive/theme', '@language-lit/material3-expressive/tokens', '@language-lit/material3-expressive/styles.css'].includes(name), file)
        }
      }
      assert.doesNotMatch(source, /<(?:button|input|textarea|dialog)\b/, 'Use Material controls: ' + file)
    }
    if (file.endsWith('.css')) {
      assert.doesNotMatch(source, /!important|#[0-9a-f]{3,8}\b/i, file)
      for (const match of source.matchAll(/(?:^|[;{])\s*(color|background(?:-color)?|font(?:-[\w-]+)?|line-height|letter-spacing|border-radius|(?:animation|transition)(?:-duration|-timing-function)?|box-shadow)\s*:\s*([^;{}]+)/g)) {
        assert.ok(/var\(--m3e-/.test(match[2]) || /^(?:none|inherit|transparent|currentColor)$/.test(match[2].trim()), 'Non-token design value in ' + file + ': ' + match[0])
      }
    }
  }
}
checkSources(path.join(root, 'src'))
console.log('Package boundaries, directives, dependencies and design-system usage verified.')
