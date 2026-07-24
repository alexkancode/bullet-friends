import { randomUUID } from 'node:crypto'
import type { TokenIdentity } from '../auth/verifier.js'
import type { DesignRecord, DesignSummary, Group, GroupStore, RunRecord, UserProfile } from './store.js'

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export class MemoryGroupStore implements GroupStore {
  private readonly groups = new Map<string, Group>()
  private readonly invites = new Map<string, string>()
  private readonly runs = new Map<string, RunRecord[]>()
  private readonly users = new Map<string, UserProfile>()
  private counter = 0

  upsertUser(user: TokenIdentity): Promise<void> {
    this.users.set(user.userId, { ...this.users.get(user.userId), ...user })
    return Promise.resolve()
  }

  getProfile(userId: string): Promise<UserProfile | undefined> {
    return Promise.resolve(this.users.get(userId))
  }

  getUserByEmail(email: string): Promise<UserProfile | undefined> {
    return Promise.resolve([...this.users.values()].find(u => u.email === email))
  }

  async createEmailUser(name: string, email: string, passwordHash: string): Promise<UserProfile | undefined> {
    if (await this.getUserByEmail(email)) return undefined
    const profile: UserProfile = { userId: `e-${randomUUID()}`, name, email, passwordHash }
    this.users.set(profile.userId, profile)
    return profile
  }

  setCamConsent(userId: string, allowed: boolean): Promise<void> {
    const profile = this.users.get(userId)
    if (profile) profile.camConsent = allowed
    return Promise.resolve()
  }

  private readonly designs = new Map<string, DesignRecord>()

  saveDesign(ownerId: string, name: string, design: unknown, id?: string): Promise<string | undefined> {
    if (id) {
      const existing = this.designs.get(id)
      if (!existing || existing.ownerId !== ownerId) return Promise.resolve(undefined)
      this.designs.set(id, { id, ownerId, name, design })
      return Promise.resolve(id)
    }
    const newId = `d-${randomUUID()}`
    this.designs.set(newId, { id: newId, ownerId, name, design })
    return Promise.resolve(newId)
  }

  listDesigns(ownerId: string): Promise<DesignSummary[]> {
    return Promise.resolve(
      [...this.designs.values()].filter(d => d.ownerId === ownerId).map(d => ({ id: d.id, name: d.name }))
    )
  }

  getDesign(id: string): Promise<DesignRecord | undefined> {
    return Promise.resolve(this.designs.get(id))
  }

  createGroup(owner: TokenIdentity, name: string): Promise<Group> {
    const group: Group = {
      id: `g${++this.counter}`,
      name,
      ownerId: owner.userId,
      memberIds: [owner.userId],
      createdAt: Date.now()
    }
    this.groups.set(group.id, group)
    this.runs.set(group.id, [])
    return Promise.resolve(group)
  }

  getGroup(id: string): Promise<Group | undefined> {
    return Promise.resolve(this.groups.get(id))
  }

  getUserGroups(userId: string): Promise<Group[]> {
    return Promise.resolve([...this.groups.values()].filter(g => g.memberIds.includes(userId)))
  }

  createInvite(groupId: string): Promise<string> {
    const code = Array.from({ length: 5 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('')
    this.invites.set(code, groupId)
    return Promise.resolve(code)
  }

  async acceptInvite(code: string, user: TokenIdentity): Promise<Group | undefined> {
    const groupId = this.invites.get(code)
    if (!groupId) return undefined
    const group = this.groups.get(groupId)
    if (!group) return undefined
    this.invites.delete(code)
    await this.upsertUser(user)
    if (!group.memberIds.includes(user.userId)) group.memberIds.push(user.userId)
    return group
  }

  appendRun(groupId: string, run: RunRecord): Promise<void> {
    this.runs.get(groupId)?.unshift(run)
    return Promise.resolve()
  }

  getHistory(groupId: string): Promise<RunRecord[]> {
    return Promise.resolve(this.runs.get(groupId) ?? [])
  }
}
