import { createServer } from 'node:http'
import type { ServerResponse } from 'node:http'
import { WebSocketServer } from 'ws'
import { decodeCamFrame, decodeMessage, encodeMessage, isCamFrame, isCompatible } from '@bullet/protocol'
import type { ClientMessage } from '@bullet/protocol'
import type { Room } from './rooms.js'
import { RoomManager } from './rooms.js'
import { FrameRelay } from './relay.js'
import { handleApi, sendJson } from './api.js'
import type { TokenVerifier } from './auth/verifier.js'
import type { SessionTokens } from './auth/sessions.js'
import { CompositeTokenVerifier } from './auth/composite.js'
import type { GroupStore } from './groups/store.js'

export interface ServerOptions {
  port: number
  seed?: number
  verifier?: TokenVerifier
  store?: GroupStore
  sessions?: SessionTokens
  googleVerifier?: TokenVerifier
}

export interface RunningServer {
  port: number
  close: () => Promise<void>
}

const CAM_FRAMES_PER_SECOND = 12

export async function startServer(options: ServerOptions): Promise<RunningServer> {
  const now = () => Date.now()
  const verifiers = [options.sessions, options.googleVerifier, options.verifier].filter((v): v is TokenVerifier => Boolean(v))
  const authVerifier = verifiers.length > 0 ? new CompositeTokenVerifier(verifiers) : undefined
  const rooms = new RoomManager(options.seed ?? Date.now(), now, options.store)
  const relay = new FrameRelay(CAM_FRAMES_PER_SECOND, now)

  const httpServer = createServer((req, res) => {
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')
    res.setHeader('access-control-allow-headers', 'authorization, content-type')
    routeHttp(req, res).catch(error => failRequest(res, error))
  })

  function failRequest(res: ServerResponse, error: unknown): void {
    console.error(error)
    if (!res.headersSent) sendJson(res, 500, { error: 'server error' })
  }

  async function routeHttp(req: Parameters<typeof handleApi>[0], res: Parameters<typeof handleApi>[1]): Promise<void> {
    if (req.url === '/health') {
      sendJson(res, 200, { ok: true, commit: process.env['COMMIT_SHA'] ?? 'unknown' })
      return
    }
    if (await handleApi(req, res, { verifier: authVerifier, store: options.store, sessions: options.sessions, googleVerifier: options.googleVerifier })) return
    res.writeHead(404)
    res.end()
  }

  async function linkRoomGroup(room: Room, groupId: string, idToken: string): Promise<void> {
    if (!authVerifier || !options.store) return
    const identity = await authVerifier.verify(idToken)
    if (!identity) return
    const group = await options.store.getGroup(groupId)
    if (!group || !group.memberIds.includes(identity.userId)) return
    rooms.linkGroup(room, groupId)
  }

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
        ws.send(encodeMessage({ t: 'design', design: session.room.design }))
        if (msg.groupId && msg.idToken) linkRoomGroup(session.room, msg.groupId, msg.idToken).catch(console.error)
        return
      }
      if (!session) return
      if (msg.t === 'input') rooms.setInput(session.room, session.playerId, msg.move)
      if (msg.t === 'start') rooms.start(session.room)
      if (msg.t === 'pickGear') rooms.pick(session.room, session.playerId, msg.gearId)
      if (msg.t === 'playAgain') rooms.backToLobby(session.room)
      if (msg.t === 'setDesign') rooms.setDesign(session.room, msg.design)
      if (msg.t === 'pause') rooms.pause(session.room, session.playerId)
      if (msg.t === 'resume') rooms.resume(session.room)
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
