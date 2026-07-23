import { describe, expect, it } from 'vitest'
import { addPlayer, createGameState } from '@bullet/core'
import { buildStatTiles, buildDamagePairs, cumulative } from '../src/ui/statsData.js'

function twoPlayerState() {
  const state = createGameState()
  const a = addPlayer(state, 'p1', 'Alex')
  const b = addPlayer(state, 'p2', 'Sam')
  a.history = [
    { kills: 3, damageDealt: 40.4, damageTaken: 10, xpGained: 9 },
    { kills: 5, damageDealt: 80.3, damageTaken: 20.5, xpGained: 15 }
  ]
  b.history = [{ kills: 1, damageDealt: 10.3, damageTaken: 30, xpGained: 3 }]
  return state
}

describe('buildStatTiles', () => {
  it('summarizes waves, team kills, and team damage', () => {
    const tiles = buildStatTiles(twoPlayerState().players)
    expect(tiles.map(t => t.label)).toEqual(['Waves survived', 'Team kills', 'Team damage'])
    expect(tiles.map(t => t.value)).toEqual(['2', '9', '131'])
  })

  it('shows zeros for an empty run', () => {
    const state = createGameState()
    addPlayer(state, 'p1', 'Alex')
    const tiles = buildStatTiles(state.players)
    expect(tiles.map(t => t.value)).toEqual(['0', '0', '0'])
  })
})

describe('cumulative', () => {
  it('accumulates running totals', () => {
    expect(cumulative([9, 15, 6])).toEqual([9, 24, 30])
    expect(cumulative([5])).toEqual([5])
    expect(cumulative([])).toEqual([])
  })
})

describe('buildDamagePairs', () => {
  it('keeps player order and color index with rounded totals', () => {
    const pairs = buildDamagePairs(twoPlayerState().players)
    expect(pairs).toEqual([
      { name: 'Alex', colorIndex: 0, dealt: 121, taken: 31 },
      { name: 'Sam', colorIndex: 1, dealt: 10, taken: 30 }
    ])
  })
})
