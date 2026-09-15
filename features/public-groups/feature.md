# Public Groups

Group owners can make a crew public. Public crews appear in a list on the
"Pick your crew" step where any signed-in player can join with one click.

## Mutual Understanding

Agreed in conversation on 2026-09-14.

- A group is private by default. Only the owner sees a visibility button on
  the ready screen; it reads "Make public" or "Make private" depending on
  the current state and flips it.
- The crew picker lists public crews you are not already in, newest first,
  with name and member count. Picking one joins you immediately, no invite
  code, and lands you on its ready screen. Private crews stay invite-only.
- Three new API routes: set visibility (owner only), list public groups,
  join a public group. Both stores implement them. Existing groups carry
  no flag and read as private.
- Joining a public group grants the same membership an invite would:
  the shared room, run history, and the ability to create invites.

## Discovery and Join

```mermaid
sequenceDiagram
    participant O as Owner
    participant S as Server
    participant P as Player

    O->>S: POST /api/groups/:id/visibility { public: true }
    S->>S: owner check, isPublic = true
    S-->>O: group (Make private shown)

    P->>S: GET /api/groups/public
    S->>S: public groups minus mine, newest first, max 50
    S-->>P: [{ id, name, memberIds, isPublic }]
    P->>S: POST /api/groups/:id/join
    S->>S: still public? add member
    S-->>P: group (ready screen)
```

## Access Rules

```mermaid
flowchart LR
    V[set visibility]:::act --> VO{caller is owner?}:::decide
    VO -->|yes| V200[200 group]:::ok
    VO -->|no, member or stranger| V403[403]:::deny
    J[join]:::act --> JP{group public?}:::decide
    JP -->|yes| J200[200 group, now a member]:::ok
    JP -->|no| J403[403 invite only]:::deny
    JP -->|unknown id| J404[404]:::deny
    L[list public]:::act --> L200[200 public groups<br/>excluding mine]:::ok

    classDef act fill:#fde68a,stroke:#b45309,color:#78350f
    classDef decide fill:#e9d5ff,stroke:#7e22ce,color:#581c87
    classDef ok fill:#bbf7d0,stroke:#15803d,color:#14532d
    classDef deny fill:#fecaca,stroke:#b91c1c,color:#7f1d1d
```
