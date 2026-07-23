import { createPrivateKey, sign } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import type { TokenIdentity } from '../auth/verifier.js'
import type { Group, GroupStore, RunRecord, UserProfile } from './store.js'
import { base64UrlEncode } from '../auth/jwt.js'
import { fromFirestoreFields, toFirestoreFields } from './firestoreValues.js'
import type { FirestoreValue } from './firestoreValues.js'

export interface ServiceAccount {
  client_email: string
  private_key: string
}

interface FirestoreDocument {
  name: string
  fields?: Record<string, FirestoreValue>
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/datastore'
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export class FirestoreGroupStore implements GroupStore {
  private cachedToken: { value: string; expiresAt: number } | undefined

  constructor(
    private readonly projectId: string,
    private readonly serviceAccount: ServiceAccount
  ) {}

  async upsertUser(user: TokenIdentity): Promise<void> {
    await this.call('PATCH', `/users/${user.userId}?updateMask.fieldPaths=name&updateMask.fieldPaths=email`, {
      fields: toFirestoreFields({ name: user.name, email: user.email })
    })
  }

  async getProfile(userId: string): Promise<UserProfile | undefined> {
    const doc = (await this.call('GET', `/users/${userId}`)) as FirestoreDocument | undefined
    if (!doc?.fields) return undefined
    return { userId, ...(fromFirestoreFields(doc.fields) as Omit<UserProfile, 'userId'>) }
  }

  async getUserByEmail(email: string): Promise<UserProfile | undefined> {
    const results = (await this.call('POST', ':runQuery', {
      structuredQuery: {
        from: [{ collectionId: 'users' }],
        where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
        limit: 1
      }
    })) as { document?: FirestoreDocument }[]
    const doc = results.find(r => r.document?.fields)?.document
    if (!doc?.fields) return undefined
    return { userId: idOf(doc.name), ...(fromFirestoreFields(doc.fields) as Omit<UserProfile, 'userId'>) }
  }

  async createEmailUser(name: string, email: string, passwordHash: string): Promise<UserProfile | undefined> {
    if (await this.getUserByEmail(email)) return undefined
    const userId = `e-${randomUUID()}`
    await this.call('PATCH', `/users/${userId}`, {
      fields: toFirestoreFields({ name, email, passwordHash })
    })
    return { userId, name, email, passwordHash }
  }

  async setCamConsent(userId: string, allowed: boolean): Promise<void> {
    await this.call('PATCH', `/users/${userId}?updateMask.fieldPaths=camConsent`, {
      fields: toFirestoreFields({ camConsent: allowed })
    })
  }

  async createGroup(owner: TokenIdentity, name: string): Promise<Group> {
    const group = {
      name,
      ownerId: owner.userId,
      memberIds: [owner.userId],
      createdAt: Date.now()
    }
    const doc = (await this.call('POST', '/groups', { fields: toFirestoreFields(group) })) as FirestoreDocument
    return { id: idOf(doc.name), ...group }
  }

  async getGroup(id: string): Promise<Group | undefined> {
    const doc = (await this.call('GET', `/groups/${id}`)) as FirestoreDocument | undefined
    if (!doc?.fields) return undefined
    return { id, ...(fromFirestoreFields(doc.fields) as Omit<Group, 'id'>) }
  }

  async getUserGroups(userId: string): Promise<Group[]> {
    const results = (await this.call('POST', ':runQuery', {
      structuredQuery: {
        from: [{ collectionId: 'groups' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'memberIds' },
            op: 'ARRAY_CONTAINS',
            value: { stringValue: userId }
          }
        }
      }
    })) as { document?: FirestoreDocument }[]
    return results.flatMap(r =>
      r.document?.fields ? [{ id: idOf(r.document.name), ...(fromFirestoreFields(r.document.fields) as Omit<Group, 'id'>) }] : []
    )
  }

  async createInvite(groupId: string): Promise<string> {
    const code = Array.from({ length: 5 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('')
    await this.call('PATCH', `/invites/${code}`, { fields: toFirestoreFields({ groupId }) })
    return code
  }

  async acceptInvite(code: string, user: TokenIdentity): Promise<Group | undefined> {
    const invite = (await this.call('GET', `/invites/${code}`)) as FirestoreDocument | undefined
    if (!invite?.fields) return undefined
    const { groupId } = fromFirestoreFields(invite.fields) as { groupId: string }
    const group = await this.getGroup(groupId)
    if (!group) return undefined
    await this.call('DELETE', `/invites/${code}`)
    await this.upsertUser(user)
    if (!group.memberIds.includes(user.userId)) {
      group.memberIds.push(user.userId)
      await this.call('PATCH', `/groups/${groupId}?updateMask.fieldPaths=memberIds`, {
        fields: toFirestoreFields({ memberIds: group.memberIds })
      })
    }
    return group
  }

  async appendRun(groupId: string, run: RunRecord): Promise<void> {
    await this.call('POST', `/groups/${groupId}/runs`, { fields: toFirestoreFields({ ...run }) })
  }

  async getHistory(groupId: string): Promise<RunRecord[]> {
    const results = (await this.call('POST', `/groups/${groupId}:runQuery`, {
      structuredQuery: {
        from: [{ collectionId: 'runs' }],
        orderBy: [{ field: { fieldPath: 'endedAt' }, direction: 'DESCENDING' }],
        limit: 50
      }
    })) as { document?: FirestoreDocument }[]
    return results.flatMap(r => (r.document?.fields ? [fromFirestoreFields(r.document.fields) as unknown as RunRecord] : []))
  }

  private async call(method: string, path: string, body?: unknown): Promise<unknown> {
    const token = await this.accessToken()
    const base = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents`
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    })
    if (response.status === 404) return undefined
    if (!response.ok) throw new Error(`firestore ${method} ${path} failed: ${response.status}`)
    return response.json()
  }

  private async accessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60000) return this.cachedToken.value
    const iat = Math.floor(Date.now() / 1000)
    const claims = {
      iss: this.serviceAccount.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat,
      exp: iat + 3600
    }
    const unsigned = `${base64UrlEncode({ alg: 'RS256', typ: 'JWT' })}.${base64UrlEncode(claims)}`
    const signature = sign('RSA-SHA256', Buffer.from(unsigned), createPrivateKey(this.serviceAccount.private_key)).toString('base64url')
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${unsigned}.${signature}`
    })
    if (!response.ok) throw new Error(`token exchange failed: ${response.status}`)
    const json = (await response.json()) as { access_token: string; expires_in: number }
    this.cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 }
    return json.access_token
  }
}

function idOf(documentName: string): string {
  return documentName.slice(documentName.lastIndexOf('/') + 1)
}
