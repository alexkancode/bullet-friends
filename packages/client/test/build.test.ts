import { describe, expect, it } from 'vitest'
import { addPlayer, createGameState, defaultDesign, refreshStats } from '@bullet/core'
import { buildSummary } from '../src/ui/build.js'

function playerWith(gear: string[]) {
  const state = createGameState()
  const player = addPlayer(state, 'p1', 'Alex')
  player.gear = gear
  refreshStats(player)
  return player
}

describe('buildSummary', () => {
  it('counts duplicate items in first-pick order', () => {
    const summary = buildSummary(playerWith(['monocle', 'top-hat', 'monocle']), defaultDesign())
    expect(summary.items).toEqual([
      { name: 'Monocle', count: 2 },
      { name: 'Top Hat', count: 1 }
    ])
  })

  it('reports every stat with a ratio against base only when changed', () => {
    const summary = buildSummary(playerWith(['monocle', 'monocle']), defaultDesign())
    expect(summary.stats.map(s => s.label)).toEqual(['Max HP', 'Damage', 'Attack Speed', 'Move Speed', 'Pickup Range'])
    expect(summary.stats.find(s => s.label === 'Pickup Range')).toEqual({ label: 'Pickup Range', value: '203', ratio: 'x2.25' })
    expect(summary.stats.find(s => s.label === 'Max HP')).toEqual({ label: 'Max HP', value: '100', ratio: undefined })
  })

  it('shows attack speed as shots per second with a bigger-is-better ratio', () => {
    const summary = buildSummary(playerWith(['star-shades']), defaultDesign())
    expect(summary.stats.find(s => s.label === 'Attack Speed')).toEqual({ label: 'Attack Speed', value: '2.4/s', ratio: 'x1.18' })
  })

  it('is empty-handed for a fresh player', () => {
    const summary = buildSummary(playerWith([]), defaultDesign())
    expect(summary.items).toEqual([])
    expect(summary.stats.every(s => s.ratio === undefined)).toBe(true)
  })
})
