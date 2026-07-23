import type { OnboardProfile } from '../ui/onboarding.js'

export interface ApiGroup {
  id: string
  name: string
  memberIds: string[]
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

export interface GroupApi {
  signup(name: string, email: string, password: string): Promise<AuthResult>
  login(email: string, password: string): Promise<AuthResult>
  googleExchange(idToken: string): Promise<AuthResult>
  me(): Promise<{ profile: OnboardProfile; groups: ApiGroup[] }>
  setCamConsent(allowed: boolean): Promise<void>
  createGroup(name: string): Promise<ApiGroup>
  createInvite(groupId: string): Promise<string>
  acceptInvite(code: string): Promise<ApiGroup | undefined>
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
    signup: (name, email, password) => call('POST', '/api/auth/signup', { name, email, password }),
    login: (email, password) => call('POST', '/api/auth/login', { email, password }),
    googleExchange: idToken => call('POST', '/api/auth/google', { idToken }),
    me: () => call('GET', '/api/me'),
    setCamConsent: allowed => call('POST', '/api/me/cam-consent', { allowed }),
    createGroup: name => call('POST', '/api/groups', { name }),
    createInvite: groupId => call<{ code: string }>('POST', `/api/groups/${groupId}/invites`).then(r => r.code),
    acceptInvite: code => call<ApiGroup>('POST', `/api/invites/${code}/accept`).catch(() => undefined),
    history: groupId => call('GET', `/api/groups/${groupId}/history`)
  }
}

export function apiBaseFromWsUrl(wsUrl: string): string {
  return wsUrl.replace(/^ws/, 'http')
}
