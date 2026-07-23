# Group Accounts

Google sign-in, persistent friend groups with run history, and invite links —
layered onto Bullet Friends without breaking anonymous quick-play.

## Mutual Understanding

Agreed in conversation on 2026-07-22.

- Players may sign in with their Google account; anonymous play keeps working.
- A signed-in player can create a group — a named crew of friends.
- Groups accumulate history: every finished run linked to the group is stored
  (date, waves survived, per-player kills/damage/xp/level).
- Groups issue invite links; a friend who opens one and signs in joins the
  group.
- Google resources (OAuth client, Firestore) live in the user's GCP org via
  the alexkancode account.
- Hard budget posture: the project attaches no billing account, so spend is
  structurally $0; the $100 figure is a ceiling we stay far under, with
  alerts only if billing is ever attached.

## Architecture

```mermaid
flowchart LR
    subgraph Browser
        GIS[Google Identity\nServices button]:::google
        UI[Lobby group panel\n+ history screen]:::client
    end

    subgraph Server["Server (Railway)"]
        API[REST api\n/groups /invites /history]:::server
        VER[TokenVerifier\nJWKS signature check]:::server
        REC[Run recorder\nrunOver -> history]:::server
        STORE[(GroupStore\ninterface)]:::iface
    end

    subgraph Google["Google Cloud (no billing attached)"]
        JWKS[Google JWKS certs]:::google
        FS[(Firestore\nfree tier)]:::google
    end

    GIS -->|ID token| UI
    UI -->|Bearer token| API
    API --> VER --> JWKS
    API --> STORE
    REC --> STORE
    STORE -->|MemoryGroupStore| DEV[dev + tests]:::iface
    STORE -->|FirestoreGroupStore| FS

    classDef google fill:#fde68a,stroke:#b45309,color:#78350f
    classDef client fill:#bfdbfe,stroke:#1d4ed8,color:#1e3a8a
    classDef server fill:#fecaca,stroke:#b91c1c,color:#7f1d1d
    classDef iface fill:#bbf7d0,stroke:#15803d,color:#14532d
```

The seam is `GroupStore` + `TokenVerifier`: tests and local dev run entirely
in memory with a fake verifier; production swaps in Firestore and real Google
JWKS via environment variables. Game rooms never require sign-in — a room is
optionally linked to a group at join time, and only then does the finished
run land in history.

## Invite Flow

```mermaid
sequenceDiagram
    participant A as Alex (member)
    participant S as Server
    participant B as Friend

    A->>S: POST /api/groups/g1/invites (Bearer token)
    S-->>A: { code: "ZK4Q7" }
    A->>B: link https://game/?invite=ZK4Q7
    B->>B: opens link, signs in with Google
    B->>S: POST /api/invites/ZK4Q7/accept (Bearer token)
    S-->>B: { group: "Spud Squad" }
    Note over B,S: B now sees the group's run history\nand future runs count for them too
```

## Run Recording

```mermaid
stateDiagram-v2
    [*] --> Anonymous: quick play, no token
    [*] --> Grouped: join(room, groupId, token)
    Grouped --> Recorded: run ends (runOver)
    Recorded --> History: store.appendRun(groupId, summary)
    Anonymous --> Discarded: run ends, nothing stored

    classDef stored fill:#bbf7d0,stroke:#15803d,color:#14532d
    classDef ephemeral fill:#bfdbfe,stroke:#1d4ed8,color:#1e3a8a
    class Grouped,Recorded,History stored
    class Anonymous,Discarded ephemeral
```

## Cost Posture

| Resource | Plan | Cost |
|---|---|---|
| Google sign-in (Identity Services) | free | $0 |
| Firestore | free tier (1 GiB, 50k reads/day) | $0 |
| OAuth client + consent screen | free | $0 |
| Billing account attached | none | spend impossible |
