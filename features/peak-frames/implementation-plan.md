# Peak Frames: Ranked Backlog and Phase 2 Plan

Every gain below is measured against the heavy room at full CPU speed, where
the frame costs 12.26ms of a 16.7ms budget. Items are ordered by gain divided
by effort.

## Improvement backlog

### 1. [HIGH] Pre-rasterize sprites into a bitmap cache

- What: `SpriteStore` returns SVG `HTMLImageElement`s that the scene draws
  scaled, 318 times per frame. Add a cache that rasterizes each art path once
  per draw size into an `ImageBitmap` and returns that instead.
- Why: measured at 5.80ms versus 0.40ms for 315 draws, a 14x reduction.
  Expected saving is about 5.4ms per heavy frame, 44 percent of the budget.
- Suggested approach: keep `SpriteStore.ready(path)` as the loading gate and
  add `bitmap(path, width, height)` that key-caches on rounded size. Rasterize
  in an offscreen canvas on first request and return undefined until ready, so
  the existing "draw nothing until loaded" behaviour is unchanged. Scene call
  sites change from the image to the bitmap. Sizes come from `placeGear` and
  `enemy.radius * 2.2`, both already deterministic, so the cache stays small.
- Pros: by far the largest win; contained in one class plus two call sites;
  no visual change; testable without a browser by injecting a rasterizer.
- Cons: a second cache keyed by size can grow if a design uses many enemy
  radii, so it needs an eviction rule or a rounded size bucket; `ImageBitmap`
  needs closing when evicted or it leaks GPU memory.

### 2. [HIGH] Get the webcam JPEG encode off the main thread

- What: `capture.ts` calls `canvas.toBlob` every 140ms, measured at 14.4ms of
  main thread time per call in a heavy room.
- Why: a 14ms stall seven times a second against a 16.7ms budget. It is the
  most likely cause of the isolated dropped frames at full speed and 1520ms
  of the 15 second window at 4x.
- Suggested approach: try `OffscreenCanvas.convertToBlob` first, which
  Chromium can encode off the main thread, and measure with the probe before
  committing to anything larger. If that does not move the number, move
  capture into a worker fed by `grabFrame` or a transferred `OffscreenCanvas`.
  Add an adaptive floor either way: skip a capture when the previous frame
  took longer than the budget.
- Pros: removes the largest single stall; `convertToBlob` is a small change
  with a clean fallback to the current path.
- Cons: `OffscreenCanvas` support needs a runtime check and a fallback branch,
  which is exactly the kind of conditional that rots; a worker version is a
  real chunk of plumbing for a feature that currently works.

### 3. [HIGH] Backpressure and right-size the webcam decode

- What: `CamFeeds.accept` starts a `createImageBitmap` for every arriving
  frame, 36 a second with three peers, with no regard for whether the previous
  decode finished.
- Why: 227ms average decode latency under 4x load, so faces visibly lag when
  the game is busy, plus 306ms of CPU in the heavy window.
- Suggested approach: keep one in-flight decode per player and drop frames
  that arrive while it is running, since a stale face is worthless once a
  newer one exists. Pass `resizeWidth` and `resizeHeight` matching the drawn
  bubble size so the decoder produces the final size directly.
- Pros: pure win, fewer decodes and smaller bitmaps, and the visible result is
  fresher faces; `CamFeeds` is already an isolated class with a narrow API.
- Cons: dropping frames must not strand the last bitmap if the final frame of
  a burst is the dropped one, so the newest pending frame has to be kept.

### 4. [HIGH] Replace the quadratic interpolation lookup

- What: `lerpById` calls `older.find(...)` per entity per frame.
- Why: about 99,000 comparisons per frame at 315 enemies, measured at 226ms.
  The cost grows with the square of entity count, so it is the item most
  likely to make a very busy room unplayable.
- Suggested approach: build one `Map` of id to entity per list per
  interpolation and look up from it.
- Pros: a few lines, no behaviour change, and an existing test file to extend;
  removes a scaling cliff for the price of one allocation per list.
- Cons: essentially none.

### 5. [MEDIUM] Stop recomputing derived UI state every frame

