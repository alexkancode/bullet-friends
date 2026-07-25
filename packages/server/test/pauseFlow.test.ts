import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import type { ServerMessage } from '@bullet/protocol'
import { decodeMessage, encodeMessage, isCamFrame, PROTOCOL_VERSION } from '@bullet/protocol'
import { startServer } from '../src/server.js'

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

function nextSnapshot(ws: WebSocket, check: (msg: Extract<ServerMessage, { t: 'snapshot' }>) => boolean, timeoutMs = 6000) {
  return new Promise<Extract<ServerMessage, { t: 'snapshot' }>>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for snapshot')), timeoutMs)
    ws.on('message', function onMessage(data) {
      if (typeof data !== 'string' && isCamFrame(new Uint8Array(data as ArrayBuffer))) return
      const msg = decodeMessage(data.toString()) as ServerMessage
      if (msg.t !== 'snapshot' || !check(msg)) return
      clearTimeout(timer)
      ws.off('message', onMessage)
      resolve(msg)
    })
  })
}

describe('pause flow', () => {
  it('pauses the room for everyone, freezes the world, and resumes from any player', async () => {
    server = await startServer({ port: 0, seed: 7 })
    const a = await connect(server.port)
    const b = await connect(server.port)
    a.send(encodeMessage({ t: 'join', room: 'HALT', name: 'Alex', protocolVersion: PROTOCOL_VERSION }))
    b.send(encodeMessage({ t: 'join', room: 'HALT', name: 'Sam', protocolVersion: PROTOCOL_VERSION }))
    await nextSnapshot(b, msg => msg.state.players.length === 2)
    a.send(encodeMessage({ t: 'start' }))
    await nextSnapshot(b, msg => msg.state.phase === 'fighting')

    a.send(encodeMessage({ t: 'pause' }))
    const pausedSeen = await nextSnapshot(b, msg => msg.state.pausedBy === 'Alex')
    const frozenWaveMs = pausedSeen.state.waveMsLeft
    const later = await nextSnapshot(b, msg => msg.state.pausedMs > pausedSeen.state.pausedMs)
    expect(later.state.waveMsLeft).toBe(frozenWaveMs)
    expect(later.state.pausedBy).toBe('Alex')

    b.send(encodeMessage({ t: 'resume' }))
    const resumed = await nextSnapshot(b, msg => msg.state.pausedBy === '' && msg.state.waveMsLeft < frozenWaveMs)
    expect(resumed.state.pausedMs).toBe(0)
    a.close()
    b.close()
  })
})
