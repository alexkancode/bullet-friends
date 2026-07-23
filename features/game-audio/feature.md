# Game Audio

Sound effects for game events and looping background music, from free CC0
assets, with a persisted mute control.

## Mutual Understanding

Agreed in conversation on 2026-07-23.

- Sound effects: firing, enemy hit, enemy down, orb pickup, level up, gear
  pick, countdown ticks, wave start, player down, run over.
- Looping music: an energetic loop while fighting, a calm loop in lobby,
  shop, and stats screens.
- Assets are free/CC0. Kenney's packs sit behind a scripted download modal,
  so the assets are first-party: a committed generator renders every WAV
  deterministically and they ship as our own CC0 files (ASSETS.md updated).
- A mute toggle sits in the corner of the app and persists across visits.
- Audio unlocks on the Play click, respecting browser autoplay rules.

## Audio Flow

```mermaid
flowchart LR
    SNAP[snapshot n-1 vs n]:::data
    DETECT[detectAudioEvents\npure diff]:::logic
    PHASE[musicForPhase\npure map]:::logic
    ENGINE[AudioEngine\npools + music + mute]:::engine
    FILES[(public/audio/*.wav\ngenerated, CC0)]:::assets
    TOGGLE[mute toggle\npersisted]:::ui
    PLAY[Play click\nunlocks audio]:::ui

    SNAP --> DETECT --> ENGINE
    SNAP --> PHASE --> ENGINE
    FILES --> ENGINE
    TOGGLE --> ENGINE
    PLAY --> ENGINE

    classDef data fill:#bfdbfe,stroke:#1d4ed8,color:#1e3a8a
    classDef logic fill:#bbf7d0,stroke:#15803d,color:#14532d
    classDef engine fill:#fde68a,stroke:#b45309,color:#78350f
    classDef assets fill:#e9d5ff,stroke:#7e22ce,color:#581c87
    classDef ui fill:#fecaca,stroke:#b91c1c,color:#7f1d1d
```

Everything audible is derived from state the client already has: events come
from diffing consecutive snapshots, music from the current phase. The engine
is the only piece that touches the DOM audio APIs.
