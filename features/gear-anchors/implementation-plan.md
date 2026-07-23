# Gear Anchors — Implementation Plan

Alias: `gear-anchors`

## Changes

- `packages/core/src/gear.ts` — `GearSlot` gains `'nose'`; Mustache moves to
  it. No other core change; the server is data-compatible.
- `packages/client/src/render/gearLayout.ts` (new) — one pure function
  `placeGear(slot, radius, aspect)` returning `{ width, height, centerYOffset }`,
  edge-anchored per band: hat bottom edge at circle top, eyes top edge just
  inside the circle top, nose bottom edge just inside the circle bottom,
  mouth top edge at circle bottom. Slot widths sized so no band reaches the
  face zone.
- `packages/client/src/render/scene.ts` — `drawGear` delegates its geometry
  to `placeGear`; the local `GEAR_ANCHORS` table is deleted.
- `packages/client/src/ui/statsCharts.ts`, shop — untouched; cards already
  show art standalone.

## Testing (TDD order)

1. Core gear test updated: slot union includes `nose`, Mustache is nose gear,
   every catalog slot value is one of the four bands.
2. New `gearLayout` unit tests over representative sprite aspects
   (0.4–0.67): hat entirely above the circle; mouth entirely below; eyes and
   nose entirely inside; and for every slot/aspect combination the central
   face zone (|y| < 0.3r) is never overlapped.
3. Existing render smoke stays screenshot-based.

## Ringer Review (pre-PR checklist)

- Utility placement: geometry lives in `gearLayout.ts`, a render concern in
  the render folder — not in core, which stays platform-free data. PASS.
- Inline styles: none involved; canvas math only. PASS.
- Duplication: the anchors table is replaced, not paralleled; `drawGear`
  keeps a single source of placement truth. PASS.
- Testable interfaces: `placeGear` is pure (slot, radius, aspect in;
  numbers out). PASS.
- Single purpose: `drawGear` draws, `placeGear` places. PASS.
- Comments: none. PASS.
- Tests: unit tests cover every band invariant; visual check via
  screenshots. PASS.
