import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import { decodeCamFrame, decodeMessage, encodeMessage, isCamFrame, isCompatible } from '@bullet/protocol'
import type { ClientMessage } from '@bullet/protocol'
import type { Room } from './rooms.js'
import { RoomManager } from './rooms.js'
import { FrameRelay } from './relay.js'

export interface ServerOptions {
  port: number
  seed?: number
}

export interface RunningServer {
  port: number
  close: () => Promise<void>
}

const CAM_FRAMES_PER_SECOND = 12

export async function startServer(options: ServerOptions): Promise<RunningServer> {
  const now = () => Date.now()
  const rooms = new RoomManager(options.seed ?? Date.now(), now)
  const relay = new FrameRelay(CAM_FRAMES_PER_SECOND, now)

  const httpServer = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
      return
    }
    res.writeHead(404)
    res.end()
  })

  const wss = new WebSocketServer({ server: httpServer })

  wss.on('connection', ws => {
    let session: { room: Room; playerId: string } | undefined

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        const bytes = new Uint8Array(data as Buffer)
        if (session && isCamFrame(bytes)) {
          relay.relay(session.room, session.playerId, decodeCamFrame(bytes).jpeg)
        }
        return
      }
      let msg: ClientMessage
      try {
        msg = decodeMessage(data.toString()) as ClientMessage
      } catch {
        ws.send(encodeMessage({ t: 'error', code: 'badMessage', message: 'unreadable message' }))
        return
      }
      if (msg.t === 'join') {
        if (!isCompatible(msg.protocolVersion)) {
          ws.send(encodeMessage({ t: 'error', code: 'version', message: 'update your client' }))
          ws.close()
          return
        }
        session = rooms.join(msg.room, ws, msg.name.slice(0, 24))
        ws.send(encodeMessage({ t: 'welcome', playerId: session.playerId, room: session.room.code }))
        return
      }
      if (!session) return
      if (msg.t === 'input') rooms.setInput(session.room, session.playerId, msg.move)
      if (msg.t === 'start') rooms.start(session.room)
      if (msg.t === 'pickGear') rooms.pick(session.room, session.playerId, msg.gearId)
      if (msg.t === 'playAgain') rooms.backToLobby(session.room)
    })

    ws.on('close', () => {
      if (!session) return
      relay.forget(session.playerId)
      rooms.leave(session.room, session.playerId)
      session = undefined
    })
  })

  await new Promise<void>(resolve => httpServer.listen(options.port, resolve))
  const address = httpServer.address()
  const port = typeof address === 'object' && address ? address.port : options.port

  return {
    port,
    close: async () => {
      rooms.closeAll()
      for (const client of wss.clients) client.terminate()
      await new Promise<void>((resolve, reject) => {
        wss.close(err => (err ? reject(err) : resolve()))
      })
      await new Promise<void>((resolve, reject) => {
        httpServer.close(err => (err ? reject(err) : resolve()))
      })
    }
  }
}
