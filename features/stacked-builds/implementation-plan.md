# Stacked Builds: Implementation Plan

## Core

| File | Change |
|---|---|
| `src/gear.ts` | Monocle `pickupRadius` mult 1.35 to 1.5. `rollOffers(rng, catalog, count)` drops the owned-ids parameter; the pool is the whole catalog, still distinct within one roll. |
| `src/waves.ts` | Call `rollOffers(rng, design.gear)`. |
| `test/pickupRange.test.ts` (new) | Integration through `step`: a player at the arena centre, one orb at a fixed distance, one fighting tick. Bare player misses at 130 px; one Monocle collects at 130 px; two collect at 200 px but miss 250 px; three collect at 300 px. Also `computeStats` with three Monocles is at least three times base. |
| `test/gear.test.ts` | Offer test becomes "rolls three distinct offers and may repeat owned gear"; new case: two Top Hats add 50 HP, two Laser Glasses compound damage. |
| `test/emptyShop.test.ts` | Becomes: a design with no gear skips to the countdown; a player who owns everything still shops. |

## Client

| File | Change |
|---|---|
| `src/ui/statLabels.ts` (new) | `STAT_LABELS` moved out of `shop.ts` so the shop and the build panel share one vocabulary. |
| `src/ui/build.ts` (new) | Pure `buildSummary(player, design)` returning `{ items: { name, count }[], stats: { label, value, ratio }[] }`. Ratio is value over base, inverted for `fireRateMs` so bigger is always better; attack speed is shown as shots per second. |
| `src/ui/hud.ts` | `HudElements` gains `buildItems` and `buildStats`; `updateHud` renders the summary only when its text changes. |
| `src/render/scene.ts` | Draw `new Set(player.gear)` so duplicates render once. |
| `index.html` | `<aside class="hud-build">` inside `#hud` with two lists. |
| `src/styles/main.css` | `.hud-build` anchored to the left, vertically centred, plus list rules. |
| `test/build.test.ts` (new) | Summary counts duplicates, orders items by first pick, formats ratios, hides ratio at base, inverts attack speed. |

## TDD order

1. Core: pickup range and stacking tests red, then gear and roll changes.
2. Client: `buildSummary` tests red, then the module.
3. Wire HUD and markup; gate; local redeploy; browser pass with three
   Monocles forced through the shop by picking them when offered.

## Ringer checklist

- Misplaced utility: stat labels move to their own module because two UI
  modules need them; the summary lives in `ui/` beside hud and shop.
- Inline styles: none new; `updateHud` keeps using CSS custom properties.
- Duplicated utilities: `describeModifier` stays in shop; the summary
  formats totals, a different job. `STAT_LABELS` is shared not copied.
- Duplicated styles: `.hud-build` reuses ink tokens; no second meter.
- Testable interfaces: `buildSummary` is pure over `PlayerState` and
  `GameDesign`; pickup is tested through the public `step`.
- Single purpose: `rollOffers` rolls, `computeStats` stacks,
  `buildSummary` summarises, `updateHud` paints.
- Comments: none.
- Tests: core integration and unit, client unit, browser pass.

## Browser verification

Local build, sign up, create a group, start a run alone, survive to the
shop, pick Monocle whenever offered. Screenshot the arena with the build
panel showing "Monocle x2" and "Pickup Range 202 (x2.25)". Check the
panel sits on the left, does not overlap the HUD bars, and stays readable
over the arena. Grep the built HTML for `hud-build`.

## Validation

To validate stacked-builds you can run `npm test`, then the browser pass
above and confirm orbs are pulled from visibly farther away with each
Monocle.
