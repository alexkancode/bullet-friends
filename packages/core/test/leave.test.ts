import { describe, expect, it } from 'vitest'
import { abandonRun, addPlayer, createGameState, pauseGame, startRun } from '@bullet/core'

function midFight() {
  const state = createGameState()
  addPlayer(state, 'p1', 'Alex')
  startRun(state)
  return state
}

describe('abandonRun', () => {
  it('ends a fight, banks the wave stats and clears any pause', () => {
    const state = midFight()
    const player = state.players[0]!
    player.waveStats.kills = 3
    pauseGame(state, 'Alex')
    expect(abandonRun(state)).toBe(true)
    expect(state.phase).toBe('runOver')
    expect(state.pausedBy).toBe('')
    expect(state.pausedMs).toBe(0)
    expect(player.history).toEqual([expect.objectContaining({ kills: 3 })])
    expect(player.waveStats.kills).toBe(0)
  })

  it('ends a run from the countdown and the shop', () => {
    for (const phase of ['countdown', 'shopping'] as const) {
      const state = midFight()
      state.phase = phase
      expect(abandonRun(state)).toBe(true)
      expect(state.phase).toBe('runOver')
    }
  })

  it('does nothing outside a run', () => {
    for (const phase of ['lobby', 'runOver'] as const) {
      const state = midFight()
      state.phase = phase
      const before = JSON.stringify(state)
      expect(abandonRun(state)).toBe(false)
      expect(JSON.stringify(state)).toBe(before)
    }
  })
})
