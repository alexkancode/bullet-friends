import type { EnemyDesign, GameDesign, LevelDesign } from './design.js'
import type { GearItem, GearModifier, GearSlot, StatKey } from './gear.js'

export const DESIGN_LIMITS = {
  maxEnemies: 20,
  maxGear: 24,
  maxLevels: 30,
  maxArtLength: 131072,
  maxDesignLength: 716800,
  minHp: 1,
  maxHp: 5000,
  minSpeed: 10,
  maxSpeed: 600,
  minRadius: 8,
  maxRadius: 90,
  maxTouchDamage: 200,
  maxXp: 500,
  maxWeight: 1000,
  minDurationMs: 3000,
  maxDurationMs: 180000,
  minSpawnMs: 100,
  maxSpawnMs: 10000
} as const

const SLOTS: GearSlot[] = ['hat', 'eyes', 'nose', 'mouth']
const STAT_KEYS: StatKey[] = ['maxHp', 'damage', 'fireRateMs', 'moveSpeed', 'pickupRadius']

export function sanitizeDesign(input: unknown): GameDesign | undefined {
  if (typeof input !== 'object' || input === null) return undefined
  const raw = input as Partial<GameDesign>
  if (!Array.isArray(raw.enemies) || !Array.isArray(raw.gear) || !Array.isArray(raw.levels)) return undefined
  const name = cleanName(raw.name, 'Untitled')
  if (raw.enemies.length === 0 || raw.gear.length === 0 || raw.levels.length === 0) return undefined

  const enemies = raw.enemies.slice(0, DESIGN_LIMITS.maxEnemies).map(sanitizeEnemy)
  const gear = raw.gear.slice(0, DESIGN_LIMITS.maxGear).map(sanitizeGear)
  if (enemies.some(e => e === undefined) || gear.some(g => g === undefined)) return undefined
  const cleanEnemies = enemies as EnemyDesign[]
  const cleanGear = gear as GearItem[]
  if (hasDuplicateIds(cleanEnemies.map(e => e.id)) || hasDuplicateIds(cleanGear.map(g => g.id))) return undefined

  const enemyIds = new Set(cleanEnemies.map(e => e.id))
  const levels: LevelDesign[] = []
  for (const level of raw.levels.slice(0, DESIGN_LIMITS.maxLevels)) {
    const clean = sanitizeLevel(level, enemyIds)
    if (!clean) return undefined
    levels.push(clean)
  }

  const design: GameDesign = { name, enemies: cleanEnemies, gear: cleanGear, levels }
  if (JSON.stringify(design).length > DESIGN_LIMITS.maxDesignLength) return undefined
  return design
}

function sanitizeEnemy(input: unknown): EnemyDesign | undefined {
  if (typeof input !== 'object' || input === null) return undefined
  const raw = input as Partial<EnemyDesign>
  const id = cleanId(raw.id)
  const art = cleanArt(raw.art)
  if (!id || !art) return undefined
  return {
    id,
    name: cleanName(raw.name, id),
    baseHp: clamp(raw.baseHp, DESIGN_LIMITS.minHp, DESIGN_LIMITS.maxHp, 20),
    speed: clamp(raw.speed, DESIGN_LIMITS.minSpeed, DESIGN_LIMITS.maxSpeed, 90),
    radius: clamp(raw.radius, DESIGN_LIMITS.minRadius, DESIGN_LIMITS.maxRadius, 26),
    touchDamagePerSecond: clamp(raw.touchDamagePerSecond, 0, DESIGN_LIMITS.maxTouchDamage, 20),
    xpValue: clamp(raw.xpValue, 0, DESIGN_LIMITS.maxXp, 3),
    weight: clamp(raw.weight, 1, DESIGN_LIMITS.maxWeight, 50),
    art
  }
}

function sanitizeGear(input: unknown): GearItem | undefined {
  if (typeof input !== 'object' || input === null) return undefined
  const raw = input as Partial<GearItem>
  const id = cleanId(raw.id)
  const art = cleanArt(raw.art)
  if (!id || !art) return undefined
  if (!raw.slot || !SLOTS.includes(raw.slot)) return undefined
  if (!Array.isArray(raw.modifiers) || raw.modifiers.length === 0 || raw.modifiers.length > 4) return undefined
  const modifiers: GearModifier[] = []
  for (const mod of raw.modifiers) {
    if (typeof mod !== 'object' || mod === null) return undefined
    const stat = (mod as GearModifier).stat
    if (!STAT_KEYS.includes(stat)) return undefined
    const clean: GearModifier = { stat }
    const mult = (mod as GearModifier).mult
    const flat = (mod as GearModifier).flat
    if (typeof mult === 'number' && Number.isFinite(mult)) clean.mult = Math.min(Math.max(mult, 0.25), 4)
    if (typeof flat === 'number' && Number.isFinite(flat)) clean.flat = Math.min(Math.max(flat, -100), 200)
    if (clean.mult === undefined && clean.flat === undefined) return undefined
    modifiers.push(clean)
  }
  return { id, name: cleanName(raw.name, id), slot: raw.slot, art, modifiers }
}

function sanitizeLevel(input: unknown, enemyIds: Set<string>): LevelDesign | undefined {
  if (typeof input !== 'object' || input === null) return undefined
  const raw = input as Partial<LevelDesign>
  if (!Array.isArray(raw.enemyIds) || raw.enemyIds.length === 0) return undefined
  for (const id of raw.enemyIds) {
    if (typeof id !== 'string' || !enemyIds.has(id)) return undefined
  }
  return {
    durationMs: clamp(raw.durationMs, DESIGN_LIMITS.minDurationMs, DESIGN_LIMITS.maxDurationMs, 20000),
    spawnIntervalMs: clamp(raw.spawnIntervalMs, DESIGN_LIMITS.minSpawnMs, DESIGN_LIMITS.maxSpawnMs, 1000),
    enemyIds: [...new Set(raw.enemyIds)]
  }
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.round(value * 100) / 100, min), max)
}

function cleanId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const id = value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32)
  return id.length > 0 ? id : undefined
}

function cleanName(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const name = value.trim().slice(0, 40)
  return name.length > 0 ? name : fallback
}

function cleanArt(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > DESIGN_LIMITS.maxArtLength) return undefined
  if (/^art\/[a-z0-9/-]+\.(svg|png)$/.test(value)) return value
  if (/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(value)) return value
  return undefined
}

function hasDuplicateIds(ids: string[]): boolean {
  return new Set(ids).size !== ids.length
}
