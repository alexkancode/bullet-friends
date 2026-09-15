import { describe, expect, it } from 'vitest'
import type { GearSlot } from '@bullet/core'
import { placeGear, stackGear, FACE_CLEAR_RATIO } from '../src/render/gearLayout.js'

const RADIUS = 40
const ASPECTS = [0.4, 0.5, 0.67]
const SLOTS: GearSlot[] = ['hat', 'eyes', 'nose', 'mouth']

function edges(slot: GearSlot, aspect: number) {
  const placement = placeGear(slot, RADIUS, aspect)
  return {
    top: placement.centerYOffset - placement.height / 2,
    bottom: placement.centerYOffset + placement.height / 2,
    ...placement
  }
}

describe('placeGear', () => {
  it('keeps hats fully above the circle, resting on the head', () => {
    for (const aspect of ASPECTS) {
      const hat = edges('hat', aspect)
      expect(hat.bottom).toBeLessThanOrEqual(-RADIUS + 1)
      expect(hat.bottom).toBeGreaterThan(-RADIUS - RADIUS * 0.15)
    }
  })

  it('keeps eye gear inside the top band of the circle', () => {
    for (const aspect of ASPECTS) {
      const eyes = edges('eyes', aspect)
      expect(eyes.top).toBeGreaterThanOrEqual(-RADIUS)
      expect(eyes.centerYOffset).toBeLessThan(0)
    }
  })

  it('keeps nose gear inside the bottom band of the circle', () => {
    for (const aspect of ASPECTS) {
      const nose = edges('nose', aspect)
      expect(nose.bottom).toBeLessThanOrEqual(RADIUS)
      expect(nose.centerYOffset).toBeGreaterThan(0)
    }
  })

  it('hangs mouth gear fully below the circle', () => {
    for (const aspect of ASPECTS) {
      const mouth = edges('mouth', aspect)
      expect(mouth.top).toBeGreaterThanOrEqual(RADIUS - 1)
    }
  })

  it('never covers the central face zone with any slot', () => {
    const clear = RADIUS * FACE_CLEAR_RATIO
    for (const slot of SLOTS) {
      for (const aspect of ASPECTS) {
        const placement = edges(slot, aspect)
        const coversCenter = placement.top < clear && placement.bottom > -clear
        expect(coversCenter, `${slot} at aspect ${aspect}`).toBe(false)
      }
    }
  })

  it('scales linearly with radius', () => {
    const small = placeGear('hat', 40, 0.5)
    const large = placeGear('hat', 80, 0.5)
    expect(large.width).toBeCloseTo(small.width * 2)
    expect(large.centerYOffset).toBeCloseTo(small.centerYOffset * 2)
  })
})

const SLOT_OF: Record<string, GearSlot> = { monocle: 'eyes', 'top-hat': 'hat', 'viking-helm': 'hat', mustache: 'nose' }
const slotOf = (id: string) => SLOT_OF[id]

describe('stackGear', () => {
  it('centres a lone item in each slot', () => {
    expect(stackGear(['monocle', 'top-hat'], slotOf, 'p1', RADIUS)).toEqual([
      { gearId: 'monocle', xOffset: 0 },
      { gearId: 'top-hat', xOffset: 0 }
    ])
  })

  it('spreads copies sharing a slot from left to right within bounds', () => {
    const offsets = stackGear(['monocle', 'monocle', 'monocle'], slotOf, 'p1', RADIUS).map(g => g.xOffset)
    expect(offsets[0]).toBeLessThan(offsets[1]!)
    expect(offsets[1]).toBeLessThan(offsets[2]!)
    expect(Math.abs(offsets[1]!)).toBeLessThan(RADIUS * 0.1)
    for (const offset of offsets) expect(Math.abs(offset)).toBeLessThanOrEqual(RADIUS * 0.35)
  })

  it('spreads different items that share a slot too', () => {
    const [hat, helm] = stackGear(['top-hat', 'viking-helm'], slotOf, 'p1', RADIUS)
    expect(hat!.xOffset).toBeLessThan(0)
    expect(helm!.xOffset).toBeGreaterThan(0)
  })

  it('is stable for a player and differs between players', () => {
    const gear = ['monocle', 'monocle', 'mustache', 'mustache']
    const a = stackGear(gear, slotOf, 'p1', RADIUS)
    expect(stackGear(gear, slotOf, 'p1', RADIUS)).toEqual(a)
    expect(stackGear(gear, slotOf, 'p2', RADIUS)).not.toEqual(a)
  })

  it('keeps slots independent and skips unknown items', () => {
    const stacked = stackGear(['monocle', 'ghost', 'top-hat'], slotOf, 'p1', RADIUS)
    expect(stacked.map(g => g.gearId)).toEqual(['monocle', 'top-hat'])
    expect(stacked.every(g => g.xOffset === 0)).toBe(true)
  })
})
