import type { GameState } from './state.js'
import type { EnemyKind } from './enemies.js'
import { ENEMY_SPECS } from './enemies.js'
import type { Rng } from './rng.js'
import type { Vec } from './geometry.js'
import { spawnEnemy } from './state.js'
import { createWaveStats } from './stats.js'
import { rollOffers } from './gear.js'
import { bankRemainingOrbs } from './progression.js'
import { ARENA, COUNTDOWN_MS, TICK_MS } from './constants.js'

export function waveDurationMs(wave: number): number {
  return 20000 + (wave - 1) * 4000
}

export function spawnIntervalMs(wave: number): number {
  return Math.max(300, 1100 - (wave - 1) * 100)
}

export function beginWave(state: GameState, wave: number): void {
  state.phase = 'fighting'
  state.wave = wave
  state.waveMsLeft = waveDurationMs(wave)
  state.spawnCooldownMs = spawnIntervalMs(wave)
  state.enemies = []
  state.projectiles = []
  state.orbs = []
  state.pendingOffers = {}
}

export function advanceWave(state: GameState, rng: Rng): void {
  state.waveMsLeft -= TICK_MS
  if (state.waveMsLeft <= 0) {
    endWave(state, rng)
    return
  }
  state.spawnCooldownMs -= TICK_MS
  if (state.spawnCooldownMs <= 0) {
    spawnEnemy(state, pickKind(state.wave, rng), edgePosition(rng))
    state.spawnCooldownMs = spawnIntervalMs(state.wave)
  }
}

function endWave(state: GameState, rng: Rng): void {
  state.waveMsLeft = 0
  bankRemainingOrbs(state)
  state.enemies = []
  state.projectiles = []
  for (const player of state.players) {
    player.history.push(player.waveStats)
    player.waveStats = createWaveStats()
    if (!player.alive) {
      player.alive = true
      player.hp = player.stats.maxHp / 2
    }
  }
  const rolled: [string, string[]][] = state.players.map(p => [p.id, rollOffers(rng, p.gear)])
  state.pendingOffers = Object.fromEntries(rolled.filter(([, offers]) => offers.length > 0))
  if (Object.keys(state.pendingOffers).length === 0) {
    state.phase = 'countdown'
    state.countdownMsLeft = COUNTDOWN_MS
    return
  }
  state.phase = 'shopping'
}

function pickKind(wave: number, rng: Rng): EnemyKind {
  const kinds = (Object.keys(ENEMY_SPECS) as EnemyKind[]).filter(k => ENEMY_SPECS[k].fromWave <= wave)
  const totalWeight = kinds.reduce((sum, k) => sum + ENEMY_SPECS[k].weight, 0)
  let roll = rng() * totalWeight
  for (const kind of kinds) {
    roll -= ENEMY_SPECS[kind].weight
    if (roll <= 0) return kind
  }
  return 'blob'
}

function edgePosition(rng: Rng): Vec {
  const side = Math.floor(rng() * 4)
  const alongX = rng() * ARENA.width
  const alongY = rng() * ARENA.height
  if (side === 0) return { x: alongX, y: 0 }
  if (side === 1) return { x: alongX, y: ARENA.height }
  if (side === 2) return { x: 0, y: alongY }
  return { x: ARENA.width, y: alongY }
}
