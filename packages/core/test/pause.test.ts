import { describe, expect, it } from 'vitest'
import { addPlayer, createGameState, createRng, pauseGame, resumeGame, spawnEnemy, startRun, step, TICK_MS } from '@bullet/core'

const noInput = { p1: { move: { x: 0, y: 0 } } }

function midFight() {
  const state = createGameState()
  addPlayer(state, 'p1', 'Alex')
  startRun(state)
  spawnEnemy(state, 'blob', { x: 1200, y: 450 })
  return state
}

describe('group pause', () => {
  it('freezes the whole simulation while accumulating the pause stopwatch', () => {
    const state = midFight()
    expect(pauseGame(state, 'Alex')).toBe(true)
    const frozen = JSON.stringify({ ...state, tick: 0, pausedMs: 0 })
    for (let i = 0; i < 20; i++) step(state, { p1: { move: { x: 1, y: 0 } } }, createRng(1))
    expect(JSON.stringify({ ...state, tick: 0, pausedMs: 0 })).toBe(frozen)
    expect(state.pausedMs).toBe(20 * TICK_MS)
    expect(state.pausedBy).toBe('Alex')
  })

  it('resumes exactly where it left off', () => {
    const state = midFight()
    const waveMsBefore = state.waveMsLeft
    pauseGame(state, 'Alex')
    for (let i = 0; i < 10; i++) step(state, noInput, createRng(1))
    resumeGame(state)
    expect(state.pausedBy).toBe('')
    expect(state.pausedMs).toBe(0)
    expect(state.waveMsLeft).toBe(waveMsBefore)
    step(state, noInput, createRng(1))
    expect(state.waveMsLeft).toBe(waveMsBefore - TICK_MS)
  })

  it('pauses during the countdown and holds it', () => {
    const state = midFight()
    state.phase = 'countdown'
    state.countdownMsLeft = 2000
    expect(pauseGame(state, 'Sam')).toBe(true)
    for (let i = 0; i < 10; i++) step(state, noInput, createRng(1))
    expect(state.countdownMsLeft).toBe(2000)
    expect(state.phase).toBe('countdown')
  })

  it('refuses to pause outside fighting and countdown', () => {
    const state = midFight()
    for (const phase of ['lobby', 'shopping', 'runOver'] as const) {
      state.phase = phase
      expect(pauseGame(state, 'Alex')).toBe(false)
      expect(state.pausedBy).toBe('')
    }
  })

  it('does not let a second pause steal the name', () => {
    const state = midFight()
    pauseGame(state, 'Alex')
    expect(pauseGame(state, 'Sam')).toBe(false)
    expect(state.pausedBy).toBe('Alex')
  })
})

describe('run end semantics (canary)', () => {
  it('continues the run while at least one player stands', () => {
    const state = createGameState()
    addPlayer(state, 'p1', 'Alex')
    const sam = addPlayer(state, 'p2', 'Sam')
    startRun(state)
    sam.hp = 0
    sam.alive = false
    step(state, { ...noInput, p2: { move: { x: 0, y: 0 } } }, createRng(1))
    expect(state.phase).toBe('fighting')
  })
})
