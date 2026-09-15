# Worn Stacks: Implementation Plan

## Changes

| File | Change |
|---|---|
| `packages/client/src/render/gearLayout.ts` | `stackGear(gearIds, slotOf, playerId, radius)` returns `{ gearId, xOffset }[]` in gear order. Per slot: copies spread evenly across plus or minus `SPREAD_RATIO` (0.25) of the radius, each plus a jitter of up to `JITTER_RATIO` (0.08) drawn from `createRng` seeded by a small string hash of the player id. A lone item in a slot gets offset 0. |
| `packages/client/src/render/scene.ts` | `drawPlayer` iterates `stackGear(...)` and passes `x + xOffset` to `drawGear`; the `new Set` dedupe goes away. |
| `packages/client/test/gearLayout.test.ts` | `stackGear` cases: one item per slot is centred; three in a slot are spread with the middle near 0 and the outer ones on opposite sides within bounds; same player id gives identical offsets; different ids differ; items in different slots do not affect each other; unknown ids are skipped. |

## TDD order

1. Tests red on the missing export.
2. Implement `stackGear` and the hash; green.
3. Wire `scene.ts`; gate; local redeploy; browser pass with three
   Monocles and a screenshot of the bubble.

## Ringer checklist

- Misplaced utility: horizontal spread lives beside vertical placement in
  `gearLayout.ts`; the scene only iterates.
- Inline styles, duplicated styles: none, canvas only.
- Duplicated utilities: reuses `createRng` from core rather than a second
  generator; the string hash is three lines and private to the layout.
- Testable interfaces: `stackGear` is pure over ids, a slot lookup, a seed
  and a radius.
- Single purpose: `stackGear` decides offsets; `drawGear` paints.
- Comments: none.
- Tests: unit for the spread and determinism, browser for the look.

## Validation

To validate worn-stacks you can run `npm test`, then the browser pass with
the one-item Monocle design and confirm three monocles fan across the eye
band without covering the face.
