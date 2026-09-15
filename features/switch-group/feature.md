# Switch Group

The Switch group button on the ready screen always takes you to the crew
picker, even when you belong to exactly one group.

## Mutual Understanding

Agreed in conversation on 2026-09-14.

- Symptom: in production and locally, clicking Switch group with a single
  group did nothing. The handler cleared the active group and refreshed
  the list, but the refresh's "auto-select the only group" rule re-picked
  it immediately, so the screen never changed.
- Fix: the group selection rule becomes a pure function that knows why it
  is being asked. On first load a lone group is still auto-selected. On an
  explicit switch nothing is selected, so the crew picker shows and the
  player can pick, create a new group, or follow an invite link.
- No server change. No new markup. The button, its label and its styles
  stay as they are.

## Selection Rule

```mermaid
flowchart TD
    Q{why are we selecting?}:::decide
    Q -->|switch| NONE[no active group<br/>show crew picker]:::pick
    Q -->|load| K{current group<br/>still known?}:::decide
    K -->|yes| KEEP[keep it<br/>fresh copy from the list]:::keep
    K -->|no| ONE{exactly one<br/>group?}:::decide
    ONE -->|yes| AUTO[auto-select it<br/>ready screen]:::keep
    ONE -->|no| NONE

    classDef decide fill:#e9d5ff,stroke:#7e22ce,color:#581c87
    classDef keep fill:#bbf7d0,stroke:#15803d,color:#14532d
    classDef pick fill:#fde68a,stroke:#b45309,color:#78350f
```

## Before and After

```mermaid
sequenceDiagram
    participant U as Player (one group)
    participant C as Client
    rect rgb(254, 202, 202)
    Note over U,C: before
    U->>C: click Switch group
    C->>C: activeGroup = undefined
    C->>C: refreshGroups: one group and none active, auto-select
    C-->>U: ready screen again (nothing happened)
    end
    rect rgb(187, 247, 208)
    Note over U,C: after
    U->>C: click Switch group
    C->>C: refreshGroups(reason: switch)
    C->>C: selectGroup(..., 'switch') = undefined
    C-->>U: Pick your crew
    end
```
