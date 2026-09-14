import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import type { ServerMessage } from '@bullet/protocol'
import { decodeMessage, encodeMessage, isCamFrame, PROTOCOL_VERSION } from '@bullet/protocol'
import { startServer } from '../src/server.js'
import { RoomManager } from '../src/rooms.js'
import { MemoryGroupStore } from '../src/groups/memoryStore.js'

type Running = Awaited<ReturnType<typeof startServer>>
let server: Running | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
})

const fakeSocket = () => ({ send: () => undefined }) as unknown as WebSocket

function connect(port: number): Promise<WebSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`)
  ws.binaryType = 'arraybuffer'
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve(ws))
    ws.once('error', reject)
  })
}

function nextMessage<T extends ServerMessage['t']>(ws: WebSocket, tag: T, check: (msg: Extract<ServerMessage, { t: T }>) => boolean, timeoutMs = 6000) {
  return new Promise<Extract<ServerMessage, { t: T }>>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${tag}`)), timeoutMs)
    ws.on('message', function onMessage(data) {
      if (typeof data !== 'string' && isCamFrame(new Uint8Array(data as ArrayBuffer))) return
      const msg = decodeMessage(data.toString()) as ServerMessage
      if (msg.t !== tag || !check(msg as Extract<ServerMessage, { t: T }>)) return
      clearTimeout(timer)
      ws.off('message', onMessage)
      resolve(msg as Extract<ServerMessage, { t: T }>)
    })
  })
}

function closed(ws: WebSocket, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('socket stayed open')), timeoutMs)
    ws.once('close', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

function join(ws: WebSocket, room: string, name: string): void {
  ws.send(encodeMessage({ t: 'join', room, name, protocolVersion: PROTOCOL_VERSION }))
}

describe('leave flow', () => {
  it('drops a leaver while the others keep fighting', async () => {
    server = await startServer({ port: 0, seed: 7 })
    const a = await connect(server.port)
    const b = await connect(server.port)
    join(a, 'BYE', 'Alex')
    join(b, 'BYE', 'Sam')
    await nextMessage(b, 'snapshot', msg => msg.state.players.length === 2)
    a.send(encodeMessage({ t: 'start' }))
    await nextMessage(b, 'snapshot', msg => msg.state.phase === 'fighting')

    const gone = closed(a)
    const roster = nextMessage(b, 'roster', msg => msg.players.length === 1)
    a.send(encodeMessage({ t: 'leave' }))
    await gone
    expect((await roster).players[0]?.name).toBe('Sam')
    const after = await nextMessage(b, 'snapshot', msg => msg.state.players.length === 1)
    expect(after.state.phase).toBe('fighting')
    b.close()
  })

  it('ends the run for the last player and keeps them connected to see the stats', async () => {
    server = await startServer({ port: 0, seed: 7 })
    const a = await connect(server.port)
    join(a, 'SOLO', 'Alex')
    await nextMessage(a, 'snapshot', msg => msg.state.players.length === 1)
    a.send(encodeMessage({ t: 'start' }))
    await nextMessage(a, 'snapshot', msg => msg.state.phase === 'fighting')

    a.send(encodeMessage({ t: 'leave' }))
    const over = await nextMessage(a, 'snapshot', msg => msg.state.phase === 'runOver')
    expect(over.state.players.map(p => p.name)).toEqual(['Alex'])
    expect(a.readyState).toBe(WebSocket.OPEN)
    a.close()
  })

  it('simply disconnects a lone player who leaves from the lobby', async () => {
    server = await startServer({ port: 0, seed: 7 })
    const a = await connect(server.port)
    join(a, 'IDLE', 'Alex')
    await nextMessage(a, 'snapshot', msg => msg.state.phase === 'lobby')
    const gone = closed(a)
    a.send(encodeMessage({ t: 'leave' }))
    await gone
  })

  it('records the abandoned run to the linked group', async () => {
    const store = new MemoryGroupStore()
    const group = await store.createGroup({ userId: 'u1', name: 'Alex', email: 'a@e.com' }, 'Squad')
    const rooms = new RoomManager(7, () => 4242, store)
    const { room, playerId } = rooms.join('QUIT', fakeSocket(), 'Alex')
    rooms.linkGroup(room, group.id)
    rooms.start(room)
    expect(rooms.leaveRun(room, playerId)).toBe('runOver')
    await new Promise(resolve => setTimeout(resolve, 200))
    const history = await store.getHistory(group.id)
    expect(history.map(run => run.players.map(p => p.name))).toEqual([['Alex']])
    rooms.closeAll()
  })

  it('does not end the run when others remain', () => {
    const rooms = new RoomManager(7, () => 4242)
    const { room, playerId } = rooms.join('STAY', fakeSocket(), 'Alex')
    rooms.join('STAY', fakeSocket(), 'Sam')
    rooms.start(room)
    expect(rooms.leaveRun(room, playerId)).toBe('left')
    expect(room.state.phase).toBe('fighting')
    rooms.closeAll()
  })
})
