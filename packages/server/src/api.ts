import type { IncomingMessage, ServerResponse } from 'node:http'
import type { TokenIdentity, TokenVerifier } from './auth/verifier.js'
import type { SessionTokens } from './auth/sessions.js'
import { hashPassword, verifyPassword } from './auth/passwords.js'
import type { Group, GroupStore, UserProfile } from './groups/store.js'
import { sanitizeDesign } from '@bullet/core'

export interface ApiDeps {
  verifier?: TokenVerifier | undefined
  store?: GroupStore | undefined
  sessions?: SessionTokens | undefined
  googleVerifier?: TokenVerifier | undefined
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const MIN_PASSWORD_LENGTH = 8

export async function handleApi(req: IncomingMessage, res: ServerResponse, deps: ApiDeps): Promise<boolean> {
  const url = req.url ?? ''
  if (!url.startsWith('/api/')) return false
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return true
  }
  if (url.startsWith('/api/auth/')) {
    await routeAuth(req, res, url, deps)
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
    const profile = (await store.getProfile(identity.userId)) ?? identity
    sendJson(res, 200, { profile: publicProfile(profile), groups: await store.getUserGroups(identity.userId) })
    return
  }
  if (method === 'POST' && url === '/api/me/cam-consent') {
    const body = await readJsonBody(req)
    if (typeof body['allowed'] !== 'boolean') {
      sendJson(res, 400, { error: 'allowed must be true or false' })
      return
    }
    await store.setCamConsent(identity.userId, body['allowed'])
    sendJson(res, 200, { ok: true })
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
  if (method === 'GET' && url === '/api/designs') {
    sendJson(res, 200, await store.listDesigns(identity.userId))
    return
  }
  if (method === 'POST' && url === '/api/designs') {
    const body = await readJsonBody(req)
    const clean = sanitizeDesign(body['design'])
    if (!clean) {
      sendJson(res, 400, { error: 'that design is not valid' })
      return
    }
    const id = typeof body['id'] === 'string' ? body['id'] : undefined
    const savedId = await store.saveDesign(identity.userId, clean.name, clean, id)
    if (!savedId) {
      sendJson(res, 403, { error: 'not your design' })
      return
    }
    sendJson(res, id ? 200 : 201, { id: savedId })
    return
  }
  const designPath = /^\/api\/designs\/([^/]+)$/.exec(url)
  if (method === 'GET' && designPath) {
    const record = await store.getDesign(designPath[1] ?? '')
    if (!record) {
      sendJson(res, 404, { error: 'design not found' })
      return
    }
    if (record.ownerId !== identity.userId) {
      sendJson(res, 403, { error: 'not your design' })
      return
    }
    sendJson(res, 200, record)
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

async function routeAuth(req: IncomingMessage, res: ServerResponse, url: string, deps: ApiDeps): Promise<void> {
  const { store, sessions } = deps
  if (!store || !sessions || req.method !== 'POST') {
    sendJson(res, 503, { error: 'auth is not configured on this server' })
    return
  }
  const body = await readJsonBody(req)
  if (url === '/api/auth/signup') {
    const name = typeof body['name'] === 'string' ? body['name'].trim().slice(0, 40) : ''
    const email = typeof body['email'] === 'string' ? body['email'].trim().toLowerCase() : ''
    const password = typeof body['password'] === 'string' ? body['password'] : ''
    if (!name || !EMAIL_PATTERN.test(email) || password.length < MIN_PASSWORD_LENGTH) {
      sendJson(res, 400, { error: `name, valid email, and a password of at least ${MIN_PASSWORD_LENGTH} characters are required` })
      return
    }
    const profile = await store.createEmailUser(name, email, await hashPassword(password))
    if (!profile) {
      sendJson(res, 409, { error: 'an account with that email already exists' })
      return
    }
    sendJson(res, 201, sessionResponse(sessions, profile))
    return
  }
  if (url === '/api/auth/login') {
    const email = typeof body['email'] === 'string' ? body['email'].trim().toLowerCase() : ''
    const password = typeof body['password'] === 'string' ? body['password'] : ''
    const profile = await store.getUserByEmail(email)
    if (!profile?.passwordHash || !(await verifyPassword(password, profile.passwordHash))) {
      sendJson(res, 401, { error: 'wrong email or password' })
      return
    }
    sendJson(res, 200, sessionResponse(sessions, profile))
    return
  }
  if (url === '/api/auth/google') {
    const idToken = typeof body['idToken'] === 'string' ? body['idToken'] : ''
    const identity = deps.googleVerifier ? await deps.googleVerifier.verify(idToken) : undefined
    if (!identity) {
      sendJson(res, 401, { error: 'google sign-in was not accepted' })
      return
    }
    await store.upsertUser(identity)
    const profile = (await store.getProfile(identity.userId)) ?? identity
    sendJson(res, 200, sessionResponse(sessions, profile))
    return
  }
  sendJson(res, 404, { error: 'unknown auth route' })
}

function sessionResponse(sessions: SessionTokens, profile: UserProfile): { token: string; profile: Omit<UserProfile, 'passwordHash'> } {
  return {
    token: sessions.mint({ userId: profile.userId, name: profile.name, email: profile.email }),
    profile: publicProfile(profile)
  }
}

function publicProfile(profile: UserProfile): Omit<UserProfile, 'passwordHash'> {
  const { passwordHash: _passwordHash, ...rest } = profile
  return rest
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
