# Switch Group: Implementation Plan

## Changes

| File | Change |
|---|---|
| `packages/client/src/ui/onboarding.ts` | `selectGroup(groups, current, reason)` with `reason: 'load' \| 'switch'`. Switch returns undefined. Load keeps the current group (fresh copy by id, or the current object if the list does not have it yet), else auto-selects a lone group, else undefined. |
| `packages/client/src/main.ts` | `refreshGroups(reason = 'load')` assigns `activeGroup = selectGroup(myGroups, activeGroup, reason)`. The Switch group handler calls `refreshGroups('switch')` and no longer clears the group by hand. |
| `packages/client/test/onboarding.test.ts` | `selectGroup` cases: lone group auto-selected on load; two groups need a pick; current kept by id with the fresh object; current kept when missing from the list; switch yields undefined with one group and with a current group. |

## TDD order

1. Add the `selectGroup` tests; they fail on a missing export.
2. Implement `selectGroup`; tests pass.
3. Wire `main.ts`; gate; local redeploy; browser pass.

## Browser verification

Sign up a fresh user, decline the webcam, create one group, reach the
ready screen, click Switch group, assert the crew step is visible and lists
the group, click the group, assert the ready screen returns with the same
title. Screenshot the crew step.

## Ringer checklist

- Misplaced utility: the rule lives beside `nextStep` in the onboarding
  module, which already owns flow decisions.
- Inline styles, duplicated styles: none, no markup or CSS change.
- Duplicated utilities: the three `activeGroup` assignments in
  `refreshGroups` collapse into one call; the group-create handler keeps
  its own explicit pick since that is a different intent.
- Testable interfaces: pure function over plain `{ id }` objects.
- Single purpose: `selectGroup` answers one question.
- Comments: none.
- Tests: unit for the rule, browser pass for the wiring.

## Validation

To validate switch-group you can run `npm test`, then the browser pass
above against the local build.
