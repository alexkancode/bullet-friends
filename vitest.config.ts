import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const pkg = (p: string) => fileURLToPath(new URL(`packages/${p}/src/index.ts`, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@bullet/core': pkg('core'),
      '@bullet/protocol': pkg('protocol')
    }
  },
  test: {
    include: ['packages/*/test/**/*.test.ts']
  }
})
