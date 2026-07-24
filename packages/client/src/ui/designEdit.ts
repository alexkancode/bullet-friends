import type { EnemyDesign, GameDesign, LevelDesign } from '@bullet/core'
import type { GearItem } from '@bullet/core'
import { sanitizeDesign, DESIGN_LIMITS } from '@bullet/core'

export function updateEnemy(design: GameDesign, enemyId: string, changes: Partial<EnemyDesign>): GameDesign | undefined {
  if (!design.enemies.some(e => e.id === enemyId)) return undefined
  return sanitizeDesign({
    ...design,
    enemies: design.enemies.map(enemy => (enemy.id === enemyId ? { ...enemy, ...changes, id: enemy.id } : enemy))
  })
}

export function updateGear(design: GameDesign, gearId: string, changes: Partial<GearItem>): GameDesign | undefined {
  if (!design.gear.some(g => g.id === gearId)) return undefined
  return sanitizeDesign({
    ...design,
    gear: design.gear.map(item => (item.id === gearId ? { ...item, ...changes, id: item.id } : item))
  })
}

export function addEnemy(design: GameDesign): GameDesign | undefined {
  if (design.enemies.length >= DESIGN_LIMITS.maxEnemies) return undefined
  const id = freshId('enemy', design.enemies.map(e => e.id))
  const template: EnemyDesign = {
    id,
    name: 'New Enemy',
    baseHp: 20,
    speed: 100,
    radius: 24,
    touchDamagePerSecond: 15,
    xpValue: 4,
    weight: 40,
    art: 'art/blob.svg'
  }
  return sanitizeDesign({ ...design, enemies: [...design.enemies, template] })
}

export function addGear(design: GameDesign): GameDesign | undefined {
  if (design.gear.length >= DESIGN_LIMITS.maxGear) return undefined
  const id = freshId('gear', design.gear.map(g => g.id))
  const template: GearItem = {
    id,
    name: 'New Gear',
    slot: 'hat',
    art: 'art/gear/top-hat.svg',
    modifiers: [{ stat: 'damage', mult: 1.1 }]
  }
  return sanitizeDesign({ ...design, gear: [...design.gear, template] })
}

export function addLevel(design: GameDesign): GameDesign | undefined {
  if (design.levels.length >= DESIGN_LIMITS.maxLevels) return undefined
  const last = design.levels[design.levels.length - 1]
  if (!last) return undefined
  return sanitizeDesign({ ...design, levels: [...design.levels, { ...last, enemyIds: [...last.enemyIds] }] })
}

export function updateLevel(design: GameDesign, index: number, changes: Partial<LevelDesign>): GameDesign | undefined {
  if (index < 0 || index >= design.levels.length) return undefined
  return sanitizeDesign({
    ...design,
    levels: design.levels.map((level, i) => (i === index ? { ...level, ...changes } : level))
  })
}

export function removeLevel(design: GameDesign, index: number): GameDesign | undefined {
  if (design.levels.length <= 1 || index < 0 || index >= design.levels.length) return undefined
  return sanitizeDesign({ ...design, levels: design.levels.filter((_, i) => i !== index) })
}

function freshId(prefix: string, taken: string[]): string {
  let counter = 1
  while (taken.includes(`${prefix}-${counter}`)) counter += 1
  return `${prefix}-${counter}`
}
