import type { GameDesign } from '@bullet/core'
import type { OnboardProfile } from '../ui/onboarding.js'

export interface ApiGroup {
  id: string
  name: string
  ownerId: string
  memberIds: string[]
  isPublic?: boolean
}

export interface ApiRunRecord {
  endedAt: number
  wave: number
  players: { name: string; level: number; kills: number; damageDealt: number; damageTaken: number; xpGained: number }[]
}

export interface AuthResult {
  token: string
  profile: OnboardProfile
}

export interface DesignSummary {
  id: string
  name: string
}

export interface GroupApi {
  listDesigns(): Promise<DesignSummary[]>
  saveDesign(design: GameDesign, id?: string): Promise<string | undefined>
  getDesign(id: string): Promise<GameDesign | undefined>
  signup(name: string, email: string, password: string): Promise<AuthResult>
  login(email: string, password: string): Promise<AuthResult>
  googleExchange(idToken: string): Promise<AuthResult>
  me(): Promise<{ profile: OnboardProfile; groups: ApiGroup[] }>
  setCamConsent(allowed: boolean): Promise<void>
  createGroup(name: string): Promise<ApiGroup>
  createInvite(groupId: string): Promise<string>
  acceptInvite(code: string): Promise<ApiGroup | undefined>
  setVisibility(groupId: string, isPublic: boolean): Promise<ApiGroup>
  publicGroups(): Promise<ApiGroup[]>
  joinGroup(groupId: string): Promise<ApiGroup>
  history(groupId: string): Promise<ApiRunRecord[]>
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

export function createGroupApi(baseUrl: string, token: () => string | undefined): GroupApi {
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(token() ? { authorization: `Bearer ${token()}` } : {}),
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    })
    const json: unknown = await response.json().catch(() => undefined)
    if (!response.ok) {
      const message = typeof json === 'object' && json !== null && 'error' in json ? String((json as { error: unknown }).error) : `request failed with ${response.status}`
      throw new ApiError(response.status, message)
    }
    return json as T
  }
  return {
    listDesigns: () => call('GET', '/api/designs'),
    saveDesign: (design, id) => call<{ id: string }>('POST', '/api/designs', { design, ...(id ? { id } : {}) }).then(r => r.id).catch(() => undefined),
    getDesign: id => call<{ design: GameDesign }>('GET', `/api/designs/${id}`).then(r => r.design).catch(() => undefined),
    signup: (name, email, password) => call('POST', '/api/auth/signup', { name, email, password }),
    login: (email, password) => call('POST', '/api/auth/login', { email, password }),
    googleExchange: idToken => call('POST', '/api/auth/google', { idToken }),
    me: () => call('GET', '/api/me'),
    setCamConsent: allowed => call('POST', '/api/me/cam-consent', { allowed }),
    createGroup: name => call('POST', '/api/groups', { name }),
    createInvite: groupId => call<{ code: string }>('POST', `/api/groups/${groupId}/invites`).then(r => r.code),
    acceptInvite: code => call<ApiGroup>('POST', `/api/invites/${code}/accept`).catch(() => undefined),
    setVisibility: (groupId, isPublic) => call('POST', `/api/groups/${groupId}/visibility`, { public: isPublic }),
    publicGroups: () => call<{ groups: ApiGroup[] }>('GET', '/api/groups/public').then(r => r.groups),
    joinGroup: groupId => call('POST', `/api/groups/${groupId}/join`),
    history: groupId => call('GET', `/api/groups/${groupId}/history`)
  }
}

export function apiBaseFromWsUrl(wsUrl: string): string {
  return wsUrl.replace(/^ws/, 'http')
}
