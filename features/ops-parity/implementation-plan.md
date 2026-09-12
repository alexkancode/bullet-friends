# Ops Parity: Implementation Plan

## Deliverables

| # | Path | In repo | Purpose |
|---|------|---------|---------|
| 1 | `scripts/smoke.sh` | yes | Bash smoke suite: HTTP happy and unhappy paths, then delegates WebSocket checks to the probe |
| 2 | `scripts/ws-probe.mjs` | yes | Node module using the global `WebSocket`: bad message, version rejection, join round trip. Exports its protocol version constant; runs only when invoked as main |
| 3 | `packages/server/test/smoke.test.ts` | yes | Canary: probe constant equals `PROTOCOL_VERSION`. Integration: boots `startServer` on port 0 with memory store and session tokens, runs `smoke.sh`, asserts exit 0 and the pass count |
| 4 | `package.json` | yes | `smoke` script (`bash scripts/smoke.sh`) and `check` script (lint, typecheck, test, build) matching bookclub3 |
| 5 | `.claude/skills/deploy-bullet-friends/deploy.mjs` + `SKILL.md` | yes | After verification passes, run smoke against production; document step 8 |
| 6 | `README.md` | yes | One short "Smoke" paragraph under Production |
| 7 | `/home/alex/Desktop/BULLET_FRIENDS_DEV_GUIDE.md` | no | The dev guide, same headers as the bookclub3 guide |
| 8 | `~/.claude/skills/bullet-friends-dev-update/SKILL.md` | no | Mirror of `bookclub-dev-update` pointing at the new guide and repo |

## Smoke script design

- `BASE_URL` defaults to `http://localhost:8080`. The WebSocket URL is
  derived by swapping the scheme (`http` to `ws`, `https` to `wss`).
- `set -euo pipefail`, temp dir with `trap` cleanup, `STAMP` for unique
  emails, `PASS_COUNT`, and a final `SMOKE PASSED (<n> checks)` line.
- Helpers, each with one job:
  - `request <method> <path> <expected> <label> [curl args]` writes the body
    to a temp file, compares the status, exits 1 on mismatch.
  - `json <js-expression>` evaluates against the last body with `node -e`.
  - `header <name>` greps the last response headers (captured with `-D`).
  - `authed <token>` expands to the bearer header args.
- Users: two fresh signups per run (`smoke-a+STAMP@example.com`,
  `smoke-b+STAMP@example.com`). In production these land in Firestore, the
  same accepted litter as bookclub3's "Smoke Readers" clubs.

### Happy path

| Check | Expect |
|-------|--------|
| GET /health | 200, `ok === true`, `typeof commit === 'string'` |
| OPTIONS /api/groups | 204, `access-control-allow-origin: *` |
| POST /api/auth/signup (a) | 201, token and profile.email |
| POST /api/auth/login (a) | 200 |
| GET /api/me (a) | 200, profile.email matches |
| POST /api/me/cam-consent `{allowed:true}` | 200 |
| POST /api/groups | 201, id |
| POST /api/groups/:id/invites | 201, code |
| POST /api/auth/signup (b) | 201 |
| POST /api/invites/:code/accept (b) | 200 |
| GET /api/groups/:id/history (b) | 200 |
| GET /api/designs (a) | 200 |
| ws-probe join | welcome with room and playerId, then design |

### Unhappy path

| Check | Expect |
|-------|--------|
| GET /api/me, no token | 401 |
| GET /api/me, garbage token | 401 |
| POST /api/auth/signup short password | 400 |
| POST /api/auth/signup duplicate email | 409 |
| POST /api/auth/login wrong password | 401 |
| POST /api/groups empty name | 400 |
| GET /api/groups/:id/history (b, before accept) | 403 |
| POST /api/invites/nope/accept | 404 |
| POST /api/me/cam-consent `{allowed:"yes"}` | 400 |
| POST /api/designs `{design:{}}` | 400 |
| GET /api/nope (authed) | 404 |
| GET /nope | 404 |
| ws-probe "not json" | error code `badMessage` |
| ws-probe join with protocolVersion 0 | error code `version`, socket closes |

Ordering rule carried over from bookclub3: the 403 history check runs
before the invite is accepted, and later checks never assume early state.

## Probe design (`scripts/ws-probe.mjs`)

- `export const SMOKE_PROTOCOL_VERSION = 1`.
- `probe(url)` runs three independent connections in sequence, each with a
  5 second timeout, printing `ok   [label]` and throwing on mismatch.
- Main guard: `if (process.argv[1] === fileURLToPath(import.meta.url))`
  so the canary test can import the constant without opening sockets.
- Node 22 ships a global `WebSocket`, so the probe has no dependency.

## Tests (TDD order)

1. Canary `probe protocol version matches PROTOCOL_VERSION`: fails until
   the probe file exists and exports the constant.
2. Integration `smoke suite passes against a local server`: boots
   `startServer({ port: 0, sessions, store })`, runs
   `bash scripts/smoke.sh` with `BASE_URL`, asserts no throw and that
   stdout ends with `SMOKE PASSED`. Fails until the script exists and every
   check is green.
3. Integration `smoke suite fails loudly against a dead port`: asserts a
   non-zero exit and a `FAIL [health]` line, locking the fail-fast contract.

## Deploy skill wiring

`deploy.mjs` currently ends with `process.exit(verify.status ?? 1)`. Change
to: exit on non-zero, otherwise `run('smoke: production',
'BASE_URL=<SERVER_URL> bash scripts/smoke.sh')`. `SKILL.md` gains step 8
and its exit-code sentence changes to "production is verifiably running
HEAD and passes smoke".

## Dev guide outline (outside repo)

Same headers as the bookclub3 guide. Contents drawn from the repo and the
live services: monorepo layout and package roles, protocol versioning,
server composition in `index.ts`, env-driven auth and store fallbacks,
commands (dev, build, test, lint, smoke, check), the deploy skill and
verification skill, rollout facts (commit stamping on both targets, Pages
served from the CI run, `railway up` from the working directory), current
gotchas (health lives at `/health` not `/api/health`, the client defaults
to `ws://<hostname>:8080` without `VITE_SERVER_URL`, smoke litters
Firestore with `smoke-*@example.com` users), and the feature inventory.

## Ringer checklist

- Misplaced utility: the probe is its own module under `scripts/`, not
  bolted into the server package; bash helpers stay inside `smoke.sh`.
- Inline styles: none, no UI.
- Duplicated utilities: the probe hardcodes the protocol version instead of
  importing built `dist`, and the canary test guards the duplication. The
  integration test composes `startServer` the same way `index.ts` does,
  which is the existing pattern in `api.test.ts`.
- Duplicated style rules: none.
- Testable interfaces: `probe(url)` is a pure async function over a URL;
  `smoke.sh` is parameterised by `BASE_URL` only.
- Single purpose functions: each bash helper and each probe check does one
  thing.
- Comments: none in any new file.
- Tests: canary plus two integration tests; the smoke script is itself the
  production integration test.

## Validation

To validate ops-parity you can run `npm test` (canary and integration),
`npm run smoke` against a locally started server, and
`BASE_URL=https://bullet-friends-production.up.railway.app npm run smoke`
against production.
