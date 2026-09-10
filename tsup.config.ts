import { defineConfig } from 'tsup'

// The subpath entry mirrors the package `exports` map. `./protocol` is the
// React-free event projection: it must stay importable from server code and
// from non-React hosts, so it is built as its own entry rather than being
// reachable only through the React barrel.
//
// esbuild strips module-level "use client" when bundling with code splitting,
// so scripts/add-directives.mjs re-adds it to the React entry afterwards.
// protocol.js is deliberately excluded so it stays server-safe.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    protocol: 'src/protocol/index.ts',
    copilotkit: 'src/copilotkit/index.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: true,
  treeshake: true,
  sourcemap: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    '@ag-ui/client',
    '@ag-ui/core',
    '@language-lit/material3-expressive',
    '@copilotkit/react-core',
    '@copilotkit/react-ui',
  ],
})
