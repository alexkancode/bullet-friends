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

## Testing

Vitest across every package: core unit tests, protocol canary fixtures that
lock the wire format, real-WebSocket server integration tests, and client
interpolation/stats tests. `npm test` runs them all.
