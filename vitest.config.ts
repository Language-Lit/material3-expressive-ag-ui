import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    server: { deps: { inline: [/@copilotkit\/react-(core|ui)/] } },
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
