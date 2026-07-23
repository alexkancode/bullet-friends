import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import type { ServerMessage, SnapshotMessage, WelcomeMessage } from '@bullet/protocol'
import { decodeMessage, encodeMessage, encodeCamFrame, decodeCamFrame, isCamFrame, PROTOCOL_VERSION } from '@bullet/protocol'
import { startServer } from '../src/server.js'

type Running = Awaited<ReturnType<typeof startServer>>

let server: Running | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
})

async function boot(): Promise<Running> {
  server = await startServer({ port: 0, seed: 7 })
  return server
}

function connect(port: number): Promise<WebSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`)
  ws.binaryType = 'arraybuffer'
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve(ws))
    ws.once('error', reject)
  })
}

function nextMatching<T>(ws: WebSocket, pick: (data: WebSocket.RawData) => T | undefined, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMessage)
      reject(new Error('timed out waiting for message'))
    }, timeoutMs)
    const onMessage = (data: WebSocket.RawData) => {
      const found = pick(data)
      if (found === undefined) return
      clearTimeout(timer)
      ws.off('message', onMessage)
      resolve(found)
    }
    ws.on('message', onMessage)
  })
}

function nextServerMessage<T extends ServerMessage['t']>(ws: WebSocket, tag: T, timeoutMs = 3000) {
  return nextMatching(ws, data => {
    if (typeof data !== 'string' && isCamFrame(new Uint8Array(data as ArrayBuffer))) return undefined
    const msg = decodeMessage(data.toString()) as ServerMessage
    return msg.t === tag ? (msg as Extract<ServerMessage, { t: T }>) : undefined
  }, timeoutMs)
}

async function join(ws: WebSocket, room: string, name: string): Promise<WelcomeMessage> {
  const welcome = nextServerMessage(ws, 'welcome')
  ws.send(encodeMessage({ t: 'join', room, name, protocolVersion: PROTOCOL_VERSION }))
  return welcome
}

describe('server', () => {
  it('serves a health endpoint', async () => {
    const { port } = await boot()
    const res = await fetch(`http://127.0.0.1:${port}/health`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('welcomes a joining player and broadcasts the roster', async () => {
    const { port } = await boot()
    const a = await connect(port)
    const welcomeA = await join(a, 'GLHF', 'Alex')
    expect(welcomeA.playerId.length).toBeGreaterThan(0)
    expect(welcomeA.room).toBe('GLHF')

    const b = await connect(port)
    const rosterAfterB = nextServerMessage(a, 'roster')
    await join(b, 'GLHF', 'Sam')
    const roster = await rosterAfterB
    expect(roster.players.map(p => p.name).sort()).toEqual(['Alex', 'Sam'])
    a.close()
    b.close()
  })

  it('rejects a protocol version mismatch', async () => {
    const { port } = await boot()
    const ws = await connect(port)
    const error = nextServerMessage(ws, 'error')
    ws.send(encodeMessage({ t: 'join', room: 'GLHF', name: 'Old', protocolVersion: 999 }))
    const msg = await error
    expect(msg.code).toBe('version')
    await new Promise(resolve => ws.once('close', resolve))
  })

  it('isolates rooms from each other', async () => {
    const { port } = await boot()
    const a = await connect(port)
    const b = await connect(port)
    await join(a, 'AAAA', 'Alex')
    await join(b, 'BBBB', 'Sam')
    const snapA = await nextServerMessage(a, 'snapshot')
    expect(snapA.state.players.map(p => p.name)).toEqual(['Alex'])
    a.close()
    b.close()
  })

  it('streams identical-tick snapshots to all room members after start', async () => {
    const { port } = await boot()
    const a = await connect(port)
    const b = await connect(port)
    await join(a, 'GLHF', 'Alex')
    await join(b, 'GLHF', 'Sam')
    const snapA = nextServerMessage(a, 'snapshot')
    const snapB = nextServerMessage(b, 'snapshot')
    a.send(encodeMessage({ t: 'start' }))
    const [sa, sb] = await Promise.all([snapA, snapB])
    expect(sa.state.phase).toBe('fighting')
    expect(sa.state.players.length).toBe(2)
    expect(sb.state.players.length).toBe(2)
    a.close()
    b.close()
  })

  it('applies player input to the simulation', async () => {
    const { port } = await boot()
    const a = await connect(port)
    const { playerId } = await join(a, 'GLHF', 'Alex')
    a.send(encodeMessage({ t: 'start' }))
    const before = await nextServerMessage(a, 'snapshot')
    const me = (s: SnapshotMessage) => s.state.players.find(p => p.id === playerId)!
    a.send(encodeMessage({ t: 'input', seq: 1, move: { x: 1, y: 0 } }))
    const after = await nextMatching(a, data => {
      if (typeof data !== 'string' && isCamFrame(new Uint8Array(data as ArrayBuffer))) return undefined
      const msg = decodeMessage(data.toString()) as ServerMessage
      if (msg.t !== 'snapshot') return undefined
      return me(msg).pos.x > me(before).pos.x ? msg : undefined
    })
    expect(me(after).pos.x).toBeGreaterThan(me(before).pos.x)
    a.close()
  })

  it('relays cam frames to room peers but not the sender', async () => {
    const { port } = await boot()
    const a = await connect(port)
    const b = await connect(port)
    const { playerId } = await join(a, 'GLHF', 'Alex')
    await join(b, 'GLHF', 'Sam')

    const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3])
    const received = nextMatching(b, data => {
      if (typeof data === 'string') return undefined
      const bytes = new Uint8Array(data as ArrayBuffer)
      return isCamFrame(bytes) ? decodeCamFrame(bytes) : undefined
    })
    let echoed = false
    a.on('message', data => {
      if (typeof data !== 'string' && isCamFrame(new Uint8Array(data as ArrayBuffer))) echoed = true
    })
    a.send(encodeCamFrame(playerId, jpeg))
    const frame = await received
    expect(frame.playerId).toBe(playerId)
    expect(frame.jpeg).toEqual(jpeg)
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(echoed).toBe(false)
    a.close()
    b.close()
  })
})