- What: `renderBuild` stringifies the build summary each frame to detect
  change; `stackGear` recomputes gear layout, seeded RNG and a string hash for
  every player every frame; `drawScene` calls `getContext('2d')` per frame.
- Why: small individually, 28ms plus allocation churn together, and all three
  are recomputation of values that only change on a gear pick.
- Suggested approach: derive a cheap signature for the gear list and memoize
  both the build summary and the stack layout on it; hoist the context.
- Pros: removes per-frame garbage, which also reduces collector pauses;
  memoizing on a gear signature is easy to unit test.
- Cons: a cache keyed on a signature is a correctness risk if the signature
  misses a field, so the test has to cover the invalidation, not just the hit.

### 6. [MEDIUM] Cheaper arena and orb drawing

- What: the grid is 23 `beginPath`/`stroke` pairs; each orb builds a fresh
  radial gradient every frame.
- Why: fixed overhead on every frame regardless of load, and gradients are the
  most expensive fill kind.
- Suggested approach: build the grid once as a `Path2D` and stroke it in one
  call; pre-render one orb to a small bitmap and blit it, which folds into the
  item 1 cache.
- Pros: the grid change is trivial and removes 22 draw calls per frame; the
  orb change reuses the sprite cache rather than adding a mechanism.
- Cons: a pre-rendered orb fixes its glow radius, so a design that ever varies
  orb size would need a keyed cache like the sprites.

### 7. [MEDIUM] De-quadratic the audio event detection

- What: `detectAudioEvents` uses nested `some(...)` over projectiles and orbs
  on every snapshot.
- Why: 57ms in the throttled heavy run and quadratic in entity count.
- Suggested approach: build `Set`s of ids once per call, matching what the
  function already does for enemies.
- Pros: trivial, and it makes the three branches of the function consistent
  with each other.
- Cons: none.

### 8. [LOW] Shrink the snapshot stream

- What: 944 KB per second, 47 KB per snapshot, the largest single allocator at
  1.1 MB per 15 seconds.
- Why: only 0.09ms per frame on a local link, but it is what will hurt first
  on a real network and on a phone.
- Suggested approach: not yet. If it is taken up later, the cheap half is
  trimming fields the client never reads and rounding positions before
  serialising; the expensive half is a binary or delta encoding.
- Pros: large bandwidth and allocation reduction.
- Cons: a protocol change touches core, protocol, server, client and the
  codec canary tests, and the frame numbers do not currently justify it.

## Suggested Phase 2 scope

Items 1 through 4 are the ones the measurements support: together they
address roughly 9.2ms of the 12.3ms heavy frame and remove the scaling cliff.
Items 5 through 7 are cheap enough to fold in alongside. Item 8 should wait
for a measurement taken over a real network rather than this local link.

## How Phase 2 would be verified

- Every item gets unit tests first, in the package that owns it: `SpriteStore`
  and `CamFeeds` with injected fakes, `lerpById` and `detectAudioEvents` in
  core and client test files that already exist.
- The probe is the acceptance test. Before-and-after runs of all four
  scenarios, with the JSON committed under this folder, so the claim is a
  measurement rather than an assertion.
- The existing browser pass confirms the picture is unchanged: same bubbles,
  same wings, same HUD.
- `npm run check` and `npm run smoke` as always.

## Ringer checklist for the Phase 2 work

- Misplaced utility: rasterization belongs in `SpriteStore`, not in the scene;
  decode backpressure belongs in `CamFeeds`, not in the socket handler;
  memoization of the build summary belongs beside `buildSummary`.
- Inline styles: not applicable, canvas and existing CSS only.
- Duplicated utilities: the orb bitmap must reuse the sprite cache rather than
  introduce a second one; the gear signature must be computed once and shared
  by the build panel and the stack layout.
- Testable interfaces: the rasterizer and the decoder are injected so both are
  testable without a browser.
- Single purpose: cache lookup, rasterization and drawing stay three separate
  functions.
- Comments: none.
- Tests: unit per item, plus probe runs as integration evidence.

## Validation

To validate peak-frames Phase 1 you can start the local server and preview,
then run `PLAYWRIGHT_PATH=<path> node tools/perf-probe.mjs --scenario heavy
--throttle 4 --seconds 15 --gpu 1` and compare against the tables in
`analysis.md`.
