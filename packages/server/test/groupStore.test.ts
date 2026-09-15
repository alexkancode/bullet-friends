import { afterEach, describe, expect, it, vi } from 'vitest'
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

describe('MemoryGroupStore public groups', () => {
  afterEach(() => vi.useRealTimers())

  it('creates groups private and lets the owner flip visibility', async () => {
    const store = new MemoryGroupStore()
    const group = await store.createGroup(alex, 'Spud Squad')
    expect(group.isPublic).toBeUndefined()
    await store.setGroupVisibility(group.id, true)
    expect((await store.getGroup(group.id))?.isPublic).toBe(true)
    await store.setGroupVisibility(group.id, false)
    expect((await store.getGroup(group.id))?.isPublic).toBe(false)
  })

  it('lists only public groups, newest first', async () => {
    vi.useFakeTimers()
    const store = new MemoryGroupStore()
    vi.setSystemTime(1000)
    const older = await store.createGroup(alex, 'Older')
    vi.setSystemTime(2000)
    const hidden = await store.createGroup(alex, 'Hidden')
    vi.setSystemTime(3000)
    const newer = await store.createGroup(alex, 'Newer')
    await store.setGroupVisibility(older.id, true)
    await store.setGroupVisibility(newer.id, true)
    expect((await store.listPublicGroups()).map(g => g.name)).toEqual(['Newer', 'Older'])
    expect((await store.listPublicGroups()).some(g => g.id === hidden.id)).toBe(false)
  })

  it('lets anyone join a public group exactly once', async () => {
    const store = new MemoryGroupStore()
    const group = await store.createGroup(alex, 'Spud Squad')
    await store.setGroupVisibility(group.id, true)
    expect((await store.joinGroup(group.id, sam))?.memberIds).toEqual(['u1', 'u2'])
    expect((await store.joinGroup(group.id, sam))?.memberIds).toEqual(['u1', 'u2'])
    expect(await store.getUserGroups('u2')).toHaveLength(1)
  })

  it('refuses to join private or unknown groups', async () => {
    const store = new MemoryGroupStore()
    const group = await store.createGroup(alex, 'Spud Squad')
    expect(await store.joinGroup(group.id, sam)).toBeUndefined()
    expect(await store.joinGroup('nope', sam)).toBeUndefined()
    expect(await store.getUserGroups('u2')).toEqual([])
  })
})
