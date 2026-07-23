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

export interface GroupApi {
  me(): Promise<{ profile: { name: string }; groups: ApiGroup[] }>
  createGroup(name: string): Promise<ApiGroup>
  createInvite(groupId: string): Promise<string>
  acceptInvite(code: string): Promise<ApiGroup | undefined>
  history(groupId: string): Promise<ApiRunRecord[]>
}

export function createGroupApi(baseUrl: string, token: () => string | undefined): GroupApi {
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token() ?? ''}`,
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    })
    if (!response.ok) throw new Error(`${method} ${path} failed with ${response.status}`)
    return response.json() as Promise<T>
  }
  return {
    me: () => call('GET', '/api/me'),
    createGroup: name => call('POST', '/api/groups', { name }),
    createInvite: groupId => call<{ code: string }>('POST', `/api/groups/${groupId}/invites`).then(r => r.code),
    acceptInvite: code => call<ApiGroup>('POST', `/api/invites/${code}/accept`).catch(() => undefined),
    history: groupId => call('GET', `/api/groups/${groupId}/history`)
  }
}

export function apiBaseFromWsUrl(wsUrl: string): string {
  return wsUrl.replace(/^ws/, 'http')
}
