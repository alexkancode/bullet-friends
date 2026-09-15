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

async function boot() {
  server = await startServer({ port: 0, seed: 7, verifier: fakeVerifier, store: new MemoryGroupStore() })
  const port = server.port
  const api = async (method: string, path: string, token: string, body?: unknown) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    })
    return { status: res.status, json: await res.json().catch(() => undefined) }
  }
  const createGroup = async (token: string, name: string) => (await api('POST', '/api/groups', token, { name })).json as { id: string }
  return { api, createGroup }
}

describe('public groups api', () => {
  it('lets only the owner change visibility', async () => {
    const { api, createGroup } = await boot()
    const group = await createGroup('tok-alex', 'Spud Squad')
    const made = await api('POST', `/api/groups/${group.id}/visibility`, 'tok-alex', { public: true })
    expect(made.status).toBe(200)
    expect(made.json.isPublic).toBe(true)
    expect((await api('POST', `/api/groups/${group.id}/visibility`, 'tok-sam', { public: false })).status).toBe(403)
    await api('POST', `/api/groups/${group.id}/join`, 'tok-sam')
    expect((await api('POST', `/api/groups/${group.id}/visibility`, 'tok-sam', { public: false })).status).toBe(403)
  })

  it('validates the visibility body and the group id', async () => {
    const { api, createGroup } = await boot()
    const group = await createGroup('tok-alex', 'Spud Squad')
    expect((await api('POST', `/api/groups/${group.id}/visibility`, 'tok-alex', { public: 'yes' })).status).toBe(400)
    expect((await api('POST', '/api/groups/nope/visibility', 'tok-alex', { public: true })).status).toBe(404)
  })

  it('lists public groups the caller is not already in', async () => {
    const { api, createGroup } = await boot()
    const open = await createGroup('tok-alex', 'Open Crew')
    await createGroup('tok-alex', 'Secret Crew')
    await api('POST', `/api/groups/${open.id}/visibility`, 'tok-alex', { public: true })
    const forSam = await api('GET', '/api/groups/public', 'tok-sam')
    expect(forSam.status).toBe(200)
    expect(forSam.json.groups.map((g: { name: string }) => g.name)).toEqual(['Open Crew'])
    const forAlex = await api('GET', '/api/groups/public', 'tok-alex')
    expect(forAlex.json.groups).toEqual([])
  })

  it('joins a public group and refuses private or unknown ones', async () => {
    const { api, createGroup } = await boot()
    const open = await createGroup('tok-alex', 'Open Crew')
    const secret = await createGroup('tok-alex', 'Secret Crew')
    await api('POST', `/api/groups/${open.id}/visibility`, 'tok-alex', { public: true })
    const joined = await api('POST', `/api/groups/${open.id}/join`, 'tok-sam')
    expect(joined.status).toBe(200)
    expect(joined.json.memberIds).toEqual(['u1', 'u2'])
    const me = await api('GET', '/api/me', 'tok-sam')
    expect(me.json.groups.map((g: { id: string }) => g.id)).toEqual([open.id])
    expect((await api('POST', `/api/groups/${secret.id}/join`, 'tok-sam')).status).toBe(403)
    expect((await api('POST', '/api/groups/nope/join', 'tok-sam')).status).toBe(404)
    expect((await api('GET', `/api/groups/${open.id}/history`, 'tok-sam')).status).toBe(200)
  })
})
