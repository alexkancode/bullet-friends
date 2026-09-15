# Stacked Builds

Pickup range becomes a real build choice, items can be picked more than once
and stack, and a build panel on the left of the arena shows what you own and
what it adds up to.

## Mutual Understanding

Agreed in conversation on 2026-09-14, after playing in production.

- Analysis of the current state: base pickup radius is 90 px in a 1600 by
  900 arena; only the Monocle touches it (times 1.35, about 121 px); the
  shop never re-offers an owned item, so no build can stack anything and
  the shop runs dry after eight picks.
- Pickup is made substantial: Monocle becomes times 1.5 per copy,
  compounding. One copy 135 px, two 202 px, three 304 px. Core integration
  tests simulate orb pickup at fixed distances to lock the effect.
- Items stack: the shop may re-offer owned items, each roll still shows
  three different items, every copy applies its modifiers again (flat adds,
  multipliers compound), no cap on copies. The bubble draws each unique
  item once. The shop skips itself only when the design has no gear.
- Build panel: while the HUD is visible, a column on the left lists each
  owned item with a count and the five stats with their current value and
  multiplier against base when changed.

## Pickup Radius by Monocle Count

```mermaid
xychart-beta
    title "Pickup radius (px) by Monocle copies"
    x-axis ["0", "1", "2", "3", "4"]
    y-axis "radius px" 0 --> 500
    bar [90, 135, 202, 304, 456]
```

## Stacking Flow

```mermaid
flowchart LR
    W[wave ends]:::calm --> R[rollOffers: 3 distinct items<br/>from the whole design]:::pick
    R --> P[player picks Monocle again]:::pick
    P --> G[gear list: monocle, monocle]:::stack
    G --> S[computeStats: 90 x1.5 x1.5 = 202]:::stack
    S --> C[collectOrbs uses 202 px]:::hot
    G --> D[scene draws unique items once]:::calm
    G --> B[build panel: Monocle x2<br/>Pickup Range 202 x2.25]:::panel

    classDef calm fill:#e5e7eb,stroke:#6b7280,color:#111827
    classDef pick fill:#fde68a,stroke:#b45309,color:#78350f
    classDef stack fill:#e9d5ff,stroke:#7e22ce,color:#581c87
    classDef hot fill:#fecaca,stroke:#b91c1c,color:#7f1d1d
    classDef panel fill:#bbf7d0,stroke:#15803d,color:#14532d
```
