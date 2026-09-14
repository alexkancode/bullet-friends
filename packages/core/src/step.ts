import type { Rng } from './rng.js'
import type { GameState, Inputs } from './state.js'
import type { GameDesign } from './design.js'
import { defaultDesign, designGear } from './design.js'
import { spawnPosition } from './state.js'
import { applyInputs } from './movement.js'
import { advanceProjectiles, fireWeapons, moveEnemies, resolveContactDamage, resolveProjectileHits } from './combat.js'
import { collectOrbs, awardXp, refreshStats, computeStats } from './progression.js'
import { advanceWave, beginWave } from './waves.js'
import { COUNTDOWN_MS, TICK_MS } from './constants.js'
import { createWaveStats } from './stats.js'

export function startRun(state: GameState, design: GameDesign = defaultDesign()): void {
  state.players.forEach((player, index) => {
    player.level = 1
    player.xp = 0
    player.gear = []
    player.stats = computeStats(1, [], design.gear)
    player.hp = player.stats.maxHp
    player.alive = true
    player.fireCooldownMs = 0
    player.pos = spawnPosition(index)
    player.waveStats = createWaveStats()
    player.history = []
  })
  beginWave(state, 1, design)
}

export function pauseGame(state: GameState, byName: string): boolean {
  if (state.pausedBy !== '' || (state.phase !== 'fighting' && state.phase !== 'countdown')) return false
  state.pausedBy = byName
  state.pausedMs = 0
  return true
}

export function resumeGame(state: GameState): void {
  state.pausedBy = ''
  state.pausedMs = 0
}

export function abandonRun(state: GameState): boolean {
  if (state.phase !== 'fighting' && state.phase !== 'shopping' && state.phase !== 'countdown') return false
  resumeGame(state)
  endRun(state)
  return true
}

export function step(state: GameState, inputs: Inputs, rng: Rng, design: GameDesign = defaultDesign()): void {
  state.tick += 1
  if (state.pausedBy !== '') {
    state.pausedMs += TICK_MS
    return
  }
  if (state.phase === 'countdown') {
    applyInputs(state, inputs)
    state.countdownMsLeft -= TICK_MS
    if (state.countdownMsLeft <= 0) beginWave(state, state.wave + 1, design)
    return
  }
  if (state.phase !== 'fighting') return
  applyInputs(state, inputs)
  fireWeapons(state)
  advanceProjectiles(state)
  moveEnemies(state)
  resolveProjectileHits(state)
  resolveContactDamage(state)
  collectOrbs(state, design.gear)
  if (state.players.length > 0 && state.players.every(p => !p.alive)) {
    endRun(state)
    return
  }
  advanceWave(state, rng, design)
}

export function pickGear(state: GameState, playerId: string, gearId: string, design: GameDesign = defaultDesign()): void {
  if (state.phase !== 'shopping') return
  const offer = state.pendingOffers[playerId]
  if (!offer || !offer.includes(gearId) || !designGear(design, gearId)) return
  const player = state.players.find(p => p.id === playerId)
  if (!player) return
  player.gear.push(gearId)
  refreshStats(player, design.gear)
  delete state.pendingOffers[playerId]
  if (Object.keys(state.pendingOffers).length === 0) {
    state.phase = 'countdown'
    state.countdownMsLeft = COUNTDOWN_MS
  }
}

function endRun(state: GameState): void {
  for (const player of state.players) {
    player.history.push(player.waveStats)
    player.waveStats = createWaveStats()
  }
  state.phase = 'runOver'
}

export { awardXp }
