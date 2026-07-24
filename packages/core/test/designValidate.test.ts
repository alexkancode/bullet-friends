import { describe, expect, it } from 'vitest'
import { defaultDesign, sanitizeDesign, DESIGN_LIMITS } from '@bullet/core'

describe('sanitizeDesign', () => {
  it('passes the default design through unchanged', () => {
    const design = defaultDesign()
    expect(sanitizeDesign(design)).toEqual(design)
  })

  it('rejects structural garbage', () => {
    expect(sanitizeDesign(undefined)).toBeUndefined()
    expect(sanitizeDesign('nope')).toBeUndefined()
    expect(sanitizeDesign({})).toBeUndefined()
    expect(sanitizeDesign({ name: 'x', enemies: [], gear: [], levels: [] })).toBeUndefined()
  })

  it('clamps out-of-range stats instead of trusting them', () => {
    const design = defaultDesign()
    design.enemies[0]!.baseHp = 999999
    design.enemies[0]!.speed = -50
    const clean = sanitizeDesign(design)!
    expect(clean.enemies[0]!.baseHp).toBeLessThanOrEqual(DESIGN_LIMITS.maxHp)
    expect(clean.enemies[0]!.speed).toBeGreaterThanOrEqual(DESIGN_LIMITS.minSpeed)
  })

  it('rejects art that is neither bundled nor a small data image', () => {
    const design = defaultDesign()
    design.enemies[0]!.art = 'https://evil.example/sprite.svg'
    expect(sanitizeDesign(design)).toBeUndefined()
    const design2 = defaultDesign()
    design2.enemies[0]!.art = `data:image/png;base64,${'A'.repeat(DESIGN_LIMITS.maxArtLength + 10)}`
    expect(sanitizeDesign(design2)).toBeUndefined()
    const design3 = defaultDesign()
    design3.enemies[0]!.art = 'data:image/png;base64,iVBORw0KGgo='
    expect(sanitizeDesign(design3)).toBeDefined()
  })

  it('enforces entry caps and level enemy references', () => {
    const design = defaultDesign()
    design.levels = Array.from({ length: DESIGN_LIMITS.maxLevels + 5 }, () => ({ durationMs: 10000, spawnIntervalMs: 500, enemyIds: ['blob'] }))
    expect(sanitizeDesign(design)?.levels.length).toBe(DESIGN_LIMITS.maxLevels)
    const dangling = defaultDesign()
    dangling.levels[0]!.enemyIds = ['ghost-enemy']
    expect(sanitizeDesign(dangling)).toBeUndefined()
  })

  it('drops duplicate ids', () => {
    const design = defaultDesign()
    design.enemies.push({ ...design.enemies[0]! })
    expect(sanitizeDesign(design)).toBeUndefined()
  })
})
