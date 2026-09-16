# Peak Frames: Analysis

Date: 2026-09-15
Commit measured: 32b4d73 (hand-wings)
Host: Linux, AMD GPU, hardware accelerated Chromium via Playwright

## How these numbers were produced

`node tools/perf-probe.mjs --scenario heavy --throttle 4 --seconds 15 --gpu 1`

The probe signs up a real account, creates a group, optionally saves a
spawn-heavy design, launches Chromium with a fake camera, signs in, starts a
run, waits out a warmup, then measures a 15 second window. Bot players join
the same room over WebSocket and send movement and webcam frames at the same
rates a browser would. Nothing in the client is stubbed or modified.

Four facts about the method, so the numbers can be read correctly.

- The client was built unminified for this run so the profiler reports real
  function names. Minification does not change execution speed materially.
- The probe wraps canvas methods, `JSON.parse` and `createImageBitmap` to
  count and time them. That instrumentation adds an estimated 0.05ms per
  frame at heavy load, which is inside the noise but is not zero.
- Software rasterization doubles the apparent cost of drawing. The same light
  run measured 6.35ms per frame without GPU and 3.48ms with it. All figures
  below are the GPU-accelerated ones.
- The probe refuses to report a window that was not spent in the fighting
  phase. An earlier heavy run silently measured a frozen scene after all
  players died, and the guard now catches that class of mistake.

## Headline

| Scenario | CPU | fps | p99 frame | frames over 33ms | task per frame | script per frame |
|---|---|---|---|---|---|---|
| light, 1 player, 5 enemies | 1x | 60.0 | 16.8ms | 0 of 900 | 3.48ms | 1.66ms |
| light | 4x | 59.6 | 16.8ms | 2 of 894 | 8.48ms | 3.61ms |
| heavy, 4 players, 315 enemies | 1x | 59.6 | 16.8ms | 2 of 894 | 12.26ms | 10.62ms |
| heavy | 4x | 14.1 | 100.0ms | 212 of 212 | 70.07ms | 54.67ms |

The game holds a locked 60fps on a fast machine in every scenario tested. It
is not currently janky. What it is not is efficient: a heavy room already
spends 73 percent of the frame budget at full speed, so a machine four times
slower collapses to 14fps with every single frame missing vsync.

Heavy room composition during the measured window: 315 enemies on average and
386 at peak, 4 players each streaming webcam, 5 orbs, 944 KB per second of
snapshot JSON at 20 snapshots per second.

## Cost centres, heavy room at full CPU speed

Self time over 15 seconds, roughly 894 frames.

| Cost | Self time | Per frame | What it is |
|---|---|---|---|
| Native `drawImage` | 6683ms | 7.5ms | 318 sprite draws per frame, all from SVG images |
| Webcam JPEG encode | 1546ms | 1.7ms avg | `canvas.toBlob` on the main thread, 107 calls, 14.4ms each |
| Webcam JPEG decode | 306ms | 0.34ms | 537 decodes, `Blob` plus `createImageBitmap` |
| Interpolation | 226ms | 0.25ms | `lerpById` and its callback |
| Snapshot decode | 80ms | 0.09ms | `JSON.parse` of 14.1 MB over the window |
| Sprite lookup | 53ms | 0.06ms | `SpriteStore.ready` per entity per frame |
| Scene and player draw | 77ms | 0.09ms | `drawScene` plus `drawPlayer` own work |
| HUD and build panel | 28ms | 0.03ms | `updateHud`, including a per-frame `JSON.stringify` |
| Garbage collector | 75ms | 0.08ms | dominated by snapshot objects |

Draw calls per frame in the heavy room: 318 `drawImage`, 138 `fillRect`, 41
`beginPath`, 27 `stroke`, 18 `arc`, 10 `fill`, 5 `createRadialGradient`.

## The single biggest finding, verified in isolation

Every enemy and every gear item is an SVG `HTMLImageElement` drawn with
`drawImage` at a scaled size. A direct micro-benchmark on this machine, 315
draws of one enemy sprite at its real size, repeated 60 times:

| Source | Median | p95 |
|---|---|---|
| SVG image, scaled | 5.80ms | 11.7ms |
| Canvas cache, scaled | 0.40ms | 11.6ms |
| ImageBitmap, scaled | 0.40ms | 11.2ms |
| ImageBitmap, 1:1 | 0.40ms | 11.5ms |

Pre-rasterizing each sprite once into a bitmap keyed by its draw size is
roughly 14 times faster for the same visual result. Against the measured
7.5ms per frame of sprite drawing, this is worth about 5.4ms per frame in a
heavy room, which is 44 percent of the entire heavy frame budget.

## The second finding: the webcam encoder stalls the main thread

`canvas.toBlob` costs 14.4ms of main thread time per call in a heavy room and
runs every 140ms. That is a 14ms stall roughly seven times a second, on a
frame budget of 16.7ms. It is the most likely cause of the isolated dropped
frames seen at 1x, and at 4x it becomes 1520ms of the 15 second window.

