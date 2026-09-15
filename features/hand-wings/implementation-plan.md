# Hand Wings: Implementation Plan

## Core

| File | Change |
|---|---|
| `src/gear.ts` | `GearSlot` gains `'hand'`; `export const GEAR_SLOTS` lists all five. Three catalog entries: `wooden-sword` (damage x1.2), `slingshot` (fireRateMs x0.88), `torch` (maxHp +15, moveSpeed x1.05), art under `art/gear/`. |
| `src/designValidate.ts` | Use `GEAR_SLOTS` instead of its own list. |
| `test/gear.test.ts` | Anchor test accepts `GEAR_SLOTS`; new case: the three hand items exist on the hand slot. |

## Client

| File | Change |
|---|---|
| `public/art/gear/wooden-sword.svg`, `slingshot.svg`, `torch.svg` | Original tall SVGs (viewBox 60 by 120) in the existing flat style, pointing up and slightly outward to the right. |
| `src/ui/designer.ts` | Import `GEAR_SLOTS`; drop the local copy. |
| `src/render/gearLayout.ts` | `placeGear('hand')`: narrow width ratio, height capped to the circle, `centerYOffset` 0. `stackGear` returns `{ gearId, xOffset, yOffset, mirrored }`. Hand items: side alternates by index (right first), `k` is the index within the side; `xOffset = side * radius * (HAND_CENTER_RATIO + k * HAND_STEP_RATIO)`; `yOffset` spreads the side's items evenly across plus or minus `HAND_SPREAD_RATIO` plus a seeded nudge of `HAND_JITTER_RATIO`; `mirrored` is true on the left. Other slots keep `yOffset` 0 and `mirrored` false. |
| `src/render/scene.ts` | `drawGear` takes the worn placement; mirrored items draw under a horizontal flip. |
| `test/gearLayout.test.ts` | `placeGear('hand')` centred and inside the circle's height; one hand item sits right of the circle with no vertical offset; two sit on opposite sides, the left mirrored; four give two per side at different heights with the later one further out; stability and per-player difference hold for hand items. |

## Constants

| Name | Value | Meaning |
|---|---|---|
| `SLOT_WIDTH_RATIO.hand` | 0.45 | sprite width is 0.9 radius |
| `HAND_CENTER_RATIO` | 1.5 | first item centre at 1.5 radius from the bubble centre |
| `HAND_STEP_RATIO` | 0.2 | each further item on a side steps 0.2 radius outward |
| `HAND_SPREAD_RATIO` | 0.55 | items on a side spread across plus or minus 0.55 radius |
| `HAND_JITTER_RATIO` | 0.1 | seeded vertical nudge |

## TDD order

1. Core tests red (missing slot and items), then catalog and validator.
2. Layout tests red, then `placeGear` and `stackGear`.
3. Scene, designer, art; gate; local redeploy; browser pass with a design
   holding only Wooden Sword for six waves, cropped screenshot of the wings.

## Ringer checklist

- Misplaced utility: the slot list becomes a core export used by both
  consumers instead of two literals; layout maths stays in `gearLayout`.
- Inline styles, duplicated styles: none, canvas only.
- Duplicated utilities: hand placement reuses the existing seeded rng and
  the same `WornGear` shape; no second stacking function.
- Testable interfaces: `stackGear` and `placeGear` are pure.
- Single purpose: `placeGear` sizes, `stackGear` positions, `drawGear`
  paints.
- Comments: none.
- Tests: core unit, layout unit, browser for the look.

## Validation

To validate hand-wings you can run `npm test`, then the browser pass and
confirm six swords fan out into two wings without touching the face.
