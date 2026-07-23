# Bullet Friends — Implementation Plan

Alias: `bullet-friends`

## Stack

| Concern | Choice | Reason |
|---|---|---|
| Language | TypeScript everywhere, strict | One language across sim, server, client; canary-testable contracts |
| Monorepo | npm workspaces | Zero extra tooling on Node 22 / npm 10 |
| Client build | Vite | Fast dev server, static bundle for Pages and the future desktop wrapper |
| Rendering | Canvas 2D | No engine dependency; the scene is circles, sprites, and bars |
| Server | Node + `ws` | One small dependency; Railway runs it as-is |
| Tests | Vitest | Shared runner for all packages, workspace-aware |
| Lint | ESLint flat config + typescript-eslint strict | Bug-catching tuned in-repo |
| CI/CD | GitHub Actions | Pages deploy for client, Railway CLI deploy for server |
| Art | Kenney CC0 packs, with a committed SVG fallback generator | Free, gorgeous, license-safe |

## Repository Layout

```
packages/
  core/       pure deterministic simulation, no platform APIs
  protocol/   message types, encode/decode, protocol version
  server/     ws rooms, authoritative loop, cam-frame relay
  client/     Vite app: renderer, interpolation, webcam, HUD, stats
desktop/      Electron wrapper (own package.json, outside workspaces,
              installed only when building for Steam)
features/     feature docs and plans (this file)
.github/      CI/CD workflows
```

## Package Design

### core

Pure functions over a `GameState` value. `step(state, inputs, rng) -> state`
advances one 50ms tick. Modules:

- `state.ts` — `GameState`, `PlayerState`, `EnemyState`, `ProjectileState`
- `movement.ts` — clamped arena movement from input vectors
- `combat.ts` — auto-aim target selection, firing cooldowns, projectile
  advance, circle-circle collision, damage application
- `waves.ts` — wave timer, spawn schedule scaling by wave number
- `progression.ts` — XP orbs, pickup radius, level curve, level-up events
- `gear.ts` — gear catalog as data, stat modifier application, choice rolls
- `stats.ts` — per-wave accumulators (kills, damage, xp) for the stats screen
- `rng.ts` — seeded PRNG so server and tests are deterministic

No module reads clocks, Math.random, or globals; time and randomness are inputs.

### protocol

- `messages.ts` — discriminated unions for client->server
  (`join`, `input`, `ready`, `pickGear`, `camFrame`) and server->client
  (`welcome`, `snapshot`, `roster`, `levelUpOffer`, `runOver`, `camFrame`)
- `codec.ts` — JSON for control messages; binary framing for `camFrame`
  (1-byte tag + playerId + JPEG bytes) to avoid base64 inflation
- `version.ts` — protocol version constant checked at `join`

### server

- `rooms.ts` — room registry keyed by join code; owns one sim loop per room
- `loop.ts` — 20Hz driver: drain inputs, `core.step`, broadcast snapshot
- `relay.ts` — cam-frame fan-out to room peers, rate-limited per player
- `http.ts` — health endpoint and room-exists check for pre-join UX
- `index.ts` — wires ws server + http on one port (Railway provides `PORT`)

### client

- `platform/` — `PlatformServices` interface + `browserPlatform` impl
  (camera, storage, clipboard); seam for a future Steam impl
- `net/` — socket wrapper, snapshot interpolation buffer (render at
  serverTime − 100ms between the two nearest snapshots)
- `camera/` — getUserMedia, downscale to 96px circle, JPEG frames at ~7fps
- `render/` — canvas scene graph-lite: arena, enemies, projectiles, orbs,
  webcam bubbles with gear overlays, floating damage numbers
- `ui/` — lobby (name + room code), HUD (hp, xp, wave timer), level-up
  gear picker, run-over stats screen with round-over-round charts
- `styles/` — single stylesheet with CSS custom properties; no inline styles

### desktop

Electron main process loading the built client bundle, a `steamPlatform`
stub implementing `PlatformServices`, and a README describing the
steamworks.js integration path. Not in root workspaces so normal installs
and CI stay light.

## Testing Strategy (TDD order)

1. `core` unit tests first: movement clamping, auto-aim picks nearest,
   collision hits at exact radius sum, XP curve thresholds, gear stat
   stacking, wave scaling, seeded rng reproducibility.
2. `protocol` canary tests: committed JSON fixtures for every message shape;
   a type-level test that the union covers every runtime tag; codec
   round-trip including binary cam frames.
3. `server` integration tests: real ws connections on an ephemeral port —
   join/welcome handshake, two clients receive identical snapshots, cam
   frame from A reaches B and not A, protocol version mismatch is rejected.
4. `client` logic tests: interpolation buffer output at boundary times,
   platform seam mockability, stats-screen data shaping.
5. Rendering and webcam are verified by smoke testing (screenshots, DOM
   grep), not unit tests.

## CI/CD

`.github/workflows/ci.yml`:

- `check`: install, lint, typecheck, test, build all packages.
- `deploy-pages`: on main, publish `packages/client/dist` via
  `actions/deploy-pages`; Vite `base` set for project pages; client reads
  the prod server URL from `VITE_SERVER_URL` build arg.
- `deploy-server`: on main, `railway up` using the `RAILWAY_TOKEN` secret;
  the job is skipped with a visible notice when the secret is absent so the
  pipeline is green before Railway is connected.

One-time manual steps documented in the README: create the Railway project,
paste `RAILWAY_TOKEN` into repo secrets, enable Pages.

## Milestones

1. Scaffolding: workspaces, tsconfig, eslint, vitest, empty packages compile.
2. `core` sim with full unit tests.
3. `protocol` with canary tests.
4. `server` with integration tests.
5. `client`: lobby, socket, interpolation, canvas render, webcam bubbles.
6. Gear overlays, level-up picker, stats screen charts.
7. Art pass (Kenney download or SVG fallback), styling pass.
8. Local prod-style deploy, curl smoke tests, browser screenshots.
9. GitHub repo, push, CI green, Pages live.

## Ringer Review (pre-PR checklist)

- Utility placement: geometry helpers (circle overlap, vector math) live in
  `core`, imported by client for rendering math — not duplicated. PASS after
  moving `dist2` out of an early `combat.ts` draft into `geometry.ts`.
- Inline styles: all styling via `styles/main.css` rules and CSS custom
  properties; canvas drawing is not CSS. HUD elements use classes. PASS.
- Duplicated utilities: single `rng`, single `geometry`, single codec; the
  client must not re-implement clamping — it renders server truth. PASS.
- Duplicated style rules: one button style, one panel style, shared via
  classes; gear cards compose panel + card modifiers. PASS.
- Testable interfaces: `PlatformServices` for camera/storage, `Clock` and
  rng injected into the server loop, codec pure. PASS.
- Single-purpose functions: `step` composes phase functions
  (applyInputs, advanceProjectiles, resolveHits, collectOrbs, spawnWave);
  each phase is separately tested. PASS.
- Comments: none; names carry the meaning. Exception: license attribution
  in `ASSETS.md`, which is documentation, not comments. PASS.
- Unit + integration tests: per package as listed above; CI runs all. PASS.

Adjustments made by this review: geometry extracted to its own module;
cam-frame relay rate limit moved from `rooms.ts` into `relay.ts` so rooms
have one purpose; stats accumulation moved out of `combat.ts` into
`stats.ts` so damage math has one purpose.
