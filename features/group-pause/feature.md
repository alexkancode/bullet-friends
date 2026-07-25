# Group Pause

Any player can freeze the whole room with Esc; everyone sees who paused and
a live stopwatch; anyone can resume. Runs end only when the last player
falls — now pinned by a test as designed behavior.

## Mutual Understanding

Agreed in conversation on 2026-07-25.

- During fighting or the wave countdown, Esc pauses the simulation for the
  entire room, server-authoritatively: enemies, projectiles, orbs, the wave
  timer, and the countdown all freeze.
- Every player sees a modal: "<Player name> Paused" and beneath it
  "Pause time:" with a stopwatch for the current pause instance.
- Any player can resume with the Resume button or by hitting Esc again.
- Pausing is not available in the lobby, shop, or stats screens (the shop
  already holds the game).
- Round-end semantics, confirmed: a run continues until the last player is
  down; players who fall mid-wave revive at half HP when the wave ends. An
  explicit canary test locks this in.

## Pause Flow

```mermaid
sequenceDiagram
    participant A as Alex (Esc)
    participant S as Server (20Hz)
    participant B as Sam

    A->>S: pause
    S->>S: state.pausedBy = "Alex"\nsim steps become no-ops
    S-->>A: snapshot { pausedBy, pausedMs }
    S-->>B: snapshot { pausedBy, pausedMs }
    Note over A,B: modal "Alex Paused"\nstopwatch ticks from pausedMs
    B->>S: resume
    S->>S: pausedBy cleared,\nsim steps continue
    S-->>A: snapshot (world unfrozen)
    S-->>B: snapshot (world unfrozen)
```

Pause state lives inside `GameState`, so it rides the existing snapshots —
late joiners see the pause instantly and no new sync channel is needed.

```mermaid
stateDiagram-v2
    Fighting --> Paused: any player Esc
    Countdown --> Paused: any player Esc
    Paused --> Fighting: Resume / Esc\n(back to prior phase)
    Paused --> Countdown: Resume / Esc\n(back to prior phase)

    classDef hot fill:#fecaca,stroke:#b91c1c,color:#7f1d1d
    classDef calm fill:#bfdbfe,stroke:#1d4ed8,color:#1e3a8a
    class Fighting,Countdown hot
    class Paused calm
```
