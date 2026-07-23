import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@bullet/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
      '@bullet/protocol': fileURLToPath(new URL('../protocol/src/index.ts', import.meta.url))
    }
  },
  server: {
    port: 5173
  }
})
