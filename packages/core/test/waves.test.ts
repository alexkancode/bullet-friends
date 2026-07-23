import { describe, expect, it } from 'vitest'
import { addPlayer, createGameState, createRng, startRun, step, waveDurationMs, enemyHpForWave } from '@bullet/core'

const noInput = { p1: { move: { x: 0, y: 0 } } }

describe('waves', () => {
  it('starts a run in wave 1 with a full timer and fighting phase', () => {
    const state = createGameState()
    addPlayer(state, 'p1', 'Alex')
    startRun(state)
    expect(state.phase).toBe('fighting')
    expect(state.wave).toBe(1)
    expect(state.waveMsLeft).toBe(waveDurationMs(1))
  })

  it('spawns enemies during a wave', () => {
    const state = createGameState()
    addPlayer(state, 'p1', 'Alex')
    startRun(state)
    for (let i = 0; i < 40; i++) step(state, noInput, createRng(1))
    expect(state.enemies.length).toBeGreaterThan(0)
  })

  it('scales enemy hp with wave number', () => {
    expect(enemyHpForWave('blob', 5)).toBeGreaterThan(enemyHpForWave('blob', 1))
  })

  it('later waves last longer', () => {
    expect(waveDurationMs(3)).toBeGreaterThan(waveDurationMs(1))
  })

  it('ends the wave into shopping, clears the field, banks orbs, and offers gear', () => {
    const state = createGameState()
    const p = addPlayer(state, 'p1', 'Alex')
    startRun(state)
    state.waveMsLeft = 50
    state.orbs.push({ id: 999, pos: { x: 0, y: 0 }, xp: 5 })
    step(state, noInput, createRng(1))
    expect(state.phase).toBe('shopping')
    expect(state.enemies.length).toBe(0)
    expect(state.projectiles.length).toBe(0)
    expect(state.orbs.length).toBe(0)
    expect(p.xp).toBeGreaterThanOrEqual(5)
    expect(state.pendingOffers['p1']?.length).toBe(3)
    expect(p.history.length).toBe(1)
  })

  it('revives downed players into the next wave at half hp', () => {
    const state = createGameState()
    addPlayer(state, 'p1', 'Alex')
    const p2 = addPlayer(state, 'p2', 'Sam')
    startRun(state)
    p2.alive = false
    p2.hp = 0
    state.waveMsLeft = 50
    step(state, { ...noInput, p2: { move: { x: 0, y: 0 } } }, createRng(1))
    expect(p2.alive).toBe(true)
    expect(p2.hp).toBe(p2.stats.maxHp / 2)
  })
})
