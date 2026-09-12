import { afterEach, describe, expect, it } from 'vitest'
import { startServer } from '../src/server.js'
import { MemoryGroupStore } from '../src/groups/memoryStore.js'
import { SessionTokens } from '../src/auth/sessions.js'

type Running = Awaited<ReturnType<typeof startServer>>
let server: Running | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
})

class ExplodingStore extends MemoryGroupStore {
  override getUserByEmail(): Promise<never> {
    return Promise.reject(new Error('upstream unreachable'))
  }
}

describe('api handler failure', () => {
  it('answers 500 and keeps serving instead of crashing the process', async () => {
    server = await startServer({ port: 0, seed: 7, sessions: new SessionTokens('secret'), store: new ExplodingStore() })
    const base = `http://127.0.0.1:${server.port}`
    const failed = await fetch(`${base}/api/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', email: 'ada@example.com', password: 'password123' })
    })
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'server error' })
    const health = await fetch(`${base}/health`)
    expect(health.status).toBe(200)
  })
})
