import { randomBytes } from 'node:crypto'
import { startServer } from './server.js'
import { GoogleTokenVerifier } from './auth/verifier.js'
import { SessionTokens } from './auth/sessions.js'
import { MemoryGroupStore } from './groups/memoryStore.js'
import { FirestoreGroupStore } from './groups/firestoreStore.js'
import type { GroupStore } from './groups/store.js'

const port = Number(process.env['PORT'] ?? 8080)
const clientId = process.env['GOOGLE_CLIENT_ID']
const googleVerifier = clientId ? new GoogleTokenVerifier(clientId) : undefined
const sessions = new SessionTokens(process.env['SESSION_SECRET'] ?? randomBytes(32).toString('base64url'))

function buildStore(): GroupStore {
  const projectId = process.env['FIRESTORE_PROJECT_ID']
  const serviceAccountJson = process.env['GOOGLE_SERVICE_ACCOUNT_JSON']
  if (projectId && serviceAccountJson) {
    return new FirestoreGroupStore(projectId, JSON.parse(serviceAccountJson))
  }
  return new MemoryGroupStore()
}

startServer({ port, sessions, ...(googleVerifier ? { googleVerifier } : {}), store: buildStore() }).then(
  running => console.log(`bullet-friends server listening on :${running.port}`),
  error => {
    console.error(error)
    process.exit(1)
  }
)
