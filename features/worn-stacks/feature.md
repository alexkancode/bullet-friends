# Worn Stacks

Every copy of an item is drawn on the bubble, and items sharing a slot are
spread left to right with a stable, seeded jitter so a stack reads at a
glance.

## Mutual Understanding

Agreed in conversation on 2026-09-15.

- Stat stacking already applies to every item (each copy in the gear list
  applies its modifiers again). No numeric change.
- The bubble draws every copy instead of one per unique item.
- Items that share a slot, duplicates or different items on the same
  anchor, are spread horizontally across the slot band in pick order, with
  a small random jitter on top. A single item in a slot stays centred.
- The jitter is deterministic: seeded from the player id, so it never
  flickers between frames and every client renders the same bubble.

## Spread and Jitter

```mermaid
flowchart LR
    G[player.gear<br/>monocle, top-hat, monocle, monocle]:::in --> S[group by slot<br/>eyes: 3, hat: 1]:::group
    S --> E[even spread across the band<br/>-0.25r, 0, +0.25r]:::spread
    E --> J[seeded jitter per copy<br/>plus or minus 0.08r]:::jitter
    J --> D[draw each copy at x + offset]:::draw
    S -->|hat: 1| C[centred, no jitter]:::draw

    classDef in fill:#e5e7eb,stroke:#6b7280,color:#111827
    classDef group fill:#e9d5ff,stroke:#7e22ce,color:#581c87
    classDef spread fill:#bfdbfe,stroke:#1d4ed8,color:#1e3a8a
    classDef jitter fill:#fde68a,stroke:#b45309,color:#78350f
    classDef draw fill:#bbf7d0,stroke:#15803d,color:#14532d
```
