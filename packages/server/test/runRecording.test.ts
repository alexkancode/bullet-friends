import { describe, expect, it } from 'vitest'
import type WebSocket from 'ws'
import { createGameState, addPlayer, startRun } from '@bullet/core'
import { buildRunRecord } from '../src/groups/runRecord.js'
import { MemoryGroupStore } from '../src/groups/memoryStore.js'
import { RoomManager } from '../src/rooms.js'

const fakeSocket = () => ({ send: () => undefined }) as unknown as WebSocket

describe('run recording', () => {
  it('summarizes a finished run from game state', () => {
    const state = createGameState()
    const player = addPlayer(state, 'p1', 'Alex')
    startRun(state)
    player.level = 4
    player.history = [
      { kills: 3, damageDealt: 50, damageTaken: 10, xpGained: 9 },
      { kills: 7, damageDealt: 90, damageTaken: 40, xpGained: 21 }
    ]
    state.wave = 2
    const record = buildRunRecord(state, 12345)
    expect(record).toEqual({
      endedAt: 12345,
      wave: 2,
      players: [{ name: 'Alex', level: 4, kills: 10, damageDealt: 140, damageTaken: 50, xpGained: 30 }]
    })
  })

  it('appends one record to the linked group when a run ends', async () => {
    const store = new MemoryGroupStore()
    const group = await store.createGroup({ userId: 'u1', name: 'Alex', email: 'a@e.com' }, 'Squad')
    const rooms = new RoomManager(7, () => 99999, store)
    const { room } = rooms.join('HIST', fakeSocket(), 'Alex')
    rooms.linkGroup(room, group.id)
    rooms.start(room)
    for (const player of room.state.players) {
      player.hp = 0
      player.alive = false
    }
    await new Promise(resolve => setTimeout(resolve, 200))
    const history = await store.getHistory(group.id)
    expect(history.length).toBe(1)
    expect(history[0]?.players[0]?.name).toBe('Alex')
    rooms.closeAll()
  })
})
