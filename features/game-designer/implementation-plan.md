# Game Designer — Implementation Plan

Alias: `game-designer`

## Core (`packages/core`)

- `design.ts` — `EnemyDesign`, `LevelDesign`, `GameDesign` types;
  `defaultDesign()` expressing today's enemies, gear, and wave formulas as
  data; `designEnemy(design, id)` and `designGear(design, id)` lookups.
- `designValidate.ts` — `sanitizeDesign(input)`: structural checks, numeric
  clamps (hp, speed, radius, damage, xp, weight, durations), entry caps
  (20 enemies, 24 gear, 30 levels), art must be a bundled path or a
  `data:image/` URL under 96KB, whole design under 700KB. Shared by server
  and client, so it lives in core.
- Sim refactor: `step`, `startRun`, `pickGear`, `beginWave`, `spawnEnemy`,
  `computeStats`, `rollOffers` take a `design` argument that defaults to
  `defaultDesign()` — existing call sites and tests stay valid; spawning
  reads the current level's mix and rate; runs past the last level repeat
  it; enemy hp scaling formula stays, applied to designed base hp.
  `EnemyState` carries the design enemy id (string) instead of the old
  fixed union.

## Protocol (`packages/protocol`)

- Client `setDesign { design }` (lobby only), server `design { design }`
  broadcast; fixtures and canaries updated.

## Server (`packages/server`)

- Rooms hold `design`; `setDesign` sanitizes then broadcasts; `start` and
  every loop tick pass the room design into the sim; new joiners receive
  the current design message.
- `GroupStore` gains `saveDesign(ownerId, design)` (create or update by
  id + ownership), `listDesigns(ownerId)`, `getDesign(id)`; memory and
  Firestore (design stored as one JSON string field, inside the 1MiB doc
  limit by construction of the caps).
- REST: `GET /api/designs`, `POST /api/designs`, `GET /api/designs/:id`
  (owner only, 404 unknown, 400 on designs that fail sanitizing).

## Client (`packages/client`)

- Renderer reads enemy and gear art from a `currentDesign` (updated by the
  design broadcast, reset to default per room); `SpriteStore` already
  handles any `img.src`, including data URLs.
- Ready step gains a design picker (Classic + saved designs) and a Design
  Studio button; Play sends `setDesign` after joining when a custom design
  is chosen.
- `ui/designer.ts` — the studio overlay: tabbed Levels / Enemies / Gear
  sections; each entry renders art beside labeled numeric fields; image
  upload downscales to 96px PNG data URLs on a canvas before it touches
  the design; add-new clones a sensible template entry; Save posts to the
  API; name field tops the panel.
- Editing helpers are pure and tested: `updateEnemy`, `updateGear`,
  `addEnemy`, `addGear`, `addLevel`, `updateLevel` produce new design
  objects and re-sanitize.

## Testing (TDD order)

1. Core design tests: default design equals the legacy tables; custom
   design spawns only its own enemy ids at its own rates; level list is
   honored and the last level repeats; custom gear flows through offers,
   picks, and stats.
2. `sanitizeDesign` suite: valid passthrough, clamping, cap enforcement,
   art rules, garbage rejection, oversize rejection.
3. Editing helper tests: each helper returns a valid design and leaves the
   original untouched.
4. Protocol canaries for the two new messages.
5. Server integration: setDesign in lobby changes what spawns (snapshot
   carries the custom enemy id) and broadcasts to both clients; invalid
   design is ignored; REST designs happy path plus 401/400/404 and
   ownership.
6. Studio rendering, uploads, and end-to-end play validated in the browser
   with screenshots.

## Ringer Review (pre-PR checklist)

- Utility placement: validation in core (shared), storage in the store,
  studio DOM in `ui/designer.ts`, image downscale in `ui/assetUpload.ts`.
  PASS.
- Inline styles: studio uses existing panel/field/button rules plus a
  small set of `.designer-*` classes. PASS.
- Duplication: one design lookup module; renderer and sim share it; no
  second sprite cache. PASS.
- Testable interfaces: design is plain data through pure functions; the
  studio's mutations are pure helpers; sim changes ride existing tests via
  the default argument. PASS.
- Single purpose: sanitize validates, helpers edit, studio renders, store
  persists. PASS.
- Comments: none. PASS.
- Tests: suites above, all in CI. PASS.

Adjustments made by this review: design kept out of `GameState` so
snapshots stay small (it broadcasts once per room instead); art upload
downscaling moved client-side so the server only ever validates size.
