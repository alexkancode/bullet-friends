import { describe, expect, it } from 'vitest'
import { createRng } from '@bullet/core'

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    const seqA = [a(), a(), a()]
    const seqB = [b(), b(), b()]
    expect(seqA).toEqual(seqB)
  })

  it('differs across seeds and stays in [0, 1)', () => {
    const a = createRng(1)
    const b = createRng(2)
    expect(a()).not.toBe(b())
    const r = createRng(7)
    for (let i = 0; i < 1000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
