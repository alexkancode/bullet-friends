# Stats Variety — Implementation Plan

Alias: `stats-variety`

## Changes

- `packages/client/src/ui/statsData.ts` — three pure additions beside the
  existing series builder: `buildStatTiles(players)` (waves survived, team
  kills, team damage), `cumulative(values)`, and `buildDamagePairs(players)`
  (name, colorIndex, dealt, taken totals).
- `packages/client/src/ui/statsCharts.ts` — the render becomes four
  builders: tile row, grouped bar chart (kills per wave, 4px rounded
  data-end bars anchored to the baseline, 2px gaps), paired horizontal
  damage bars (player color for dealt, neutral gray for taken, measure
  labels on the first row only, value labels at bar ends), and the
  cumulative XP line reusing the existing line/marker/grid pieces. Legend
  and totals table stay.
- `packages/client/src/styles/main.css` — `.stat-tiles`/`.stat-tile` rules
  reusing existing surface and ink tokens; tiles span the chart grid.

## Testing (TDD order)

1. `statsData` unit tests: tile values across multi-player histories,
   cumulative sums (empty, single, longer), damage pairs keep player order
   and color index and round totals.
2. Existing `buildMetricSeries` tests unchanged (bars and line reuse it).
3. Visual verification by driving a run to `runOver` and screenshotting.

## Ringer Review (pre-PR checklist)

- Utility placement: all data shaping stays in `statsData.ts`; chart
  geometry in `statsCharts.ts`. PASS.
- Inline styles: tiles styled via classes; SVG attributes are chart
  geometry, not styling shortcuts — text uses existing chart text classes.
  PASS.
- Duplication: bars/line share the axis+grid builder rather than copying
  it per chart; damage chart reuses `formatValue`. PASS.
- Testable: every number on screen comes from a tested pure function. PASS.
- Single purpose: one builder per chart form. PASS.
- Comments: none. PASS.
- Tests: unit for shaping, screenshot smoke for rendering. PASS.
