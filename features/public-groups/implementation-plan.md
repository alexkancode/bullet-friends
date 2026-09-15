# Public Groups: Implementation Plan

## Data and store

| File | Change |
|---|---|
| `packages/server/src/groups/store.ts` | `Group.isPublic?: boolean`. `GroupStore` gains `setGroupVisibility(groupId, isPublic)`, `listPublicGroups()`, `joinGroup(groupId, user)`. |
| `packages/server/src/groups/memoryStore.ts` | Implement the three. Extract the "add member if missing" step shared by `acceptInvite` and `joinGroup` into one private method. `listPublicGroups` sorts by `createdAt` desc and caps at 50. |
| `packages/server/src/groups/firestoreStore.ts` | Same three. `listPublicGroups` is an equality-only `runQuery` on `isPublic` (no composite index needed) sorted and capped in code. The shared member PATCH moves into one private method used by `acceptInvite` and `joinGroup`. |

## API (`packages/server/src/api.ts`)

All bearer-only, inside `route`. POST is used for the visibility change so
the existing CORS method list stays as it is.

| Route | Result |
|---|---|
| `POST /api/groups/:id/visibility` `{ public: boolean }` | 200 group; 400 non-boolean; 404 unknown group; 403 not the owner |
| `GET /api/groups/public` | 200 `{ groups }`, public groups the caller is not in |
| `POST /api/groups/:id/join` | 200 group; 404 unknown; 403 private |

`GET /api/groups/public` is matched before the id-based regexes.

## Client

| File | Change |
|---|---|
| `src/net/api.ts` | `ApiGroup` gains `ownerId` and `isPublic?`. `GroupApi` gains `setVisibility`, `publicGroups`, `joinGroup`. |
| `src/ui/groups.ts` | Pure `visibilityControl(group, userId)` returning `undefined` for non-owners, else `{ label: 'Make public' \| 'Make private', next: boolean }`. |
| `index.html` | Ready step: `#visibility-button` (`button button-wide`, hidden unless owner) after the actions row. Group step: a `room-line` label "Public crews" and `<ul id="public-groups" class="group-list">` reusing `.group-pick`. |
| `src/main.ts` | Render the visibility button from `visibilityControl` in `renderFlow`; click flips via the API and refreshes. `renderGroupList` also fetches and renders public crews; picking one calls `joinGroup`, refreshes, selects it. |
| `src/styles/main.css` | No new rules expected; `.group-list`, `.group-pick`, `.room-line`, `.button-wide` already cover it. |

## Smoke (`scripts/smoke.sh`)

Happy: A makes the group public (200, `isPublic` true); B lists public
groups and sees it; B joins (200); B's `/api/me` lists it. Unhappy: B sets
visibility on A's group (403); A sends a non-boolean (400); B joins a
private group A creates second (403); join unknown id (404).

## Tests (TDD order)

1. `groupStore.test.ts`: private by default; visibility flips; public list
   newest first and excludes private; join public adds the member once;
   join private returns undefined.
2. `publicGroups.test.ts` (server integration): every row of the API
   table plus the list excluding the caller's own groups.
3. `packages/client/test/groups.test.ts`: `visibilityControl` for owner
   private, owner public, member, stranger.
4. Smoke checks above; `smoke.test.ts` runs them.

## Ringer checklist

- Misplaced utility: membership mutation lives in the stores; access
  decisions live in `api.ts` next to the invite rules; the owner check
  for the button is a pure client function beside `nextStep`.
- Inline styles: none. Duplicated styles: none, existing classes reused.
- Duplicated utilities: the member-add step is extracted in both stores
  rather than copied into `joinGroup`.
- Testable interfaces: store methods are exercised through the memory
  store and over HTTP; the client rule is pure.
- Single purpose: each route handles one verb on one resource.
- Comments: none.
- Tests: store unit, API integration, client unit, smoke.

## Validation

To validate public-groups you can run `npm test`, `npm run smoke` against
the local server, and in the browser: owner clicks Make public, a second
account opens the crew picker, sees the crew under Public crews, joins,
and reaches the ready screen.
