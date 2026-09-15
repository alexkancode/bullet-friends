# Hand Wings

A new hand slot for weapons and hand-held objects. Hand items alternate
right and left of the bubble, spread up and down each side with seeded
jitter, and step outward as they stack, so a loaded build reads like wings.

## Mutual Understanding

Agreed in conversation on 2026-09-15.

- Gear gains a fifth slot, `hand`. The slot list lives once in core and the
  design validator and the designer both read it, so custom designs can
  use the slot immediately.
- Three default hand items with original CC0 SVG art in the house style:
  Wooden Sword (+20% damage), Slingshot (+12% attack speed), Torch
  (+15 max HP, +5% move speed). Numbers live in the catalog and are easy
  to tune.
- Placement: hand items alternate sides in pick order, first right, then
  left. Each sits just outside the circle edge, never over the face. Left
  side art is mirrored so it points outward.
- On each side the items spread evenly across a vertical band around the
  centre, each with a seeded vertical nudge, and every further item on a
  side steps a little further out. Seeding is per player, stable per
  frame and identical on every client, as with the existing horizontal
  jitter.
- Stats stack like every other item and the build panel counts them.

## Wing Layout

```mermaid
flowchart LR
    G[hand items in pick order<br/>1 2 3 4 5 6]:::in --> A{alternate}:::decide
    A -->|odd| R[right side<br/>1 3 5]:::right
    A -->|even| L[left side, mirrored<br/>2 4 6]:::left
    R --> RV[spread across the side band<br/>top to bottom, seeded nudge]:::spread
    L --> LV[spread across the side band<br/>top to bottom, seeded nudge]:::spread
    RV --> RO[each further item steps outward]:::out
    LV --> LO[each further item steps outward]:::out
    RO --> W[wings]:::win
    LO --> W

    classDef in fill:#e5e7eb,stroke:#6b7280,color:#111827
    classDef decide fill:#e9d5ff,stroke:#7e22ce,color:#581c87
    classDef right fill:#bfdbfe,stroke:#1d4ed8,color:#1e3a8a
    classDef left fill:#fde68a,stroke:#b45309,color:#78350f
    classDef spread fill:#e5e7eb,stroke:#6b7280,color:#111827
    classDef out fill:#fecaca,stroke:#b91c1c,color:#7f1d1d
    classDef win fill:#bbf7d0,stroke:#15803d,color:#14532d
```

## Bubble Bands, Updated

```mermaid
flowchart TB
    HAT["hat band, above"]:::hat
    EYES["eyes band, top inside"]:::eyes
    subgraph MID[" "]
        direction LR
        LH["hand, left<br/>mirrored"]:::hand
        FACE["face, clear"]:::face
        RH["hand, right"]:::hand
        LH --- FACE --- RH
    end
    NOSE["nose band, bottom inside"]:::nose
    MOUTH["mouth band, below"]:::mouth
    HAT --> EYES --> MID --> NOSE --> MOUTH

    classDef hat fill:#e9d5ff,stroke:#7e22ce,color:#581c87
    classDef eyes fill:#bfdbfe,stroke:#1d4ed8,color:#1e3a8a
    classDef face fill:#bbf7d0,stroke:#15803d,color:#14532d
    classDef hand fill:#fecaca,stroke:#b91c1c,color:#7f1d1d
    classDef nose fill:#fde68a,stroke:#b45309,color:#78350f
    classDef mouth fill:#fecaca,stroke:#b91c1c,color:#7f1d1d
```
