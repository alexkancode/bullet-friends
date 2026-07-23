# Onboarding — Implementation Plan

Alias: `onboarding`

## Server additions (`packages/server`)

- `auth/passwords.ts` — scrypt via `node:crypto`: `hashPassword`,
  `verifyPassword` with per-hash random salt and `timingSafeEqual`.
- `auth/sessions.ts` — `SessionTokens(secret, now)`: mints and verifies
  HS256 JWTs (`iss: bullet-friends`, 30-day expiry) carrying
  userId/name/email; implements `TokenVerifier`.
- `auth/composite.ts` — `CompositeTokenVerifier(verifiers)`: first verifier
  to accept wins; lets one code path accept session tokens and raw Google
  tokens.
- Store interface gains profile records: `getProfile`, `getUserByEmail`,
  `createEmailUser(name, email, passwordHash)`, `setCamConsent`. Memory and
  Firestore implementations; Firestore `upsertUser` switches to
  `updateMask` patches so consent and password hashes never get clobbered.
- `api.ts` — new public routes (no bearer needed): `POST /api/auth/signup`
  (400 invalid, 409 duplicate email), `POST /api/auth/login` (401 wrong
  credentials), `POST /api/auth/google` (401 bad Google token). New
  authed routes: `POST /api/me/cam-consent`; `GET /api/me` now returns the
  full profile including `camConsent`.
- `server.ts` wiring: `SESSION_SECRET` env (random per boot if absent),
  composite verifier = sessions + Google.

## Core addition

- `roomCodeForGroup(groupId)` — deterministic 6-char code from a group id
  (fnv hash to A-Z/2-9 alphabet), so groupmates land in one arena with no
  manual room codes. Lives in core beside other pure game utilities.

## Client flow (`packages/client`)

- `ui/onboarding.ts` — pure `nextStep(profile, hasActiveGroup)` returning
  `'auth' | 'consent' | 'group' | 'ready'`; main.ts renders whichever
  section that names. No scattered booleans.
- Lobby panel becomes four sections: auth (sign-in form / larger sign-up
  form / Google button), consent (blurb + Allow / No thanks), group (list
  of my groups + create form), ready (group name, invite link, history,
  play). Name and room inputs are removed; identity comes from the profile.
- Session token stored via `PlatformServices` storage; on load
  `GET /api/me` restores the session and the flow resumes at the right
  step. Webcam only starts when consent is true.

## Testing (TDD order)

1. `passwords` unit: roundtrip, wrong password, distinct salts.
2. `sessions` unit: mint/verify identity, expiry, tamper, wrong secret.
3. `composite` unit: session accepted, fallthrough to Google, garbage.
4. Store unit (memory): email user creation, duplicate email rejected,
   consent persists into profile.
5. API integration: signup/login happy path, 400/401/409 unhappy paths,
   google exchange with fake Google verifier, cam-consent persistence,
   session token accepted by `/api/me` and by the websocket join.
6. Core unit: `roomCodeForGroup` deterministic, right alphabet/length,
   distinct across ids.
7. Client unit: `nextStep` covers every profile/group combination.

## Ringer Review (pre-PR checklist)

- Utility placement: password + JWT code in `auth/`, reusing the existing
  `jwt.ts` segment helpers; room-code hash in core with the other pure
  utilities. PASS.
- Inline styles: new sections restyle via existing `.field`, `.button`,
  `.panel` rules plus a small tab rule set. PASS.
- Duplicated utilities: session JWTs reuse `base64UrlEncode`/`decodeSegment`;
  Firestore consent patch reuses the existing value codec. PASS.
- Duplicated styles: sign-up form reuses `.field`; group list reuses
  `.roster` styling. PASS.
- Testable interfaces: `TokenVerifier` unchanged; store growth stays behind
  `GroupStore`; flow logic is a pure function. PASS.
- Single purpose: signup/login/google are separate handlers; `nextStep`
  decides, `main.ts` renders. PASS.
- Comments: none. PASS.
- Tests: listed above; all in CI. PASS.

Adjustments made by this review: session minting moved out of `api.ts` into
`auth/sessions.ts` so the router only routes; Firestore `upsertUser`
updateMask fix folded in here because consent persistence is unsafe without
it.
