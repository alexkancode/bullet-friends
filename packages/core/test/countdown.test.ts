import { describe, expect, it } from 'vitest'
import type { GameState } from '@bullet/core'
import { addPlayer, createGameState, createRng, pickGear, startRun, step, COUNTDOWN_MS, TICK_MS } from '@bullet/core'

function shoppingState(): GameState {
  const state = createGameState()
  addPlayer(state, 'p1', 'Alex')
  startRun(state)
  state.phase = 'shopping'
  state.waveMsLeft = 0
  state.pendingOffers = { p1: ['top-hat', 'monocle', 'pipe'] }
  return state
}

const noInput = { p1: { move: { x: 0, y: 0 } } }

describe('countdown', () => {
  it('enters a countdown instead of fighting when the last player picks', () => {
    const state = shoppingState()
    pickGear(state, 'p1', 'top-hat')
    expect(state.phase).toBe('countdown')
    expect(state.countdownMsLeft).toBe(COUNTDOWN_MS)
    expect(state.wave).toBe(1)
  })

  it('holds the shop open while any offer is unpicked', () => {
    const state = shoppingState()
    state.pendingOffers = { p1: ['top-hat'], p2: ['monocle'] }
    pickGear(state, 'p1', 'top-hat')
    expect(state.phase).toBe('shopping')
  })

  it('counts down then begins the next wave', () => {
    const state = shoppingState()
    pickGear(state, 'p1', 'top-hat')
    const ticks = Math.ceil(COUNTDOWN_MS / TICK_MS)
    for (let i = 0; i < ticks; i++) {
      expect(state.enemies.length).toBe(0)
      step(state, noInput, createRng(1))
    }
    expect(state.phase).toBe('fighting')
    expect(state.wave).toBe(2)
  })

  it('lets players reposition during the countdown without spawns', () => {
    const state = shoppingState()
    pickGear(state, 'p1', 'top-hat')
    const player = state.players[0]!
    const startX = player.pos.x
    step(state, { p1: { move: { x: 1, y: 0 } } }, createRng(1))
    expect(player.pos.x).toBeGreaterThan(startX)
    expect(state.enemies.length).toBe(0)
    expect(state.phase).toBe('countdown')
  })
})
