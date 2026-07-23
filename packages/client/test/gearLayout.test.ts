import { describe, expect, it } from 'vitest'
import type { GearSlot } from '@bullet/core'
import { placeGear, FACE_CLEAR_RATIO } from '../src/render/gearLayout.js'

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
