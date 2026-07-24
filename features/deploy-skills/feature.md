# Deploy Skills

Two code-first micro skills: `deploy-bullet-friends` runs the whole deploy
pipeline, and `deploy-bullet-friends-verification` answers one question
deterministically: is the latest commit actually live in prod?

## Mutual Understanding

Agreed in conversation on 2026-07-24.

- Both skills live under `.claude/skills/` and are code-first: each
  `SKILL.md` instructs running its bundled script, which does all the work
  and exits non-zero on any failure.
- `deploy-bullet-friends/deploy.mjs`: verify clean tree on main, run the
  full local gate (lint, typecheck, tests, build), push, wait for the CI
  run to conclude, stamp `COMMIT_SHA` on Railway and `railway up`, wait for
  health, then chain into the verification script.
- To make verification deterministic, both deploy targets get stamped with
  the commit SHA at build/deploy time: the Pages build embeds it in a
  `<meta name="commit">` tag, and the server's `/health` reports a `commit`
  field from a `COMMIT_SHA` env var.
- The script compares: local HEAD, origin/main, the CI conclusion for that
  SHA, the live client's embedded SHA, and the live server's reported SHA,
  then prints a per-check verdict.

## Verification Flow

```mermaid
flowchart LR
    HEAD[git HEAD]:::src
    REMOTE[origin/main\nls-remote]:::src
    CI[gh run for SHA\nconclusion]:::ci
    PAGE[live index.html\nmeta commit]:::live
    HEALTH[live /health\ncommit field]:::live
    VERDICT{all match\nHEAD?}:::verdict

    HEAD --> VERDICT
    REMOTE --> VERDICT
    CI --> VERDICT
    PAGE --> VERDICT
    HEALTH --> VERDICT
    VERDICT -->|yes| PASS[exit 0\nfully deployed]:::pass
    VERDICT -->|no| FAIL[exit 1\nnames the stale target]:::fail

    classDef src fill:#bfdbfe,stroke:#1d4ed8,color:#1e3a8a
    classDef ci fill:#fde68a,stroke:#b45309,color:#78350f
    classDef live fill:#e9d5ff,stroke:#7e22ce,color:#581c87
    classDef verdict fill:#fecaca,stroke:#b91c1c,color:#7f1d1d
    classDef pass fill:#bbf7d0,stroke:#15803d,color:#14532d
    classDef fail fill:#fecaca,stroke:#b91c1c,color:#7f1d1d
```

## Deploy Pipeline

```mermaid
flowchart LR
    GATE[clean tree on main
lint + types + tests + build]:::gate
    PUSH[git push]:::step
    CI[wait for CI
conclusion]:::step
    STAMP[railway COMMIT_SHA = HEAD
railway up]:::step
    HEALTH[wait for /health]:::step
    VERIFY[verify.mjs
final verdict]:::verify

    GATE --> PUSH --> CI --> STAMP --> HEALTH --> VERIFY

    classDef gate fill:#fecaca,stroke:#b91c1c,color:#7f1d1d
    classDef step fill:#bfdbfe,stroke:#1d4ed8,color:#1e3a8a
    classDef verify fill:#bbf7d0,stroke:#15803d,color:#14532d
```
