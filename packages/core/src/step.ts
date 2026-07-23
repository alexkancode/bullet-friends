import type { Rng } from './rng.js'
import type { GameState, Inputs } from './state.js'
import { spawnPosition } from './state.js'
import { applyInputs } from './movement.js'
import { advanceProjectiles, fireWeapons, moveEnemies, resolveContactDamage, resolveProjectileHits } from './combat.js'
import { collectOrbs, awardXp, refreshStats, computeStats } from './progression.js'
import { advanceWave, beginWave } from './waves.js'
import { createWaveStats } from './stats.js'
import { gearById } from './gear.js'

export function startRun(state: GameState): void {
  state.players.forEach((player, index) => {
    player.level = 1
    player.xp = 0
    player.gear = []
    player.stats = computeStats(1, [])
    player.hp = player.stats.maxHp
    player.alive = true
    player.fireCooldownMs = 0
    player.pos = spawnPosition(index)
    player.waveStats = createWaveStats()
    player.history = []
  })
  beginWave(state, 1)
}

export function step(state: GameState, inputs: Inputs, rng: Rng): void {
  state.tick += 1
  if (state.phase !== 'fighting') return
  applyInputs(state, inputs)
  fireWeapons(state)
  advanceProjectiles(state)
  moveEnemies(state)
  resolveProjectileHits(state)
  resolveContactDamage(state)
  collectOrbs(state)
  if (state.players.length > 0 && state.players.every(p => !p.alive)) {
    endRun(state)
    return
  }
  advanceWave(state, rng)
}

export function pickGear(state: GameState, playerId: string, gearId: string): void {
  if (state.phase !== 'shopping') return
  const offer = state.pendingOffers[playerId]
  if (!offer || !offer.includes(gearId) || !gearById(gearId)) return
  const player = state.players.find(p => p.id === playerId)
  if (!player) return
  player.gear.push(gearId)
  refreshStats(player)
  delete state.pendingOffers[playerId]
  if (Object.keys(state.pendingOffers).length === 0) beginWave(state, state.wave + 1)
}

function endRun(state: GameState): void {
  for (const player of state.players) {
    player.history.push(player.waveStats)
    player.waveStats = createWaveStats()
  }
  state.phase = 'runOver'
}

export { awardXp }
