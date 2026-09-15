# Peak Frames

A measured analysis of client animation performance, a re-runnable probe that
produces the numbers, and a ranked backlog of the work that would make the
frame budget exemplary.

## Mutual Understanding

Agreed in conversation on 2026-09-15.

- Phase 1, this document set, is analysis only. No app code changes.
- The probe drives the real client in headless Chromium against a real local
  server, with real bot players, real webcam capture and real snapshots.
  Nothing is simulated or stubbed.
- Two scenarios, two CPU speeds: a light room (one player, a handful of
  enemies) and a heavy room (four players with webcams, roughly 315 enemies),
  each at 1x and 4x CPU throttle.
- The frame is broken into stages: snapshot decode, interpolation, canvas
  draw, webcam encode, webcam decode, HUD updates, and garbage.
- Deliverables: this understanding, `analysis.md` with the measurements, an
  `implementation-plan.md` holding the ranked backlog for Phase 2, and
  `tools/perf-probe.mjs` so any change can be measured before and after.
- Phase 2 implements whichever backlog items are chosen, TDD, with the probe
  as the before-and-after evidence.

## What The Probe Measures

```mermaid
flowchart LR
    subgraph NODE["probe process"]
        BOT["bot players over ws<br/>input 20/s, cam 12/s"]:::bot
        CDP["CDP: throttle, profiler,<br/>heap sampler, metrics"]:::cdp
    end
    subgraph PAGE["measured page, real client"]
        WS[snapshot stream]:::in
        DEC[JSON decode]:::stage
        INT[interpolation]:::stage
        DRAW[canvas draw]:::stage
        HUD[HUD + build panel]:::stage
        ENC[webcam encode]:::stage
        DECIMG[webcam decode]:::stage
    end
    BOT --> WS
    WS --> DEC --> INT --> DRAW
    INT --> HUD
    ENC --> WS
    WS --> DECIMG --> DRAW
    CDP -.instruments.-> PAGE

    classDef bot fill:#fde68a,stroke:#b45309,color:#78350f
    classDef cdp fill:#e9d5ff,stroke:#7e22ce,color:#581c87
    classDef in fill:#e5e7eb,stroke:#6b7280,color:#111827
    classDef stage fill:#bfdbfe,stroke:#1d4ed8,color:#1e3a8a
```

## Measured Frame Rate

```mermaid
xychart-beta
    title "Frames per second by scenario and CPU speed"
    x-axis ["light 1x", "light 4x", "heavy 1x", "heavy 4x"]
    y-axis "fps" 0 --> 60
    bar [60, 59.6, 59.6, 14.1]
```

## Where The Heavy Frame Goes

Self time over a 15 second heavy run at full CPU speed, largest first.

```mermaid
flowchart TB
    T["heavy frame: 12.3ms of the 16.7ms budget"]:::total
    T --> A["sprite draws 7.5ms<br/>315 SVG images per frame"]:::hot
    T --> B["webcam JPEG encode 1.7ms avg<br/>14ms stall, 7 times a second"]:::hot
    T --> C["webcam decode 0.3ms<br/>36 JPEGs a second"]:::warm
    T --> D["interpolation 0.25ms<br/>quadratic in entity count"]:::warm
    T --> E["snapshot decode 0.09ms<br/>944 KB a second"]:::cool
    T --> F["HUD and build panel 0.03ms"]:::cool

    classDef total fill:#e5e7eb,stroke:#6b7280,color:#111827
    classDef hot fill:#fecaca,stroke:#b91c1c,color:#7f1d1d
    classDef warm fill:#fde68a,stroke:#b45309,color:#78350f
    classDef cool fill:#bbf7d0,stroke:#15803d,color:#14532d
```
