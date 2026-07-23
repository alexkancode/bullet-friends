import type { TokenIdentity } from '../auth/verifier.js'

export interface UserProfile extends TokenIdentity {
  camConsent?: boolean
  passwordHash?: string
}

export interface Group {
  id: string
  name: string
  ownerId: string
  memberIds: string[]
  createdAt: number
}

export interface RunRecordPlayer {
  name: string
  level: number
  kills: number
  damageDealt: number
  damageTaken: number
  xpGained: number
}

export interface RunRecord {
  endedAt: number
  wave: number
  players: RunRecordPlayer[]
}

export interface GroupStore {
  upsertUser(user: TokenIdentity): Promise<void>
  getProfile(userId: string): Promise<UserProfile | undefined>
  getUserByEmail(email: string): Promise<UserProfile | undefined>
  createEmailUser(name: string, email: string, passwordHash: string): Promise<UserProfile | undefined>
  setCamConsent(userId: string, allowed: boolean): Promise<void>
  createGroup(owner: TokenIdentity, name: string): Promise<Group>
  getGroup(id: string): Promise<Group | undefined>
  getUserGroups(userId: string): Promise<Group[]>
  createInvite(groupId: string): Promise<string>
  acceptInvite(code: string, user: TokenIdentity): Promise<Group | undefined>
  appendRun(groupId: string, run: RunRecord): Promise<void>
  getHistory(groupId: string): Promise<RunRecord[]>
}
