# Group Accounts — Implementation Plan

Alias: `group-accounts`

## Design Decisions

- **Zero new runtime dependencies.** Google ID tokens are RS256 JWTs; node's
  `crypto` verifies them against Google's JWKS. Firestore is called over REST
  with a service-account JWT signed the same way. No SDKs.
- **Interfaces at the seams.** `TokenVerifier` and `GroupStore` are small
  interfaces; production wiring is chosen by environment variables, tests
  inject fakes. The game simulation (`core`) is untouched.
- **Anonymous play is sacred.** Sign-in only adds; every existing flow works
  without a token.

## Server additions (`packages/server`)

- `auth/verifier.ts` — `TokenVerifier` interface;
  `GoogleTokenVerifier(clientId, fetchJwks)` verifies signature, `aud`, `iss`,
  `exp`, returns `{ userId, name, email }`. JWKS fetched lazily and cached.
- `groups/store.ts` — `GroupStore` interface + types (`Group`, `Invite`,
  `RunRecord`).
- `groups/memoryStore.ts` — full in-memory implementation (dev + tests).
- `groups/firestoreStore.ts` — REST implementation, service account via
  `GOOGLE_SERVICE_ACCOUNT_JSON`, project via `FIRESTORE_PROJECT_ID`.
- `api.ts` — request router mounted beside `/health`:
  - `GET /api/me` → profile + groups
  - `POST /api/groups` `{name}` → group
  - `POST /api/groups/:id/invites` → `{code}`
  - `POST /api/invites/:code/accept` → `{group}`
  - `GET /api/groups/:id/history` → `RunRecord[]`
  - All require `Authorization: Bearer <idToken>`; 401 without, 403 for
    non-members, 404 unknown codes, JSON errors.
- Run recording: `join` message gains optional `groupId` + `idToken`; the
  room keeps the verified link and on `runOver` writes one `RunRecord`
  (endedAt, wave, per-player name/level/totals).
- Wiring in `server.ts` from env: `GOOGLE_CLIENT_ID` (absent → auth endpoints
  return 503 with a clear message), `GROUP_STORE=memory|firestore`.

## Protocol additions (`packages/protocol`)

- `JoinMessage` gains optional `groupId?: string` and `idToken?: string`.
- Canary fixture updated; absence of the fields stays valid (old clients).

## Client additions (`packages/client`)

- `auth/google.ts` — loads the GIS script only when `VITE_GOOGLE_CLIENT_ID`
  is set; exposes `AuthProvider` interface (`signIn()`, `token()`,
  `profile()`); a null provider keeps the UI hidden when unconfigured.
- `net/api.ts` — thin typed fetch wrapper for the five endpoints.
- Lobby panel: sign-in button; once signed in: group picker, create-group
  field, invite-link button (copies `?invite=CODE` URL), and the joined
  room passes `groupId` in `join`.
- `?invite=` URL param: after sign-in, auto-accept and show the group.
- History screen: per-group table of past runs (date, wave reached, player
  totals) reachable from the lobby; styles reuse existing panel/table rules.

## Google Cloud setup (alexkancode account, CLI where possible)

1. `gcloud projects create bullet-friends-app --organization=<org>` — no
   billing attached, spend structurally $0.
2. `gcloud services enable firestore.googleapis.com` +
   `gcloud firestore databases create --location=nam5`.
3. Service account `bullet-server` with `roles/datastore.user`; JSON key into
   Railway env.
4. OAuth consent screen + Web OAuth client (console steps documented in
   README — the consent screen cannot be created via CLI); origins:
   `https://alexkancode.github.io`, `http://localhost:5173`,
   `http://localhost:4173`.
5. Client ID into GitHub Actions var `GOOGLE_CLIENT_ID` (client build) and
   Railway env (server verify audience).

## Testing (TDD order)

1. Verifier unit tests with a locally generated RSA keypair serving as a fake
   JWKS: valid token, expired, wrong audience, wrong issuer, garbage.
2. `MemoryGroupStore` unit tests: create/join/invite/history ordering,
   invite single-use, membership checks.
3. API integration tests over real HTTP with fake verifier: 401 without
   token, group create/fetch, invite accept flow, 403 non-member history,
   404 bad invite.
4. Run-recording integration test: two ws clients join with a groupId, die,
   history contains one record with both players.
5. Protocol canary: join fixture with and without the new optional fields.
6. Client: invite-param parsing, history table shaping.

## Ringer Review (pre-PR checklist)

- Utility placement: JWT base64url/JSON helpers live in `auth/jwt.ts`, used
  by both verifier and Firestore token signer — not duplicated. PASS.
- Inline styles: none; group panel and history reuse `.panel`, `.field`,
  `.button`, `.stats-table` rules. PASS.
- Duplicated utilities: single fetch wrapper in client; server router reuses
  one `readJsonBody`/`sendJson` pair. PASS.
- Duplicated style rules: history table reuses `.stats-table`; no new table
  styles. PASS.
- Testable interfaces: `TokenVerifier`, `GroupStore`, `AuthProvider`;
  env-driven wiring at one composition point. PASS.
- Single-purpose functions: router dispatches, handlers are one-endpoint
  functions; verifier does verification only. PASS.
- Comments: none. PASS.
- Unit + integration tests: listed above, all in CI. PASS.

Adjustments made by this review: moved run-record assembly out of `rooms.ts`
into `groups/runRecord.ts` (rooms keeps one purpose); JWKS caching pulled
into the verifier rather than a global.
