# Leave Game

The pause menu gains a Leave button. Leaving with friends still in the room
returns you to your group screen while they play on. Leaving as the last
player ends the run: you see the run-over stats and the run is recorded.

## Mutual Understanding

Agreed in conversation on 2026-09-14.

- The pause overlay shows two buttons: Resume and Leave game.
- Leaving while other players remain: the leaver's connection closes and
  they land on their group screen (the "ready" step). The others stay in
  the run. If the leaver was the one who paused, the room stays paused
  under their name until someone resumes, exactly as pause works today.
- Leaving as the only player during a run (fighting, shopping, countdown,
  paused or not): the run ends as game over. The leaver stays connected
  long enough to see the run-over stats screen, and the run is appended
  to the group's history like any finished run. The stats screen's button
  then reads "Back to group" and disconnects them.
- Leaving as the only player in the lobby or on the stats screen: nothing
  to end, the connection simply closes.
- The decision of whether a leave ends the run is server-authoritative so
  two players leaving at once cannot both think they were last.
- The protocol version is not bumped: the only change is a new client
  message, which old clients never send.

## Leave Decision

```mermaid
flowchart TD
    L[Player clicks Leave game]:::act --> M[client sends leave]:::msg
    M --> S{server: last player<br/>and run in progress?}:::decide
    S -->|yes| A[abandonRun: pause cleared,<br/>wave stats banked, phase runOver]:::over
    A --> R[next tick records run<br/>to group history]:::over
    R --> ST[client shows run-over stats<br/>button: Back to group]:::over
    ST --> D[client closes socket]:::close
    S -->|no| C[server closes the socket]:::close
    C --> RM[socket close handler removes player,<br/>roster broadcast to the rest]:::close
    D --> G[onClose: back to group screen]:::calm
    RM --> G

    classDef act fill:#fde68a,stroke:#b45309,color:#78350f
    classDef msg fill:#bfdbfe,stroke:#1d4ed8,color:#1e3a8a
    classDef decide fill:#e9d5ff,stroke:#7e22ce,color:#581c87
    classDef over fill:#fecaca,stroke:#b91c1c,color:#7f1d1d
    classDef close fill:#e5e7eb,stroke:#6b7280,color:#111827
    classDef calm fill:#bbf7d0,stroke:#15803d,color:#14532d
```

## Phase Transitions

```mermaid
stateDiagram-v2
    Fighting --> RunOver: last player leaves
    Countdown --> RunOver: last player leaves
    Shopping --> RunOver: last player leaves
    Paused --> RunOver: last player leaves (pause cleared)
    Fighting --> Fighting: non-last player leaves (roster shrinks)
    Paused --> Paused: non-last player leaves (still paused)
    Lobby --> Lobby: leave just disconnects
    RunOver --> RunOver: leave just disconnects

    classDef hot fill:#fecaca,stroke:#b91c1c,color:#7f1d1d
    classDef calm fill:#bfdbfe,stroke:#1d4ed8,color:#1e3a8a
    classDef done fill:#e9d5ff,stroke:#7e22ce,color:#581c87
    class Fighting,Countdown,Shopping hot
    class Paused,Lobby calm
    class RunOver done
```
