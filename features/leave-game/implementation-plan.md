# Leave Game: Implementation Plan

## Changes by package

| Package | File | Change |
|---|---|---|
| core | `src/step.ts` | `abandonRun(state): boolean`, next to `pauseGame`/`resumeGame`. True only in fighting, shopping or countdown: clears the pause via `resumeGame`, banks wave stats via the existing `endRun`, sets `runOver`. |
| protocol | `src/messages.ts` | `LeaveMessage { t: 'leave' }` in `ClientMessage` and `CLIENT_MESSAGE_TAGS`. |
| protocol | `test/fixtures/messages.json` | `leave` fixture (the existing tag-coverage canary demands it). |
| server | `src/rooms.ts` | `leaveRun(room, playerId): LeaveOutcome` returning `'runOver'` when the room holds exactly that one player and `abandonRun` succeeded, else `'left'`. |
| server | `src/server.ts` | On `leave`: if the outcome is `'left'`, `ws.close()`; the existing close handler removes the player and broadcasts the roster. On `'runOver'` nothing else: the tick loop broadcasts the new phase and records the run. |
| client | `index.html` | Pause panel buttons wrapped in `.pause-actions`; new `#leave-button` "Leave game". |
| client | `src/styles/main.css` | `.pause-actions` flex row; its buttons share the row with no top margin. |
| client | `src/ui/leave.ts` | `statsExit(leaveRequested)` returning `{ label, action }`: `Back to lobby`/`playAgain` normally, `Back to group`/`disconnect` after a leave. |
| client | `src/main.ts` | `leaveRequested` flag: set on Leave click before sending `leave`, cleared on welcome and on close. Stats button label from `statsExit`; its click either sends `playAgain` or closes the socket. |
| scripts | `ws-probe.mjs` | Two new checks: solo join, start, leave yields a `runOver` snapshot with the socket open; with two players, one leave closes that socket and the other sees a one-player roster. `smoke.sh` pass count updated. |

## Tests (TDD order, each fails before its change)

1. `packages/protocol/test/codec.test.ts` tag-coverage canary fails the
   moment `leave` is added without a fixture; adding the fixture makes it
   green. This locks the wire shape.
2. `packages/core/test/leave.test.ts`: abandon mid-fight moves to
   `runOver`, pushes the current wave stats into history and clears
   `pausedBy`; works from countdown and shopping; returns false and leaves
   state untouched from lobby and runOver.
3. `packages/server/test/leaveFlow.test.ts`:
   - two players fighting, one sends `leave`: its socket closes, the other
     receives a roster with one player and the phase is still fighting;
   - solo player fighting sends `leave`: receives a snapshot with phase
     `runOver` still listing them, socket stays open;
   - solo player in the lobby sends `leave`: socket closes;
   - `RoomManager` with a `MemoryGroupStore` and linked group: solo leave
     during a run appends exactly one history record naming the player.
4. `packages/client/test/leave.test.ts`: `statsExit(false)` and
   `statsExit(true)` shapes.
5. `packages/server/test/smoke.test.ts` already runs the probe, so the two
   new probe checks are exercised by `npm test`.

## Ringer checklist

- Misplaced utility: the run-ending rule lives in core beside its siblings;
  the last-player decision lives in the room manager, which owns player
  counts; the label/action mapping is a pure client module.
- Inline styles: none; one new rule block in `main.css`.
- Duplicated utilities: `abandonRun` reuses `endRun` and `resumeGame`;
  the server reuses the socket close handler for removal instead of a
  second removal path.
- Duplicated style rules: `.group-actions` was considered and rejected
  because its child rules assume an input; `.pause-actions` is its own
  two-line rule.
- Testable interfaces: every new function is pure or exercised over a
  real socket; `LeaveOutcome` is a named union.
- Single purpose: `abandonRun` ends a run, `leaveRun` decides, the server
  message branch dispatches, `statsExit` maps one flag to one shape.
- Comments: none.
- Tests: core unit, protocol canary, server integration plus unit, client
  unit, smoke probe.

## Browser verification

After the local redeploy: open the client, sign in as a smoke user, join,
start, press Esc, screenshot the pause panel (two buttons in one row,
equal widths, Resume accented, Leave plain), click Leave as the solo
player and screenshot the stats screen showing "Back to group", click it
and confirm the group screen. Probe the DOM with curl on the built
`index.html` for the `pause-actions` wrapper.

## Validation

To validate leave-game you can run `npm test`, then `npm run smoke`
against a local server, then the browser pass above.
