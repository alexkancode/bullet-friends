# Bullet Friends

A browser-based co-op bullet-heaven arena game in the style of a simplified Brotato,
where each player's character body is a live circular rendering of their own webcam.

## Mutual Understanding

Agreed in conversation on 2026-07-22.

- Players open a website, allow webcam access, and join a shared room with friends.
- Each player is a circle whose fill is their live webcam feed. Friends see each
  other's webcam bubbles in real time.
- Together they fight waves of enemies. Weapons auto-fire at the nearest enemy;
  players focus on movement and positioning, Brotato-style.
- Killing enemies drops XP. Leveling up between waves offers a choice of gear.
- Gear is strapped comically onto the webcam bubble (hats, glasses, weapons) and
  modifies stats (damage, fire rate, move speed, max HP, pickup radius).
- A stats screen shows each player's growth round over round.
- Art is free/open licensed (CC0 preferred) and looks good.
- Multiplayer sync is high-performance: server-authoritative simulation with
  client interpolation, not naive broadcast of everything.
- The site deploys to production automatically via GitHub Actions CI/CD:
  client to GitHub Pages, sync server to Railway.
- The codebase is deliberately structured so the same game core can later ship
  as a cross-platform Steam build via a desktop wrapper, without rewriting.

## System Architecture

```mermaid
flowchart LR
    subgraph Browser["Player's Browser"]
        CAM[Webcam capture]:::input
        INPUT[Keyboard input]:::input
        CLIENT[client\nrenderer + interpolation]:::client
    end

    subgraph SharedCode["Shared Packages"]
        CORE[core\ndeterministic game simulation]:::shared
        PROTO[protocol\nmessage types + codecs]:::shared
    end

    subgraph Railway["Railway (prod)"]
        SERVER[server\nrooms + authoritative sim\n+ webcam frame relay]:::server
    end

    subgraph Future["Future Steam Build"]
        DESKTOP[desktop wrapper\nElectron + Steamworks]:::future
    end

    CAM --> CLIENT
    INPUT --> CLIENT
    CLIENT <-->|WebSocket| SERVER
    CORE --> CLIENT
    CORE --> SERVER
    PROTO --> CLIENT
    PROTO --> SERVER
    CLIENT -.same bundle.-> DESKTOP

    classDef input fill:#fde68a,stroke:#b45309,color:#78350f
    classDef client fill:#bfdbfe,stroke:#1d4ed8,color:#1e3a8a
    classDef shared fill:#bbf7d0,stroke:#15803d,color:#14532d
    classDef server fill:#fecaca,stroke:#b91c1c,color:#7f1d1d
    classDef future fill:#e9d5ff,stroke:#7e22ce,color:#581c87,stroke-dasharray: 5 5
```

The game simulation lives entirely in `core` and runs on the server. Client and
server import identical rules, so the client can render meaningfully between
snapshots and a future Steam build can run the sim locally for solo play.

## Netcode

```mermaid
sequenceDiagram
    participant A as Player A client
    participant S as Server (20Hz sim)
    participant B as Player B client

    A->>S: join(room, name)
    S-->>A: welcome(playerId, roomState)
    S-->>B: playerJoined(A)

    loop Every input tick
        A->>S: input(move vector, seq)
        B->>S: input(move vector, seq)
    end

    loop Every sim tick (50ms)
        S->>S: core.step(state, inputs)
        S-->>A: snapshot(entities, wave, hp, xp)
        S-->>B: snapshot(entities, wave, hp, xp)
    end

    loop Every ~150ms
        A->>S: camFrame(jpeg bytes)
        S-->>B: camFrame(A, jpeg bytes)
    end

    Note over A,B: Clients render ~100ms in the past,\ninterpolating between the two nearest snapshots
```

Webcam bubbles are shared as small JPEG frames relayed through the server rather
than WebRTC. This trades some frame rate for zero TURN/STUN infrastructure and
one connection to reason about, which is the right trade for a co-op game where
the bubble is an avatar, not a video call.

## Round Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Lobby
    Lobby --> Fighting: host starts run
    Fighting --> Fighting: enemies spawn / die,\nXP collected
    Fighting --> Shopping: wave timer ends
    Shopping --> Fighting: all players ready,\ngear picked
    Fighting --> RunOver: all players downed
    RunOver --> StatsScreen: round-over-round charts
    StatsScreen --> Lobby: play again

    classDef calm fill:#bfdbfe,stroke:#1d4ed8,color:#1e3a8a
    classDef hot fill:#fecaca,stroke:#b91c1c,color:#7f1d1d
    classDef reward fill:#bbf7d0,stroke:#15803d,color:#14532d
    class Lobby,StatsScreen calm
    class Fighting,RunOver hot
    class Shopping reward
```

## Steam-Readiness Constraints

- `core` and `protocol` never touch DOM, Node, or network APIs directly.
- The client accesses camera, storage, and fullscreen through a
  `PlatformServices` interface with a browser implementation now and room for a
  Steam/Electron implementation later.
- The server is optional for solo play in the future desktop build because the
  sim is a pure function of state + inputs.
