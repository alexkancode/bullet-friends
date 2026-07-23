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
