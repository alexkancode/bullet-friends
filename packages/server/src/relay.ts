import type { Room } from './rooms.js'
import { encodeCamFrame } from '@bullet/protocol'

export class FrameRelay {
  private readonly windows = new Map<string, { startedAt: number; count: number }>()

  constructor(
    private readonly maxPerSecond: number,
    private readonly now: () => number
  ) {}

  relay(room: Room, senderId: string, jpeg: Uint8Array): void {
    if (!this.allow(senderId)) return
    const framed = encodeCamFrame(senderId, jpeg)
    for (const [playerId, socket] of room.sockets) {
      if (playerId !== senderId) socket.send(framed)
    }
  }

  forget(playerId: string): void {
    this.windows.delete(playerId)
  }

  private allow(playerId: string): boolean {
    const now = this.now()
    const window = this.windows.get(playerId)
    if (!window || now - window.startedAt >= 1000) {
      this.windows.set(playerId, { startedAt: now, count: 1 })
      return true
    }
    window.count += 1
    return window.count <= this.maxPerSecond
  }
}
