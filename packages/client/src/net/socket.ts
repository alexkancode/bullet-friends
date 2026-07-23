import type { ClientMessage, ServerMessage } from '@bullet/protocol'
import { decodeCamFrame, decodeMessage, encodeMessage, isCamFrame } from '@bullet/protocol'

export interface SocketHandlers {
  onMessage(msg: ServerMessage): void
  onCamFrame(playerId: string, jpeg: Uint8Array): void
  onClose(): void
}

export interface GameSocket {
  send(msg: ClientMessage): void
  sendFrame(bytes: Uint8Array): void
  close(): void
}

export function connectSocket(url: string, handlers: SocketHandlers): Promise<GameSocket> {
  const ws = new WebSocket(url)
  ws.binaryType = 'arraybuffer'

  ws.onmessage = event => {
    if (typeof event.data === 'string') {
      handlers.onMessage(decodeMessage(event.data) as ServerMessage)
      return
    }
    const bytes = new Uint8Array(event.data as ArrayBuffer)
    if (isCamFrame(bytes)) {
      const { playerId, jpeg } = decodeCamFrame(bytes)
      handlers.onCamFrame(playerId, jpeg)
    }
  }
  ws.onclose = () => handlers.onClose()

  return new Promise((resolve, reject) => {
    ws.onopen = () =>
      resolve({
        send: msg => ws.send(encodeMessage(msg)),
        sendFrame: bytes => {
          if (ws.readyState === WebSocket.OPEN) ws.send(bytes)
        },
        close: () => ws.close()
      })
    ws.onerror = () => reject(new Error(`could not reach ${url}`))
  })
}
