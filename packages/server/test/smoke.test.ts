import { afterEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { PROTOCOL_VERSION } from '@bullet/protocol'
import { startServer } from '../src/server.js'
import { MemoryGroupStore } from '../src/groups/memoryStore.js'
import { SessionTokens } from '../src/auth/sessions.js'
import { SMOKE_PROTOCOL_VERSION } from '../../../scripts/ws-probe.mjs'

const SMOKE_SCRIPT = fileURLToPath(new URL('../../../scripts/smoke.sh', import.meta.url))

type Running = Awaited<ReturnType<typeof startServer>>
let server: Running | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
})

function runSmoke(baseUrl: string): Promise<{ status: number; output: string }> {
  return new Promise(resolve => {
    execFile('bash', [SMOKE_SCRIPT], { encoding: 'utf8', env: { ...process.env, BASE_URL: baseUrl }, timeout: 60000 }, (error, stdout, stderr) => {
      const status = error ? ((error as { code?: number }).code ?? 1) : 0
      resolve({ status, output: `${stdout}${stderr}` })
    })
  })
}

describe('smoke canary', () => {
  it('probe speaks the current protocol version', () => {
    expect(SMOKE_PROTOCOL_VERSION).toBe(PROTOCOL_VERSION)
  })
})

describe('smoke suite', () => {
  it('passes against a local server', async () => {
    server = await startServer({ port: 0, seed: 7, sessions: new SessionTokens('smoke-secret'), store: new MemoryGroupStore() })
    const result = await runSmoke(`http://127.0.0.1:${server.port}`)
    expect(result.output).toContain('SMOKE PASSED')
    expect(result.status).toBe(0)
  }, 60000)

  it('fails loudly against a dead port', async () => {
    const result = await runSmoke('http://127.0.0.1:9')
    expect(result.status).not.toBe(0)
    expect(result.output).toContain('FAIL [health]')
  })
})
