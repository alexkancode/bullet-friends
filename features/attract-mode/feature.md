# Attract Mode

A dimmed, bot-driven game runs behind every pre-game screen, so the menus
float over live bullet-hell action instead of a black void.

## Mutual Understanding

Agreed in conversation on 2026-07-23.

- Behind auth, consent, group, and ready screens, the real simulation runs
  locally with three AI bots (initial-letter bubbles) fighting waves,
  auto-picking gear, dying, and restarting forever.
- The canvas renders it at dimmed opacity so foreground panels stay
  readable.
- The moment the player joins a room, the demo stops and the canvas belongs
  to the live game. No server traffic, no audio, no HUD for the demo.

## How It Runs

```mermaid
flowchart LR
    CORE[core.step\nsame sim as the server]:::core
    BOTS[botInputs\nflee enemies, chase orbs]:::bots
    LOOP[DemoLoop\nfixed-step accumulator\nauto shop, auto restart]:::loop
    DRAW[drawScene\nexisting renderer]:::draw
    DIM[.canvas-dimmed\nopacity rule]:::dim
    JOIN{joined a room?}:::gate

    BOTS --> LOOP
    CORE --> LOOP
    LOOP --> DRAW --> DIM
    JOIN -->|no| LOOP
    JOIN -->|yes| LIVE[live snapshots\nfull opacity]:::live
    LIVE --> DRAW

    classDef core fill:#bbf7d0,stroke:#15803d,color:#14532d
    classDef bots fill:#fde68a,stroke:#b45309,color:#78350f
    classDef loop fill:#bfdbfe,stroke:#1d4ed8,color:#1e3a8a
    classDef draw fill:#e9d5ff,stroke:#7e22ce,color:#581c87
    classDef dim fill:#2c2c2a,stroke:#898781,color:#c3c2b7
    classDef gate fill:#fecaca,stroke:#b91c1c,color:#7f1d1d
    classDef live fill:#fecaca,stroke:#b91c1c,color:#7f1d1d
```

Nothing is faked: the background action is the exact simulation players
fight in, seeded deterministically, driven by a pure bot-input function.
