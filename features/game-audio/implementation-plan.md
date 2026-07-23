# Game Audio — Implementation Plan

Alias: `game-audio`

## Changes

- `tools/generate-audio.mjs` — dependency-free Node script rendering every
  sound to `packages/client/public/audio/`: ten SFX (square/sine/noise
  envelopes) and two ~8s music loops (battle: bass line, pentatonic arp,
  noise hats; calm: slow chord pad and soft arp) at 22.05kHz mono 16-bit
  WAV. Deterministic output, committed alongside the assets it produces.
- `packages/client/src/audio/events.ts` — `AudioEventName` union,
  `SOUND_FILES` map, `detectAudioEvents(prev, next, selfId)` pure snapshot
  diff, and `musicForPhase(phase)`.
- `packages/client/src/audio/engine.ts` — `AudioEngine`: `enable()` (Play
  click gesture), `play(name)` via small element pools, `setMusic(track)`
  with loop + phase switching, `setMuted(muted)`; no-ops before `enable`.
- `packages/client/src/platform/services.ts` — `loadAudioMuted` /
  `saveAudioMuted` beside the session storage.
- `packages/client/src/main.ts` — snapshot handler feeds the detector with
  the previous raw snapshot; phase changes retarget music; a fixed corner
  mute toggle (`.audio-toggle` style rule) reflects and persists state.
- `ASSETS.md` — audio section: first-party, CC0, regenerable via the tool.

## Testing (TDD order)

1. `events` unit tests: each event fires on the right diff (shot appears,
   enemy hp drop, enemy disappears mid-fight, orb collected vs wave-end
   sweep, self level up only, player down, phase transitions, countdown
   second boundaries), and quiet frames produce no events.
2. `musicForPhase` mapping covers every phase.
3. Asset canary: every `SOUND_FILES` entry exists on disk as a RIFF/WAVE
   file with nonzero data (locks code and generated assets together).
4. Engine stays thin and DOM-bound; validated in the browser pass.

## Ringer Review (pre-PR checklist)

- Utility placement: diff logic beside the event types in `audio/`;
  generation in `tools/`, not shipped client code. PASS.
- Inline styles: mute toggle styled by a class rule. PASS.
- Duplication: detector reuses `GameState` types; no second snapshot store
  (main.ts already tracks the previous raw state for it). PASS.
- Testable interfaces: detector and phase map are pure; engine is an
  injectable object with a tiny surface. PASS.
- Single purpose: generator makes files, detector makes names, engine makes
  noise. PASS.
- Comments: none. PASS.
- Tests: detector suite, mapping suite, asset canary. PASS.
