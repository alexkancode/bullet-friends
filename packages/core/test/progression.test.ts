import { describe, expect, it } from 'vitest'
import { addPlayer, computeStats, createGameState, createRng, startRun, step, xpToNextLevel, BASE_STATS } from '@bullet/core'

const noInput = { p1: { move: { x: 0, y: 0 } } }

describe('progression', () => {
  it('requires more xp for later levels', () => {
    expect(xpToNextLevel(5)).toBeGreaterThan(xpToNextLevel(1))
  })

  it('collects orbs inside the pickup radius and not outside', () => {
    const state = createGameState()
    const p = addPlayer(state, 'p1', 'Alex')
    startRun(state)
    state.waveMsLeft = 60000
    state.orbs.push({ id: 1, pos: { x: p.pos.x + p.stats.pickupRadius - 1, y: p.pos.y }, xp: 3 })
    state.orbs.push({ id: 2, pos: { x: p.pos.x + p.stats.pickupRadius + 200, y: p.pos.y }, xp: 3 })
    step(state, noInput, createRng(1))
    expect(p.xp).toBe(3)
    expect(p.waveStats.xpGained).toBe(3)
    expect(state.orbs.length).toBe(1)
  })

  it('levels up when xp crosses the threshold, carrying the remainder', () => {
    const state = createGameState()
    const p = addPlayer(state, 'p1', 'Alex')
    startRun(state)
    state.waveMsLeft = 60000
    state.orbs.push({ id: 1, pos: { ...p.pos }, xp: xpToNextLevel(1) + 2 })
    step(state, noInput, createRng(1))
    expect(p.level).toBe(2)
    expect(p.xp).toBe(2)
  })

  it('leveling up raises stats and heals the difference in max hp', () => {
    const lvl1 = computeStats(1, [])
    const lvl3 = computeStats(3, [])
    expect(lvl3.maxHp).toBeGreaterThan(lvl1.maxHp)
    expect(lvl3.damage).toBeGreaterThan(lvl1.damage)
    expect(lvl1.maxHp).toBe(BASE_STATS.maxHp)
  })
})