Related, on the receiving side: at 4x the average latency from starting a
webcam decode to getting the bitmap was 227ms across 546 decodes. Every
arriving frame starts a decode even when the previous one has not finished,
so under load the decodes queue and the faces on screen visibly lag.

## Two quadratics that are cheap now and will not stay cheap

Neither is currently a top cost, but both grow with the square of entity
count, so they are the items most likely to turn a busy room into an
unplayable one.

- `lerpById` in `net/interpolation.ts` runs `older.find(...)` for every
  entity every frame. At 315 enemies that is about 99,000 comparisons per
  frame, measured at 226ms over the window.
- `detectAudioEvents` in `audio/events.ts` compares projectile and orb lists
  with nested `some(...)` on every snapshot, 20 times a second. It surfaced
  at 57ms in the throttled heavy run.

## Waste that is small but free to remove

- `renderBuild` calls `JSON.stringify` on the build summary every frame purely
  to detect change.
- `stackGear` recomputes the whole gear layout, including a seeded RNG and a
  string hash, for every player every frame, though it only changes when gear
  changes.
- `drawScene` calls `canvas.getContext('2d')` every frame.
- The arena grid is drawn as 23 separate `beginPath`/`stroke` pairs.
- Each orb builds a fresh radial gradient every frame.

## Network, flagged but not recommended yet

The snapshot stream is 944 KB per second in a heavy room, 47 KB per snapshot,
and `JSON.parse` is by far the largest allocator at 1.1 MB per 15 seconds.
On this local link it costs only 0.09ms per frame, but it is the item that
will hurt first on a real network and on memory-constrained phones. Replacing
it with a binary or delta encoding is a large change to the protocol and is
not justified by the frame numbers alone.

## Bottom line

To reach a frame budget that is exemplary rather than merely adequate, the
work is concentrated in two places: stop rasterizing SVGs every frame, and
stop encoding webcam JPEGs on the main thread. Those two alone account for
roughly 9.2ms of the 12.3ms heavy frame. Everything else on the list is
either an algorithmic landmine worth defusing cheaply or small change.

The ranked backlog with effort and expected gain is in
`implementation-plan.md`.

# Phase 2 Results

Date: 2026-09-15
Measured the same four scenarios, same machine, same protocol, with the same
entity counts in the heavy room (315 enemies, 4 players, all snapshots in the
fighting phase). Raw results are in `after/`, baselines in `baseline/`.

## Frame rate and budget

| Scenario | CPU | fps before | fps after | task/frame before | task/frame after | frames over 33ms |
|---|---|---|---|---|---|---|
| light | 1x | 60.0 | 60.0 | 3.48ms | 3.21ms | 0 to 0 |
| light | 4x | 59.6 | 59.7 | 8.48ms | 7.72ms | 2 to 1 |
| heavy | 1x | 59.6 | 60.1 | 12.26ms | 6.98ms | 2 to 0 |
| heavy | 4x | 14.1 | 56.2 | 70.07ms | 17.11ms | 212 of 212 to 14 of 843 |

The headline is the throttled heavy room: 14.1fps to 56.2fps, a four times
improvement, with the worst frame falling from 116.6ms to 49.9ms. At full
speed the heavy room now uses 42 percent of the frame budget instead of 73
percent, and no longer drops a frame.

## Where the time went

Self time over 15 seconds in the heavy room at full speed.

| Cost | Before | After | Change |
|---|---|---|---|
| Native `drawImage` | 6683ms | 1960ms | 3.4x less |
| Webcam encode | 1546ms `toBlob` | 587ms `convertToBlob` | 2.6x less |
| Interpolation | 175ms | 84ms | 2.1x less |
| Script per frame | 10.62ms | 4.68ms | 2.3x less |

Canvas calls per frame in the heavy room: `beginPath` 41.1 to 8.1, `stroke`
27.0 to 5.0, `fill` 10.0 to 0.1, `createRadialGradient` 5.0 to 0. The sprite
cache adds its own bookkeeping, 144ms of `rendered` and 113ms of `ready` over
the window, which is the price of the 4.7 seconds it removed.

Webcam decode latency in the throttled heavy room fell from 227ms average per
frame to 49ms, so faces stay current under load instead of visibly lagging.

## What was deliberately not done

Three items from the backlog were dropped after measurement rather than
implemented, each because the evidence did not justify the change.

- The `stackGear` memo, the `getContext` hoist and the per-frame scene deps
  object were all below the profiler's top eighteen, which puts each under
  0.03ms per frame. Adding caches or module state for unmeasurable gains
  would trade clarity for nothing.
- Decode-time resizing, because captured frames are already 96 pixels and the
  drawn bubble is 61 to 123 device pixels.

Item 8, the 944 KB per second snapshot stream, remains deferred. It is still
the largest allocator at 1.1 MB per 15 seconds and is unchanged by this work.
