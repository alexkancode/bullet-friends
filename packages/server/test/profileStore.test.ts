import { describe, expect, it } from 'vitest'
import { MemoryGroupStore } from '../src/groups/memoryStore.js'

describe('profile store', () => {
  it('creates an email user and finds it by email', async () => {
    const store = new MemoryGroupStore()
    const user = await store.createEmailUser('Spud', 'spud@example.com', 'hash123')
    expect(user.userId.length).toBeGreaterThan(0)
    const found = await store.getUserByEmail('spud@example.com')
    expect(found?.userId).toBe(user.userId)
    expect(found?.passwordHash).toBe('hash123')
  })

  it('returns undefined for unknown emails and duplicate creation', async () => {
    const store = new MemoryGroupStore()
    expect(await store.getUserByEmail('nobody@example.com')).toBeUndefined()
    await store.createEmailUser('Spud', 'spud@example.com', 'hash123')
    expect(await store.createEmailUser('Other', 'spud@example.com', 'hash456')).toBeUndefined()
  })

  it('persists cam consent onto the profile', async () => {
    const store = new MemoryGroupStore()
    const user = await store.createEmailUser('Spud', 'spud@example.com', 'hash123')
    expect((await store.getProfile(user.userId))?.camConsent).toBeUndefined()
    await store.setCamConsent(user.userId, false)
    expect((await store.getProfile(user.userId))?.camConsent).toBe(false)
    await store.setCamConsent(user.userId, true)
    expect((await store.getProfile(user.userId))?.camConsent).toBe(true)
  })

  it('keeps google-upserted users visible as profiles', async () => {
    const store = new MemoryGroupStore()
    await store.upsertUser({ userId: 'g-sub-1', name: 'Goo', email: 'goo@example.com' })
    const profile = await store.getProfile('g-sub-1')
    expect(profile?.name).toBe('Goo')
  })
})
