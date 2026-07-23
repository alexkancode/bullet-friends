# Attract Mode — Implementation Plan

Alias: `attract-mode`

## Changes

- `packages/client/src/attract/bots.ts` — pure `botInputs(state)`: each
  alive bot blends fleeing the nearest enemy, drifting toward the nearest
  orb, and a gentle pull back to center.
- `packages/client/src/attract/demo.ts` — `DemoLoop(seed)`: owns a
  `GameState` with three named bots, starts a run immediately, and
  `advance(deltaMs)` steps the sim on the fixed tick via an accumulator,
  auto-picks the first gear offer in shopping, and restarts the run a
  couple of seconds after `runOver`. Deterministic for a given seed.
- `packages/client/src/main.ts` — the frame loop renders
  `demo.advance(delta)` through the existing `drawScene` whenever the
  player has not joined a room, and toggles `.canvas-dimmed` on the canvas
  accordingly. Audio and HUD remain wired only to live snapshots.
- `packages/client/src/styles/main.css` — `.canvas-dimmed` opacity rule
  with a short transition.

## Testing (TDD order)

1. `botInputs`: flees a close enemy (move points away), seeks an orb when
   safe, sits still with nothing around, skips downed bots.
2. `DemoLoop`: starts in fighting with three bots; accumulates partial
   deltas into whole ticks; auto-resolves shopping into the countdown;
   restarts after run over; two loops with the same seed advance
   identically (determinism canary).
3. Rendering and dimming verified by screenshot.

## Ringer Review (pre-PR checklist)

- Utility placement: bot steering and the loop live in `attract/`; they
  import core rather than duplicating any sim logic. PASS.
- Inline styles: dimming is a class rule, toggled by name. PASS.
- Duplication: rendering reuses `drawScene` untouched; the demo reuses
  `startRun`/`step`/`pickGear` from core. PASS.
- Testable interfaces: `botInputs` pure, `DemoLoop.advance` deterministic
  with injected seed. PASS.
- Single purpose: bots steer, the loop schedules, main toggles. PASS.
- Comments: none. PASS.
- Tests: unit suites for both modules plus a determinism canary. PASS.
