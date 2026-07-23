import { afterEach, describe, expect, it } from 'vitest'
import { startServer } from '../src/server.js'
import { MemoryGroupStore } from '../src/groups/memoryStore.js'
import type { TokenVerifier } from '../src/auth/verifier.js'

const fakeVerifier: TokenVerifier = {
  verify: token =>
    Promise.resolve(
      {
        'tok-alex': { userId: 'u1', name: 'Alex', email: 'alex@example.com' },
        'tok-sam': { userId: 'u2', name: 'Sam', email: 'sam@example.com' }
      }[token]
    )
}

type Running = Awaited<ReturnType<typeof startServer>>
let server: Running | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
})

async function boot(): Promise<{ port: number; api: (method: string, path: string, token?: string, body?: unknown) => Promise<{ status: number; json: any }> }> {
  server = await startServer({ port: 0, seed: 7, verifier: fakeVerifier, store: new MemoryGroupStore() })
  const port = server.port
  const api = async (method: string, path: string, token?: string, body?: unknown) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    })
    return { status: res.status, json: await res.json().catch(() => undefined) }
  }
  return { port, api }
}

describe('group api', () => {
  it('requires a bearer token', async () => {
    const { api } = await boot()
    expect((await api('GET', '/api/me')).status).toBe(401)
    expect((await api('GET', '/api/me', 'tok-unknown')).status).toBe(401)
  })

  it('creates groups and lists them on /api/me', async () => {
    const { api } = await boot()
    const created = await api('POST', '/api/groups', 'tok-alex', { name: 'Spud Squad' })
    expect(created.status).toBe(201)
    expect(created.json.name).toBe('Spud Squad')
    const me = await api('GET', '/api/me', 'tok-alex')
    expect(me.status).toBe(200)
    expect(me.json.profile.name).toBe('Alex')
    expect(me.json.groups.map((g: { name: string }) => g.name)).toEqual(['Spud Squad'])
  })

  it('rejects group creation without a name', async () => {
    const { api } = await boot()
    expect((await api('POST', '/api/groups', 'tok-alex', {})).status).toBe(400)
  })

  it('runs the full invite flow', async () => {
    const { api } = await boot()
    const group = (await api('POST', '/api/groups', 'tok-alex', { name: 'Spud Squad' })).json
    const invite = await api('POST', `/api/groups/${group.id}/invites`, 'tok-alex')
    expect(invite.status).toBe(201)
    const accepted = await api('POST', `/api/invites/${invite.json.code}/accept`, 'tok-sam')
    expect(accepted.status).toBe(200)
    expect(accepted.json.name).toBe('Spud Squad')
    const samMe = await api('GET', '/api/me', 'tok-sam')
    expect(samMe.json.groups.length).toBe(1)
  })

  it('blocks non-members from invites and history', async () => {
    const { api } = await boot()
    const group = (await api('POST', '/api/groups', 'tok-alex', { name: 'Spud Squad' })).json
    expect((await api('POST', `/api/groups/${group.id}/invites`, 'tok-sam')).status).toBe(403)
    expect((await api('GET', `/api/groups/${group.id}/history`, 'tok-sam')).status).toBe(403)
    expect((await api('POST', '/api/invites/XXXXX/accept', 'tok-sam')).status).toBe(404)
    expect((await api('GET', '/api/groups/nope/history', 'tok-alex')).status).toBe(403)
  })

  it('serves empty history for a fresh group and supports cors preflight', async () => {
    const { api, port } = await boot()
    const group = (await api('POST', '/api/groups', 'tok-alex', { name: 'Spud Squad' })).json
    const history = await api('GET', `/api/groups/${group.id}/history`, 'tok-alex')
    expect(history.status).toBe(200)
    expect(history.json).toEqual([])
    const preflight = await fetch(`http://127.0.0.1:${port}/api/me`, { method: 'OPTIONS' })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-headers')).toContain('authorization')
  })

  it('answers 503 when auth is not configured', async () => {
    server = await startServer({ port: 0, seed: 7 })
    const res = await fetch(`http://127.0.0.1:${server.port}/api/me`, { headers: { authorization: 'Bearer x' } })
    expect(res.status).toBe(503)
  })
})
