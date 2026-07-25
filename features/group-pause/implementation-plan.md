# Group Pause — Implementation Plan

Alias: `group-pause`

## Changes

- `packages/core` — `GameState` gains `pausedBy` ('' when live) and
  `pausedMs` (current instance accumulator). `pauseGame(state, byName)`
  (fighting/countdown only, idempotent), `resumeGame(state)`. `step`
  short-circuits while paused, accumulating `pausedMs` — the phase itself
  never changes, so resume restores exactly where the room was.
- `packages/protocol` — client `pause` and `resume` messages (no payload;
  the server knows the sender); fixtures and canaries updated.
- `packages/server` — room handlers map the sender to their player name
  and call the core functions; no new broadcast, snapshots already carry
  the state.
- `packages/client` — Esc keydown toggles pause/resume when joined and in
  a pausable phase; a pause modal (existing overlay/panel rules plus small
  `.pause-*` classes) shows "<name> Paused", the stopwatch formatted from
  `pausedMs`, and a Resume button. The stopwatch updates from snapshots.
- Canary for round-end semantics: with two players, one death leaves the
  run in fighting; only the last player falling ends it.

## Testing (TDD order)

1. Core: pausing freezes everything (enemies, projectiles, wave timer,
   countdown) across steps while `pausedMs` accumulates; resume restores
   stepping; pause refused in lobby/shopping/runOver; second pause does
   not steal the first pauser's name; resume resets the instance clock.
2. Core canary: one of two players dying does not end the run.
3. Protocol: fixture round-trips for `pause`/`resume`.
4. Server integration: A pauses, B's snapshots show the name and a frozen
   world; B resumes and the world moves again.
5. Client: stopwatch formatting unit test; modal verified by screenshots.

## Ringer Review (pre-PR checklist)

- Utility placement: pause rules in core beside the other phase logic;
  formatting helper beside the HUD utilities. PASS.
- Inline styles: modal styled by class rules reusing panel tokens. PASS.
- Duplication: no new sync channel — snapshots carry everything; Esc
  handling joins the existing keyboard module's listener pattern. PASS.
- Testable: pause/resume are pure state functions; formatting is pure.
  PASS.
- Single purpose: pauseGame guards and sets, resumeGame clears, step
  accumulates. PASS.
- Comments: none. PASS.
- Tests: suites above, all in CI. PASS.
