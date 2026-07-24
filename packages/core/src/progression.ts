import type { GameState, PlayerState, PlayerStats } from './state.js'
import type { GearItem } from './gear.js'
import { dist } from './geometry.js'
import { GEAR_CATALOG } from './gear.js'

export const BASE_STATS: PlayerStats = {
  maxHp: 100,
  damage: 10,
  fireRateMs: 500,
  moveSpeed: 220,
  pickupRadius: 90
}

const LEVEL_BONUS = { maxHp: 5, damage: 1 }

export function xpToNextLevel(level: number): number {
  return 20 + (level - 1) * 15
}

export function computeStats(level: number, gearIds: string[], catalog: GearItem[] = GEAR_CATALOG): PlayerStats {
  const stats: PlayerStats = {
    ...BASE_STATS,
    maxHp: BASE_STATS.maxHp + LEVEL_BONUS.maxHp * (level - 1),
    damage: BASE_STATS.damage + LEVEL_BONUS.damage * (level - 1)
  }
  for (const id of gearIds) {
    const item = catalog.find(g => g.id === id)
    if (!item) continue
    for (const mod of item.modifiers) {
      if (mod.flat !== undefined) stats[mod.stat] += mod.flat
      if (mod.mult !== undefined) stats[mod.stat] *= mod.mult
    }
  }
  return stats
}

export function refreshStats(player: PlayerState, catalog: GearItem[] = GEAR_CATALOG): void {
  const next = computeStats(player.level, player.gear, catalog)
  const hpGain = next.maxHp - player.stats.maxHp
  player.stats = next
  if (hpGain > 0) player.hp = Math.min(player.hp + hpGain, next.maxHp)
}

export function awardXp(player: PlayerState, amount: number, catalog: GearItem[] = GEAR_CATALOG): void {
  player.xp += amount
  player.waveStats.xpGained += amount
  while (player.xp >= xpToNextLevel(player.level)) {
    player.xp -= xpToNextLevel(player.level)
    player.level += 1
    refreshStats(player, catalog)
  }
}

export function collectOrbs(state: GameState, catalog: GearItem[] = GEAR_CATALOG): void {
  const alive = state.players.filter(p => p.alive)
  if (alive.length === 0) return
  state.orbs = state.orbs.filter(orb => {
    const collector = alive.find(p => dist(p.pos, orb.pos) <= p.stats.pickupRadius)
    if (!collector) return true
    awardXp(collector, orb.xp, catalog)
    return false
  })
}

export function bankRemainingOrbs(state: GameState, catalog: GearItem[] = GEAR_CATALOG): void {
  const alive = state.players.filter(p => p.alive)
  for (const orb of state.orbs) {
    const nearest = nearestOf(alive, orb.pos)
    if (nearest) awardXp(nearest, orb.xp, catalog)
  }
  state.orbs = []
}

function nearestOf(players: PlayerState[], pos: { x: number; y: number }): PlayerState | undefined {
  let best: PlayerState | undefined
  let bestDist = Infinity
  for (const p of players) {
    const d = dist(p.pos, pos)
    if (d < bestDist) {
      bestDist = d
      best = p
    }
  }
  return best
}
