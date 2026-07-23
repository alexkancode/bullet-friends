import type { PlayerState, WaveStats } from '@bullet/core'

export interface Metric {
  key: keyof WaveStats
  label: string
}

export const METRICS: Metric[] = [
  { key: 'kills', label: 'Kills' },
  { key: 'damageDealt', label: 'Damage Dealt' },
  { key: 'damageTaken', label: 'Damage Taken' },
  { key: 'xpGained', label: 'XP Gained' }
]

export interface MetricSeries {
  playerId: string
  name: string
  colorIndex: number
  values: number[]
}

export interface StatTile {
  label: string
  value: string
}

export function buildStatTiles(players: PlayerState[]): StatTile[] {
  const waves = Math.max(0, ...players.map(p => p.history.length))
  const totalOf = (metric: keyof WaveStats) => players.reduce((sum, p) => sum + p.history.reduce((s, entry) => s + entry[metric], 0), 0)
  return [
    { label: 'Waves survived', value: String(waves) },
    { label: 'Team kills', value: String(Math.round(totalOf('kills'))) },
    { label: 'Team damage', value: String(Math.round(totalOf('damageDealt'))) }
  ]
}

export function cumulative(values: number[]): number[] {
  let total = 0
  return values.map(value => (total += value))
}

export interface DamagePair {
  name: string
  colorIndex: number
  dealt: number
  taken: number
}

export function buildDamagePairs(players: PlayerState[]): DamagePair[] {
  return players.map((player, index) => ({
    name: player.name,
    colorIndex: index,
    dealt: Math.round(player.history.reduce((sum, entry) => sum + entry.damageDealt, 0)),
    taken: Math.round(player.history.reduce((sum, entry) => sum + entry.damageTaken, 0))
  }))
}

export function buildMetricSeries(players: PlayerState[], metric: keyof WaveStats): MetricSeries[] {
  const waveCount = Math.max(0, ...players.map(p => p.history.length))
  return players.map((player, index) => ({
    playerId: player.id,
    name: player.name,
    colorIndex: index,
    values: [
      ...Array.from({ length: waveCount - player.history.length }, () => 0),
      ...player.history.map(entry => entry[metric])
    ]
  }))
}
