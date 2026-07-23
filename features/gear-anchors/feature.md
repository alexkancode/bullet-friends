# Gear Anchors

Gear must decorate the webcam bubble without hiding the face. Every slot gets
a band anchored to the circle's edges instead of fixed offsets that drift
into the middle.

## Mutual Understanding

Agreed in conversation on 2026-07-23.

- Hats sit fully above the head, resting on the top of the circle.
- Eye gear sits just below the hat, in the top band inside the circle.
- Nose gear sits at the bottom edge inside the circle.
- Mouth gear hangs just below the circle.
- The middle of the bubble — the face — stays clear no matter which gear is
  equipped.
- A new `nose` slot joins the gear model; Mustache moves to it, Bubble Pipe
  stays a mouth item.

## Bubble Bands

```mermaid
flowchart TB
    HAT["hat band\nfully above the circle"]:::hat
    EYES["eyes band\ntop of circle, below the hat"]:::eyes
    FACE["face\nalways unobstructed webcam"]:::face
    NOSE["nose band\nbottom edge of circle"]:::nose
    MOUTH["mouth band\nhanging below the circle"]:::mouth

    HAT --> EYES --> FACE --> NOSE --> MOUTH

    classDef hat fill:#e9d5ff,stroke:#7e22ce,color:#581c87
    classDef eyes fill:#bfdbfe,stroke:#1d4ed8,color:#1e3a8a
    classDef face fill:#bbf7d0,stroke:#15803d,color:#14532d
    classDef nose fill:#fde68a,stroke:#b45309,color:#78350f
    classDef mouth fill:#fecaca,stroke:#b91c1c,color:#7f1d1d
```

Placement is computed from the sprite's real aspect ratio and the bubble
radius, so any future art drops into its band without touching the face.
