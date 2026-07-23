import type { IncomingMessage, ServerResponse } from 'node:http'
import type { TokenIdentity, TokenVerifier } from './auth/verifier.js'
import type { Group, GroupStore } from './groups/store.js'

export interface ApiDeps {
  verifier?: TokenVerifier | undefined
  store?: GroupStore | undefined
}

export async function handleApi(req: IncomingMessage, res: ServerResponse, deps: ApiDeps): Promise<boolean> {
  const url = req.url ?? ''
  if (!url.startsWith('/api/')) return false
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return true
  }
  if (!deps.verifier || !deps.store) {
    sendJson(res, 503, { error: 'auth is not configured on this server' })
    return true
  }
  const identity = await authenticate(req, deps.verifier)
  if (!identity) {
    sendJson(res, 401, { error: 'sign in required' })
    return true
  }
  await route(req, res, url, identity, deps.store)
  return true
}

async function route(req: IncomingMessage, res: ServerResponse, url: string, identity: TokenIdentity, store: GroupStore): Promise<void> {
  const method = req.method ?? 'GET'
  const invitePath = /^\/api\/groups\/([^/]+)\/invites$/.exec(url)
  const acceptPath = /^\/api\/invites\/([^/]+)\/accept$/.exec(url)
  const historyPath = /^\/api\/groups\/([^/]+)\/history$/.exec(url)

  if (method === 'GET' && url === '/api/me') {
    await store.upsertUser(identity)
    sendJson(res, 200, { profile: identity, groups: await store.getUserGroups(identity.userId) })
    return
  }
  if (method === 'POST' && url === '/api/groups') {
    const body = await readJsonBody(req)
    const name = typeof body['name'] === 'string' ? body['name'].trim().slice(0, 40) : ''
    if (!name) {
      sendJson(res, 400, { error: 'group name required' })
      return
    }
    await store.upsertUser(identity)
    sendJson(res, 201, await store.createGroup(identity, name))
    return
  }
  if (method === 'POST' && invitePath) {
    const group = await memberGroup(store, invitePath[1] ?? '', identity.userId)
    if (!group) {
      sendJson(res, 403, { error: 'not a member of this group' })
      return
    }
    sendJson(res, 201, { code: await store.createInvite(group.id) })
    return
  }
  if (method === 'POST' && acceptPath) {
    const group = await store.acceptInvite(acceptPath[1] ?? '', identity)
    if (!group) {
      sendJson(res, 404, { error: 'invite not found or already used' })
      return
    }
    sendJson(res, 200, group)
    return
  }
  if (method === 'GET' && historyPath) {
    const group = await memberGroup(store, historyPath[1] ?? '', identity.userId)
    if (!group) {
      sendJson(res, 403, { error: 'not a member of this group' })
      return
    }
    sendJson(res, 200, await store.getHistory(group.id))
    return
  }
  sendJson(res, 404, { error: 'unknown api route' })
}

async function memberGroup(store: GroupStore, groupId: string, userId: string): Promise<Group | undefined> {
  const group = await store.getGroup(groupId)
  return group && group.memberIds.includes(userId) ? group : undefined
}

async function authenticate(req: IncomingMessage, verifier: TokenVerifier): Promise<TokenIdentity | undefined> {
  const header = req.headers.authorization ?? ''
  if (!header.startsWith('Bearer ')) return undefined
  return verifier.verify(header.slice('Bearer '.length))
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise(resolve => {
    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(chunk as Buffer))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>)
      } catch {
        resolve({})
      }
    })
  })
}

export function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(value))
}
