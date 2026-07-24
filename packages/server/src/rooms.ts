import type WebSocket from 'ws'
import type { GameDesign, GameState, Inputs, Rng } from '@bullet/core'
import { addPlayer, createGameState, createRng, defaultDesign, pickGear, removePlayer, sanitizeDesign, startRun, step, TICK_MS } from '@bullet/core'
import type { ServerMessage } from '@bullet/protocol'
import { encodeMessage } from '@bullet/protocol'
import type { GroupStore } from './groups/store.js'
import { buildRunRecord } from './groups/runRecord.js'

export interface Room {
  code: string
  state: GameState
  sockets: Map<string, WebSocket>
  inputs: Inputs
  rng: Rng
  timer: ReturnType<typeof setInterval> | undefined
  groupId: string | undefined
  runRecorded: boolean
  design: GameDesign
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>()
  private playerCounter = 0

  constructor(
    private readonly seed: number,
    private readonly now: () => number,
    private readonly store?: GroupStore
  ) {}

  join(code: string, ws: WebSocket, name: string): { room: Room; playerId: string } {
    const room = this.ensureRoom(code)
    const playerId = `p${++this.playerCounter}`
    addPlayer(room.state, playerId, name)
    room.sockets.set(playerId, ws)
    this.broadcastRoster(room)
    this.ensureLoop(room)
    return { room, playerId }
  }

  leave(room: Room, playerId: string): void {
    room.sockets.delete(playerId)
    removePlayer(room.state, playerId)
    delete room.inputs[playerId]
    if (room.sockets.size === 0) {
      if (room.timer) clearInterval(room.timer)
      this.rooms.delete(room.code)
      return
    }
    this.broadcastRoster(room)
  }

  setInput(room: Room, playerId: string, move: { x: number; y: number }): void {
    room.inputs[playerId] = { move }
  }

  start(room: Room): void {
    if (room.state.phase === 'lobby' || room.state.phase === 'runOver') {
      startRun(room.state, room.design)
    }
  }

  pick(room: Room, playerId: string, gearId: string): void {
    pickGear(room.state, playerId, gearId, room.design)
  }

  setDesign(room: Room, raw: unknown): boolean {
    if (room.state.phase !== 'lobby' && room.state.phase !== 'runOver') return false
    const clean = sanitizeDesign(raw)
    if (!clean) return false
    room.design = clean
    this.broadcast(room, { t: 'design', design: clean })
    return true
  }

  linkGroup(room: Room, groupId: string): void {
    room.groupId ??= groupId
  }

  backToLobby(room: Room): void {
    if (room.state.phase === 'runOver') room.state.phase = 'lobby'
  }

  broadcast(room: Room, msg: ServerMessage): void {
    const encoded = encodeMessage(msg)
    for (const socket of room.sockets.values()) socket.send(encoded)
  }

  closeAll(): void {
    for (const room of this.rooms.values()) {
      if (room.timer) clearInterval(room.timer)
    }
    this.rooms.clear()
  }

  hasRoom(code: string): boolean {
    return this.rooms.has(normalizeCode(code))
  }

  private ensureRoom(code: string): Room {
    const normalized = normalizeCode(code)
    const existing = this.rooms.get(normalized)
    if (existing) return existing
    const room: Room = {
      code: normalized,
      state: createGameState(),
      sockets: new Map(),
      inputs: {},
      rng: createRng(this.seed + this.rooms.size),
      timer: undefined,
      groupId: undefined,
      runRecorded: false,
      design: defaultDesign()
    }
    this.rooms.set(normalized, room)
    return room
  }

  private ensureLoop(room: Room): void {
    if (room.timer) return
    room.timer = setInterval(() => {
      step(room.state, room.inputs, room.rng, room.design)
      this.recordFinishedRun(room)
      this.broadcast(room, { t: 'snapshot', serverTime: this.now(), state: room.state })
    }, TICK_MS)
  }

  private recordFinishedRun(room: Room): void {
    if (room.state.phase !== 'runOver') {
      room.runRecorded = false
      return
    }
    if (room.runRecorded || !room.groupId || !this.store) return
    room.runRecorded = true
    void this.store.appendRun(room.groupId, buildRunRecord(room.state, this.now()))
  }

  private broadcastRoster(room: Room): void {
    this.broadcast(room, {
      t: 'roster',
      players: room.state.players.map(p => ({ id: p.id, name: p.name }))
    })
  }
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().slice(0, 8)
}
