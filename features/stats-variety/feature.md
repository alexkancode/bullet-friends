# Stats Variety

The run-over screen graduates from four identical line charts to a mix of
chart forms, each picked for the job its metric does.

## Mutual Understanding

Agreed in conversation on 2026-07-23.

- A headline stat-tile row opens the screen: waves survived, team kills,
  team damage dealt.
- Kills per wave become grouped bars per player — discrete per-round counts.
- Damage becomes a paired horizontal bar per player: dealt (player color)
  beside taken (neutral gray), a direct magnitude comparison.
- XP stays a line, now cumulative, because it tells the growth story.
- Player identity keeps the validated colorblind-safe palette everywhere;
  the totals table view remains for accessibility.

## Screen Composition

```mermaid
flowchart TB
    TILES["stat tiles\nwaves | team kills | team damage"]:::hero
    LEGEND["player legend"]:::chrome
    BARS["kills per wave\ngrouped bars"]:::bars
    PAIRS["damage dealt vs taken\npaired horizontal bars"]:::pairs
    LINE["total xp\ncumulative lines"]:::line
    TABLE["totals table\naccessible view"]:::chrome

    TILES --> LEGEND --> ROW
    subgraph ROW[chart grid]
        BARS
        PAIRS
        LINE
    end
    ROW --> TABLE

    classDef hero fill:#bbf7d0,stroke:#15803d,color:#14532d
    classDef bars fill:#bfdbfe,stroke:#1d4ed8,color:#1e3a8a
    classDef pairs fill:#fde68a,stroke:#b45309,color:#78350f
    classDef line fill:#e9d5ff,stroke:#7e22ce,color:#581c87
    classDef chrome fill:#fecaca,stroke:#b91c1c,color:#7f1d1d
```

Form choices follow the data-viz method: a single headline is a tile, not a
chart; per-round counts are bars; a two-measure comparison per entity is a
paired bar where color carries the entity and position carries the measure;
change-over-time keeps the line.
