import { describe, expect, it } from 'vitest'
import { addPlayer, createGameState, createRng, defaultDesign, startRun, step, COUNTDOWN_MS, GEAR_CATALOG } from '@bullet/core'

describe('shop with nothing left to offer', () => {
  it('skips straight to the countdown when the design has no gear', () => {
    const state = createGameState()
    addPlayer(state, 'p1', 'Alex')
    const design = { ...defaultDesign(), gear: [] }
    startRun(state, design)
    state.waveMsLeft = 50
    step(state, { p1: { move: { x: 0, y: 0 } } }, createRng(1), design)
    expect(state.phase).toBe('countdown')
    expect(state.countdownMsLeft).toBe(COUNTDOWN_MS)
    expect(state.pendingOffers).toEqual({})
  })

  it('keeps shopping for a player who already owns every item', () => {
    const state = createGameState()
    const full = addPlayer(state, 'p1', 'Alex')
    startRun(state)
    full.gear = GEAR_CATALOG.map(g => g.id)
    state.waveMsLeft = 50
    step(state, { p1: { move: { x: 0, y: 0 } } }, createRng(1))
    expect(state.phase).toBe('shopping')
    expect(state.pendingOffers['p1']).toHaveLength(3)
  })
})
