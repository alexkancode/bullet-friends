import { describe, expect, it } from 'vitest'
import { addPlayer, createGameState, createRng, startRun, step, COUNTDOWN_MS, GEAR_CATALOG } from '@bullet/core'

describe('shop with nothing left to offer', () => {
  it('skips straight to the countdown when every player owns all gear', () => {
    const state = createGameState()
    const player = addPlayer(state, 'p1', 'Alex')
    startRun(state)
    player.gear = GEAR_CATALOG.map(g => g.id)
    state.waveMsLeft = 50
    step(state, { p1: { move: { x: 0, y: 0 } } }, createRng(1))
    expect(state.phase).toBe('countdown')
    expect(state.countdownMsLeft).toBe(COUNTDOWN_MS)
    expect(state.pendingOffers).toEqual({})
  })

  it('still shops for players who have gear left', () => {
    const state = createGameState()
    const full = addPlayer(state, 'p1', 'Alex')
    addPlayer(state, 'p2', 'Sam')
    startRun(state)
    full.gear = GEAR_CATALOG.map(g => g.id)
    state.waveMsLeft = 50
    step(state, { p1: { move: { x: 0, y: 0 } }, p2: { move: { x: 0, y: 0 } } }, createRng(1))
    expect(state.phase).toBe('shopping')
    expect(Object.keys(state.pendingOffers)).toEqual(['p2'])
  })
})
