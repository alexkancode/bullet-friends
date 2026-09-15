import { describe, expect, it } from 'vitest'
import { addPlayer, computeStats, createGameState, createRng, refreshStats, startRun, step, ARENA, BASE_STATS } from '@bullet/core'

const noInput = { p1: { move: { x: 0, y: 0 } } }

function playerWithMonocles(copies: number) {
  const state = createGameState()
  const player = addPlayer(state, 'p1', 'Alex')
  startRun(state)
  player.gear = Array.from({ length: copies }, () => 'monocle')
  refreshStats(player)
  return { state, player }
}

function collectsAt(copies: number, distance: number): boolean {
  const { state, player } = playerWithMonocles(copies)
  state.orbs = [{ id: 1, pos: { x: ARENA.width / 2 + distance, y: ARENA.height / 2 }, xp: 5 }]
  step(state, noInput, createRng(1))
  return player.xp === 5 && state.orbs.length === 0
}

describe('pickup range', () => {
  it('starts at the base radius', () => {
    expect(collectsAt(0, BASE_STATS.pickupRadius - 1)).toBe(true)
    expect(collectsAt(0, 130)).toBe(false)
  })

  it('one monocle reaches orbs a bare player cannot', () => {
    expect(collectsAt(1, 130)).toBe(true)
    expect(collectsAt(1, 200)).toBe(false)
  })

  it('two monocles compound', () => {
    expect(collectsAt(2, 200)).toBe(true)
    expect(collectsAt(2, 250)).toBe(false)
  })

  it('three monocles more than triple the base radius', () => {
    expect(collectsAt(3, 300)).toBe(true)
    expect(computeStats(1, ['monocle', 'monocle', 'monocle']).pickupRadius).toBeGreaterThanOrEqual(BASE_STATS.pickupRadius * 3)
  })
})
