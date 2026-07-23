import { describe, expect, it } from 'vitest'
import { addPlayer, createGameState } from '@bullet/core'
import { buildMetricSeries, METRICS } from '../src/ui/statsData.js'

describe('statsData', () => {
  it('describes all four chart metrics', () => {
    expect(METRICS.map(m => m.key)).toEqual(['kills', 'damageDealt', 'damageTaken', 'xpGained'])
    for (const metric of METRICS) expect(metric.label.length).toBeGreaterThan(0)
  })

  it('builds one aligned series per player from wave history', () => {
    const state = createGameState()
    const a = addPlayer(state, 'p1', 'Alex')
    const b = addPlayer(state, 'p2', 'Sam')
    a.history = [
      { kills: 3, damageDealt: 40, damageTaken: 10, xpGained: 9 },
      { kills: 5, damageDealt: 80, damageTaken: 0, xpGained: 15 }
    ]
    b.history = [{ kills: 1, damageDealt: 10, damageTaken: 30, xpGained: 3 }]
    const series = buildMetricSeries(state.players, 'kills')
    expect(series.length).toBe(2)
    expect(series[0]).toMatchObject({ playerId: 'p1', name: 'Alex', colorIndex: 0, values: [3, 5] })
    expect(series[1]).toMatchObject({ playerId: 'p2', name: 'Sam', colorIndex: 1, values: [0, 1] })
  })

  it('keeps color index stable per player order, not per data size', () => {
    const state = createGameState()
    addPlayer(state, 'p1', 'Alex')
    addPlayer(state, 'p2', 'Sam')
    const damage = buildMetricSeries(state.players, 'damageDealt')
    expect(damage.map(s => s.colorIndex)).toEqual([0, 1])
  })
})
