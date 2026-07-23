# Bullet Friends — Desktop / Steam Target

This folder is deliberately outside the npm workspaces so normal installs and
CI never pull Electron. It exists to prove the Steam path stays open.

## Run the desktop build

```bash
npm run build
cd desktop
npm install
npm start
```

The wrapper loads the exact same client bundle the website ships
(`packages/client/dist`), grants camera permission, and runs full screen game
UI. Multiplayer connects to the same server as the web build via
`VITE_SERVER_URL` at bundle time.

## Steam integration path

1. Add `steamworks.js` here and initialize it in `main.js` with the app id.
2. Implement `PlatformServices` (see `packages/client/src/platform/services.ts`)
   with a `steamPlatform` variant: persist the player name via Steam Cloud,
   surface achievements on wave milestones, use the Steam overlay for invites.
3. Package with `electron-builder` for Windows/macOS/Linux depots.

The game core never touches platform APIs, so no game logic changes are
needed for the Steam build.
