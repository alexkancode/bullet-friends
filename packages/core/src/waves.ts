import type { GameState } from './state.js'
import type { Rng } from './rng.js'
import type { Vec } from './geometry.js'
import type { GameDesign, LevelDesign } from './design.js'
import { defaultDesign, designEnemy, levelForWave } from './design.js'
import { spawnEnemy } from './state.js'
import { createWaveStats } from './stats.js'
import { rollOffers } from './gear.js'
import { bankRemainingOrbs } from './progression.js'
import { ARENA, COUNTDOWN_MS, TICK_MS } from './constants.js'

export { waveDurationMs, spawnIntervalMs } from './pacing.js'

export function beginWave(state: GameState, wave: number, design: GameDesign = defaultDesign()): void {
  const level = levelForWave(design, wave)
  state.phase = 'fighting'
  state.wave = wave
  state.waveMsLeft = level.durationMs
  state.spawnCooldownMs = level.spawnIntervalMs
  state.enemies = []
  state.projectiles = []
  state.orbs = []
  state.pendingOffers = {}
}

export function advanceWave(state: GameState, rng: Rng, design: GameDesign = defaultDesign()): void {
  state.waveMsLeft -= TICK_MS
  if (state.waveMsLeft <= 0) {
    endWave(state, rng, design)
    return
  }
  state.spawnCooldownMs -= TICK_MS
  if (state.spawnCooldownMs <= 0) {
    const level = levelForWave(design, state.wave)
    spawnEnemy(state, pickKind(level, design, rng), edgePosition(rng), design)
    state.spawnCooldownMs = level.spawnIntervalMs
  }
}

function endWave(state: GameState, rng: Rng, design: GameDesign): void {
  state.waveMsLeft = 0
  bankRemainingOrbs(state, design.gear)
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
  const rolled: [string, string[]][] = state.players.map(p => [p.id, rollOffers(rng, design.gear)])
  state.pendingOffers = Object.fromEntries(rolled.filter(([, offers]) => offers.length > 0))
  if (Object.keys(state.pendingOffers).length === 0) {
    state.phase = 'countdown'
    state.countdownMsLeft = COUNTDOWN_MS
    return
  }
  state.phase = 'shopping'
}

function pickKind(level: LevelDesign, design: GameDesign, rng: Rng): string {
  const totalWeight = level.enemyIds.reduce((sum, id) => sum + (designEnemy(design, id)?.weight ?? 0), 0)
  let roll = rng() * totalWeight
  for (const id of level.enemyIds) {
    roll -= designEnemy(design, id)?.weight ?? 0
    if (roll <= 0) return id
  }
  return level.enemyIds[0] ?? ''
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
