import { afterEach, describe, expect, it } from 'vitest'
import { startServer } from '../src/server.js'
import { MemoryGroupStore } from '../src/groups/memoryStore.js'
import { SessionTokens } from '../src/auth/sessions.js'
import type { TokenVerifier } from '../src/auth/verifier.js'

const fakeGoogle: TokenVerifier = {
  verify: token => Promise.resolve(token === 'google-ok' ? { userId: 'goog-1', name: 'Goo', email: 'goo@example.com' } : undefined)
}

type Running = Awaited<ReturnType<typeof startServer>>
let server: Running | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
})

async function boot() {
  const store = new MemoryGroupStore()
  const sessions = new SessionTokens('test-secret', () => Date.now())
  server = await startServer({ port: 0, seed: 7, store, sessions, googleVerifier: fakeGoogle })
  const port = server.port
  const api = async (method: string, path: string, body?: unknown, token?: string) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    })
    return { status: res.status, json: (await res.json().catch(() => undefined)) as any }
  }
  return { api }
}

const SIGNUP = { name: 'Spud', email: 'spud@example.com', password: 'longenough9' }

describe('auth api', () => {
  it('signs up, returns a session token that works on /api/me', async () => {
    const { api } = await boot()
    const created = await api('POST', '/api/auth/signup', SIGNUP)
    expect(created.status).toBe(201)
    expect(created.json.token.length).toBeGreaterThan(20)
    const me = await api('GET', '/api/me', undefined, created.json.token)
    expect(me.status).toBe(200)
    expect(me.json.profile.name).toBe('Spud')
    expect(me.json.profile.email).toBe('spud@example.com')
    expect(me.json.profile.camConsent).toBeUndefined()
  })

  it('rejects invalid signups', async () => {
    const { api } = await boot()
    expect((await api('POST', '/api/auth/signup', { name: '', email: 'a@b.c', password: 'longenough9' })).status).toBe(400)
    expect((await api('POST', '/api/auth/signup', { name: 'A', email: 'not-an-email', password: 'longenough9' })).status).toBe(400)
    expect((await api('POST', '/api/auth/signup', { name: 'A', email: 'a@b.c', password: 'short' })).status).toBe(400)
  })

  it('rejects duplicate email signup with 409', async () => {
    const { api } = await boot()
    await api('POST', '/api/auth/signup', SIGNUP)
    expect((await api('POST', '/api/auth/signup', SIGNUP)).status).toBe(409)
  })

  it('logs in with the right password and refuses the wrong one', async () => {
    const { api } = await boot()
    await api('POST', '/api/auth/signup', SIGNUP)
    const login = await api('POST', '/api/auth/login', { email: SIGNUP.email, password: SIGNUP.password })
    expect(login.status).toBe(200)
    expect(login.json.profile.name).toBe('Spud')
    expect((await api('POST', '/api/auth/login', { email: SIGNUP.email, password: 'wrongpass99' })).status).toBe(401)
    expect((await api('POST', '/api/auth/login', { email: 'ghost@example.com', password: 'whatever99' })).status).toBe(401)
  })

  it('exchanges a google token for a session token', async () => {
    const { api } = await boot()
    const exchange = await api('POST', '/api/auth/google', { idToken: 'google-ok' })
    expect(exchange.status).toBe(200)
    const me = await api('GET', '/api/me', undefined, exchange.json.token)
    expect(me.json.profile.name).toBe('Goo')
    expect((await api('POST', '/api/auth/google', { idToken: 'google-bad' })).status).toBe(401)
  })

  it('persists cam consent through the api', async () => {
    const { api } = await boot()
    const { json } = await api('POST', '/api/auth/signup', SIGNUP)
    expect((await api('POST', '/api/me/cam-consent', { allowed: false }, json.token)).status).toBe(200)
    const me = await api('GET', '/api/me', undefined, json.token)
    expect(me.json.profile.camConsent).toBe(false)
  })
})
