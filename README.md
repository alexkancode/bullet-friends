# Bullet Friends

A co-op browser bullet-heaven where every player is a webcam bubble. Move with
WASD, weapons fire themselves, waves get meaner, and between waves you strap
increasingly ridiculous gear onto your face circle. When the run ends you get
round-over-round charts of how everyone grew.

Docs and diagrams: `features/bullet-friends/`.

## Local development

```bash
npm install
npm test
npm run build
npm run dev:server
npm run dev:client
```

Open http://localhost:5173, allow the webcam, share the room code with a
friend on your network.

## Architecture

- `packages/core` — deterministic game simulation, no platform APIs
- `packages/protocol` — message contracts + codecs shared by both sides
- `packages/server` — WebSocket rooms, authoritative 20Hz simulation, webcam
  frame relay
- `packages/client` — Vite canvas client with snapshot interpolation
- `desktop/` — Electron wrapper proving the future Steam path (outside the
  workspaces on purpose)

## Production

CI (`.github/workflows/ci.yml`) lints, typechecks, tests, and builds on every
push; on `main` it deploys the client to GitHub Pages and the server to
Railway.

One-time setup:

1. Repo Settings → Pages → Source: GitHub Actions.
2. Create a Railway project with a service named `bullet-friends` pointing at
   this repo (it uses the `Dockerfile`).
3. Repo Settings → Secrets → Actions → add `RAILWAY_TOKEN` (Railway project
   token). Until it exists the server deploy job skips with a notice.
4. Repo Settings → Variables → Actions → add `SERVER_URL` set to the
   Railway websocket URL, e.g. `wss://bullet-friends-production.up.railway.app`.

## Group accounts (Google sign-in)

Optional — the game plays anonymously without any of this. With it, players
sign in with Google, create groups, share invite links, and finished runs are
stored per group (docs: `features/group-accounts/`).

Configuration is entirely environment-driven:

| Where | Variable | Value |
|---|---|---|
| GitHub Actions variable | `GOOGLE_CLIENT_ID` | OAuth Web client ID |
| Railway env | `GOOGLE_CLIENT_ID` | same client ID (token audience) |
| Railway env | `FIRESTORE_PROJECT_ID` | GCP project id |
| Railway env | `GOOGLE_SERVICE_ACCOUNT_JSON` | service-account key JSON |

Google Cloud setup (project attaches no billing, so spend is structurally $0):

1. `gcloud projects create <id> --organization=<org-id>`
2. `gcloud services enable firestore.googleapis.com --project <id>`
3. `gcloud firestore databases create --location=nam5 --project <id>`
4. Service account with `roles/datastore.user`; download its JSON key.
5. Console → APIs & Services → OAuth consent screen (External), then create
   an OAuth Web client with origins `https://alexkancode.github.io`,
   `http://localhost:5173`, and `http://localhost:4173`.

Unset variables degrade gracefully: no client ID hides the sign-in UI and the
API answers 503; no Firestore variables fall back to an in-memory store.

## Testing

Vitest across every package: core unit tests, protocol canary fixtures that
lock the wire format, real-WebSocket server integration tests, and client
interpolation/stats tests. `npm test` runs them all.
