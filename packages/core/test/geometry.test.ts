import { describe, expect, it } from 'vitest'
import { add, circlesOverlap, clampToArena, dist, normalize, scale, ARENA, PLAYER_RADIUS } from '@bullet/core'

describe('geometry', () => {
  it('adds and scales vectors', () => {
    expect(add({ x: 1, y: 2 }, { x: 3, y: -1 })).toEqual({ x: 4, y: 1 })
    expect(scale({ x: 2, y: -3 }, 2)).toEqual({ x: 4, y: -6 })
  })

  it('normalizes to unit length and leaves zero vectors alone', () => {
    const n = normalize({ x: 3, y: 4 })
    expect(n.x).toBeCloseTo(0.6)
    expect(n.y).toBeCloseTo(0.8)
    expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 })
  })

  it('measures distance', () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('detects circle overlap exactly at the radius sum boundary', () => {
    expect(circlesOverlap({ x: 0, y: 0 }, 10, { x: 19.9, y: 0 }, 10)).toBe(true)
    expect(circlesOverlap({ x: 0, y: 0 }, 10, { x: 20.1, y: 0 }, 10)).toBe(false)
  })

  it('clamps positions inside the arena respecting radius', () => {
    expect(clampToArena({ x: -50, y: 100 }, PLAYER_RADIUS)).toEqual({ x: PLAYER_RADIUS, y: 100 })
    expect(clampToArena({ x: ARENA.width + 50, y: ARENA.height + 50 }, PLAYER_RADIUS))
      .toEqual({ x: ARENA.width - PLAYER_RADIUS, y: ARENA.height - PLAYER_RADIUS })
  })
})
