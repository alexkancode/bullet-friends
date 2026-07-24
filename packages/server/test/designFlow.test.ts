import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import type { GameDesign } from '@bullet/core'
import { defaultDesign } from '@bullet/core'
import type { ServerMessage } from '@bullet/protocol'
import { decodeMessage, encodeMessage, isCamFrame, PROTOCOL_VERSION } from '@bullet/protocol'
import { startServer } from '../src/server.js'
import { MemoryGroupStore } from '../src/groups/memoryStore.js'
import type { TokenVerifier } from '../src/auth/verifier.js'

const fakeVerifier: TokenVerifier = {
  verify: token => Promise.resolve(token === 'tok-alex' ? { userId: 'u1', name: 'Alex', email: 'a@e.com' } : token === 'tok-sam' ? { userId: 'u2', name: 'Sam', email: 's@e.com' } : undefined)
}

function customDesign(): GameDesign {
  return {
    name: 'Lava World',
    enemies: [{ id: 'magma', name: 'Magma', baseHp: 4, speed: 150, radius: 18, touchDamagePerSecond: 10, xpValue: 4, weight: 100, art: 'art/blob.svg' }],
    gear: defaultDesign().gear,
    levels: [{ durationMs: 30000, spawnIntervalMs: 300, enemyIds: ['magma'] }]
  }
}

type Running = Awaited<ReturnType<typeof startServer>>
let server: Running | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
})

function connect(port: number): Promise<WebSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`)
  ws.binaryType = 'arraybuffer'
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve(ws))
    ws.once('error', reject)
  })
}

function nextMessage<T extends ServerMessage['t']>(ws: WebSocket, tag: T, check?: (msg: Extract<ServerMessage, { t: T }>) => boolean, timeoutMs = 5000) {
  return new Promise<Extract<ServerMessage, { t: T }>>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${tag}`)), timeoutMs)
    ws.on('message', function onMessage(data) {
      if (typeof data !== 'string' && isCamFrame(new Uint8Array(data as ArrayBuffer))) return
      const msg = decodeMessage(data.toString()) as ServerMessage
      if (msg.t !== tag) return
      const typed = msg as Extract<ServerMessage, { t: T }>
      if (check && !check(typed)) return
      clearTimeout(timer)
      ws.off('message', onMessage)
      resolve(typed)
    })
  })
}

describe('design rooms', () => {
  it('broadcasts a custom design and simulates with it', async () => {
    server = await startServer({ port: 0, seed: 7 })
    const a = await connect(server.port)
    const b = await connect(server.port)
    const designToA = nextMessage(a, 'design')
    a.send(encodeMessage({ t: 'join', room: 'LAVA', name: 'Alex', protocolVersion: PROTOCOL_VERSION }))
    expect((await designToA).design.name).toBe('Classic')
    b.send(encodeMessage({ t: 'join', room: 'LAVA', name: 'Sam', protocolVersion: PROTOCOL_VERSION }))
    await nextMessage(b, 'design')

    const customToB = nextMessage(b, 'design', msg => msg.design.name === 'Lava World')
    a.send(encodeMessage({ t: 'setDesign', design: customDesign() }))
    await customToB

    a.send(encodeMessage({ t: 'start' }))
    const snapshot = await nextMessage(a, 'snapshot', msg => msg.state.enemies.length > 0, 8000)
    expect(new Set(snapshot.state.enemies.map(e => e.kind))).toEqual(new Set(['magma']))
    a.close()
    b.close()
  })

  it('ignores invalid designs and mid-run design changes', async () => {
    server = await startServer({ port: 0, seed: 7 })
    const a = await connect(server.port)
    a.send(encodeMessage({ t: 'join', room: 'SAFE', name: 'Alex', protocolVersion: PROTOCOL_VERSION }))
    await nextMessage(a, 'design')
    a.send(encodeMessage({ t: 'setDesign', design: { name: 'broken' } as unknown as GameDesign }))
    a.send(encodeMessage({ t: 'start' }))
    const snapshot = await nextMessage(a, 'snapshot', msg => msg.state.enemies.length > 0, 8000)
    expect(snapshot.state.enemies.every(e => ['blob', 'sprinter', 'brute'].includes(e.kind))).toBe(true)
    a.send(encodeMessage({ t: 'setDesign', design: customDesign() }))
    const after = await nextMessage(a, 'snapshot', msg => msg.state.enemies.length > 0)
    expect(after.state.enemies.some(e => e.kind === 'magma')).toBe(false)
    a.close()
  })
})

describe('design api', () => {
  it('saves, lists, fetches with ownership, and rejects invalid designs', async () => {
    server = await startServer({ port: 0, seed: 7, verifier: fakeVerifier, store: new MemoryGroupStore() })
    const api = async (method: string, path: string, token: string, body?: unknown) => {
      const res = await fetch(`http://127.0.0.1:${server!.port}${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {})
      })
      return { status: res.status, json: (await res.json().catch(() => undefined)) as any }
    }
    const created = await api('POST', '/api/designs', 'tok-alex', { design: customDesign() })
    expect(created.status).toBe(201)
    const id = created.json.id as string

    expect((await api('POST', '/api/designs', 'tok-alex', { design: { junk: true } })).status).toBe(400)

    const list = await api('GET', '/api/designs', 'tok-alex')
    expect(list.json).toEqual([{ id, name: 'Lava World' }])
    expect((await api('GET', '/api/designs', 'tok-sam')).json).toEqual([])

    const fetched = await api('GET', `/api/designs/${id}`, 'tok-alex')
    expect(fetched.status).toBe(200)
    expect(fetched.json.design.enemies[0].id).toBe('magma')
    expect((await api('GET', `/api/designs/${id}`, 'tok-sam')).status).toBe(403)
    expect((await api('GET', '/api/designs/ghost', 'tok-alex')).status).toBe(404)

    const updated = { ...customDesign(), name: 'Lava World 2' }
    expect((await api('POST', '/api/designs', 'tok-alex', { design: updated, id })).status).toBe(200)
    expect((await api('POST', '/api/designs', 'tok-sam', { design: updated, id })).status).toBe(403)
    expect((await api('GET', '/api/designs', 'tok-alex')).json).toEqual([{ id, name: 'Lava World 2' }])
  })
})
