import { describe, expect, it } from 'vitest'
import { MemoryGroupStore } from '../src/groups/memoryStore.js'

const alex = { userId: 'u1', name: 'Alex', email: 'alex@example.com' }
const sam = { userId: 'u2', name: 'Sam', email: 'sam@example.com' }

function run(wave: number, endedAt: number) {
  return {
    endedAt,
    wave,
    players: [{ name: 'Alex', level: 3, kills: 12, damageDealt: 300, damageTaken: 120, xpGained: 40 }]
  }
}

describe('MemoryGroupStore', () => {
  it('creates a group owned by its creator', async () => {
    const store = new MemoryGroupStore()
    const group = await store.createGroup(alex, 'Spud Squad')
    expect(group.name).toBe('Spud Squad')
    expect(group.memberIds).toEqual(['u1'])
    expect(await store.getUserGroups('u1')).toEqual([group])
    expect(await store.getUserGroups('u2')).toEqual([])
  })

  it('joins members through a single-use invite', async () => {
    const store = new MemoryGroupStore()
    const group = await store.createGroup(alex, 'Spud Squad')
    const code = await store.createInvite(group.id)
    const joined = await store.acceptInvite(code, sam)
    expect(joined?.id).toBe(group.id)
    expect((await store.getGroup(group.id))?.memberIds).toContain('u2')
    expect(await store.acceptInvite(code, { userId: 'u3', name: 'Kim', email: 'kim@example.com' })).toBeUndefined()
  })

  it('accepting your own group invite is harmless', async () => {
    const store = new MemoryGroupStore()
    const group = await store.createGroup(alex, 'Spud Squad')
    const code = await store.createInvite(group.id)
    const joined = await store.acceptInvite(code, alex)
    expect(joined?.memberIds).toEqual(['u1'])
  })

  it('rejects unknown invite codes', async () => {
    const store = new MemoryGroupStore()
    expect(await store.acceptInvite('NOPE', sam)).toBeUndefined()
  })

  it('stores run history newest first', async () => {
    const store = new MemoryGroupStore()
    const group = await store.createGroup(alex, 'Spud Squad')
    await store.appendRun(group.id, run(2, 1000))
    await store.appendRun(group.id, run(5, 2000))
    const history = await store.getHistory(group.id)
    expect(history.map(r => r.wave)).toEqual([5, 2])
  })
})
