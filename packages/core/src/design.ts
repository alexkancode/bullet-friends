import type { GearItem } from './gear.js'
import { GEAR_CATALOG } from './gear.js'
import type { EnemyKind } from './enemies.js'
import { ENEMY_SPECS } from './enemies.js'
import { waveDurationMs, spawnIntervalMs } from './pacing.js'

export interface EnemyDesign {
  id: string
  name: string
  baseHp: number
  speed: number
  radius: number
  touchDamagePerSecond: number
  xpValue: number
  weight: number
  art: string
}

export interface LevelDesign {
  durationMs: number
  spawnIntervalMs: number
  enemyIds: string[]
}

export interface GameDesign {
  name: string
  enemies: EnemyDesign[]
  gear: GearItem[]
  levels: LevelDesign[]
}

const DEFAULT_ENEMY_ART: Record<EnemyKind, string> = {
  blob: 'art/blob.svg',
  sprinter: 'art/sprinter.svg',
  brute: 'art/brute.svg'
}

const DEFAULT_LEVEL_COUNT = 8

export function defaultDesign(): GameDesign {
  const kinds = Object.keys(ENEMY_SPECS) as EnemyKind[]
  return {
    name: 'Classic',
    enemies: kinds.map(kind => ({
      id: kind,
      name: kind.charAt(0).toUpperCase() + kind.slice(1),
      baseHp: ENEMY_SPECS[kind].baseHp,
      speed: ENEMY_SPECS[kind].speed,
      radius: ENEMY_SPECS[kind].radius,
      touchDamagePerSecond: ENEMY_SPECS[kind].touchDamagePerSecond,
      xpValue: ENEMY_SPECS[kind].xpValue,
      weight: ENEMY_SPECS[kind].weight,
      art: DEFAULT_ENEMY_ART[kind]
    })),
    gear: GEAR_CATALOG.map(item => ({ ...item, modifiers: item.modifiers.map(mod => ({ ...mod })) })),
    levels: Array.from({ length: DEFAULT_LEVEL_COUNT }, (_, index) => {
      const wave = index + 1
      return {
        durationMs: waveDurationMs(wave),
        spawnIntervalMs: spawnIntervalMs(wave),
        enemyIds: kinds.filter(kind => ENEMY_SPECS[kind].fromWave <= wave)
      }
    })
  }
}

const EMERGENCY_LEVEL: LevelDesign = { durationMs: 20000, spawnIntervalMs: 1000, enemyIds: [] }

export function levelForWave(design: GameDesign, wave: number): LevelDesign {
  const index = Math.min(Math.max(wave, 1), design.levels.length) - 1
  return design.levels[index] ?? EMERGENCY_LEVEL
}

export function designEnemy(design: GameDesign, id: string): EnemyDesign | undefined {
  return design.enemies.find(enemy => enemy.id === id)
}

export function designGear(design: GameDesign, id: string): GearItem | undefined {
  return design.gear.find(item => item.id === id)
}
