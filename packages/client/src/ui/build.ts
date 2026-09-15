import type { GameDesign, PlayerState, StatKey } from '@bullet/core'
import { BASE_STATS, designGear } from '@bullet/core'
import { STAT_LABELS, STAT_ORDER } from './statLabels.js'

export interface BuildItem {
  name: string
  count: number
}

export interface BuildStat {
  label: string
  value: string
  ratio: string | undefined
}

export interface BuildSummary {
  items: BuildItem[]
  stats: BuildStat[]
}

export function buildSummary(player: PlayerState, design: GameDesign): BuildSummary {
  return { items: countItems(player.gear, design), stats: STAT_ORDER.map(stat => describeStat(stat, player.stats[stat])) }
}

function countItems(gear: string[], design: GameDesign): BuildItem[] {
  const counts = new Map<string, BuildItem>()
  for (const id of gear) {
    const name = designGear(design, id)?.name ?? id
    const entry = counts.get(id) ?? { name, count: 0 }
    entry.count += 1
    counts.set(id, entry)
  }
  return [...counts.values()]
}

function describeStat(stat: StatKey, value: number): BuildStat {
  const ratio = stat === 'fireRateMs' ? BASE_STATS[stat] / value : value / BASE_STATS[stat]
  const rounded = Math.round(ratio * 100) / 100
  return {
    label: STAT_LABELS[stat],
    value: stat === 'fireRateMs' ? `${(1000 / value).toFixed(1)}/s` : `${Math.round(value)}`,
    ratio: rounded === 1 ? undefined : `x${rounded}`
  }
}
