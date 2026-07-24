import type { Vec } from './geometry.js'
import { scaledEnemyHp } from './enemies.js'
import type { GameDesign } from './design.js'
import { defaultDesign, designEnemy } from './design.js'
import type { WaveStats } from './stats.js'
import { createWaveStats } from './stats.js'
import { ARENA } from './constants.js'
import { computeStats } from './progression.js'

export interface PlayerStats {
  maxHp: number
  damage: number
  fireRateMs: number
  moveSpeed: number
  pickupRadius: number
}

export interface PlayerState {
  id: string
  name: string
  pos: Vec
  hp: number
  alive: boolean
  xp: number
  level: number
  gear: string[]
  stats: PlayerStats
  fireCooldownMs: number
  waveStats: WaveStats
  history: WaveStats[]
}

export interface EnemyState {
  id: number
  kind: string
  pos: Vec
  hp: number
  maxHp: number
  speed: number
  radius: number
  touchDamage: number
  xpValue: number
}

export interface ProjectileState {
  id: number
  ownerId: string
  pos: Vec
  vel: Vec
  damage: number
  ttlMs: number
}

export interface OrbState {
  id: number
  pos: Vec
  xp: number
}

export type Phase = 'lobby' | 'fighting' | 'shopping' | 'countdown' | 'runOver'

export interface PlayerInput {
  move: Vec
}

export type Inputs = Record<string, PlayerInput>

export interface GameState {
  tick: number
  phase: Phase
  wave: number
  waveMsLeft: number
  countdownMsLeft: number
  spawnCooldownMs: number
  players: PlayerState[]
  enemies: EnemyState[]
  projectiles: ProjectileState[]
  orbs: OrbState[]
  pendingOffers: Record<string, string[]>
  nextEntityId: number
}

export function createGameState(): GameState {
  return {
    tick: 0,
    phase: 'lobby',
    wave: 0,
    waveMsLeft: 0,
    countdownMsLeft: 0,
    spawnCooldownMs: 0,
    players: [],
    enemies: [],
    projectiles: [],
    orbs: [],
    pendingOffers: {},
    nextEntityId: 1
  }
}

export function addPlayer(state: GameState, id: string, name: string): PlayerState {
  const stats = computeStats(1, [])
  const player: PlayerState = {
    id,
    name,
    pos: spawnPosition(state.players.length),
    hp: stats.maxHp,
    alive: true,
    xp: 0,
    level: 1,
    gear: [],
    stats,
    fireCooldownMs: 0,
    waveStats: createWaveStats(),
    history: []
  }
  state.players.push(player)
  return player
}

export function removePlayer(state: GameState, id: string): void {
  state.players = state.players.filter(p => p.id !== id)
  delete state.pendingOffers[id]
}

export function findPlayer(state: GameState, id: string): PlayerState | undefined {
  return state.players.find(p => p.id === id)
}

export function spawnPosition(index: number): Vec {
  const center = { x: ARENA.width / 2, y: ARENA.height / 2 }
  if (index === 0) return center
  const angle = (index - 1) * (Math.PI / 3)
  return { x: center.x + Math.cos(angle) * 120, y: center.y + Math.sin(angle) * 120 }
}

export function spawnEnemy(state: GameState, kind: string, pos: Vec, design: GameDesign = defaultDesign()): EnemyState | undefined {
  const spec = designEnemy(design, kind)
  if (!spec) return undefined
  const hp = scaledEnemyHp(spec.baseHp, Math.max(state.wave, 1))
  const enemy: EnemyState = {
    id: state.nextEntityId++,
    kind,
    pos: { ...pos },
    hp,
    maxHp: hp,
    speed: spec.speed,
    radius: spec.radius,
    touchDamage: spec.touchDamagePerSecond,
    xpValue: spec.xpValue
  }
  state.enemies.push(enemy)
  return enemy
}
