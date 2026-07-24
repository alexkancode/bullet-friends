import { describe, expect, it } from 'vitest'
import { defaultDesign } from '@bullet/core'
import { addEnemy, addGear, addLevel, removeLevel, updateEnemy, updateGear, updateLevel } from '../src/ui/designEdit.js'

describe('design editing helpers', () => {
  it('updates an enemy immutably and keeps the design valid', () => {
    const original = defaultDesign()
    const edited = updateEnemy(original, 'blob', { baseHp: 55, speed: 200 })!
    expect(edited.enemies.find(e => e.id === 'blob')?.baseHp).toBe(55)
    expect(original.enemies.find(e => e.id === 'blob')?.baseHp).toBe(20)
    expect(updateEnemy(original, 'ghost', { baseHp: 5 })).toBeUndefined()
  })

  it('clamps hostile enemy edits through the sanitizer', () => {
    const edited = updateEnemy(defaultDesign(), 'blob', { baseHp: 999999 })!
    expect(edited.enemies.find(e => e.id === 'blob')?.baseHp).toBe(5000)
  })

  it('adds a new enemy with a unique id and template stats', () => {
    const design = defaultDesign()
    const grown = addEnemy(design)!
    expect(grown.enemies.length).toBe(design.enemies.length + 1)
    const added = grown.enemies[grown.enemies.length - 1]!
    expect(design.enemies.some(e => e.id === added.id)).toBe(false)
    const again = addEnemy(grown)!
    expect(new Set(again.enemies.map(e => e.id)).size).toBe(again.enemies.length)
  })

  it('updates and adds gear', () => {
    const design = defaultDesign()
    const edited = updateGear(design, 'top-hat', { name: 'Big Hat' })!
    expect(edited.gear.find(g => g.id === 'top-hat')?.name).toBe('Big Hat')
    const grown = addGear(design)!
    expect(grown.gear.length).toBe(design.gear.length + 1)
  })

  it('adds, updates, and removes levels while keeping at least one', () => {
    const design = defaultDesign()
    const grown = addLevel(design)!
    expect(grown.levels.length).toBe(design.levels.length + 1)
    expect(grown.levels[grown.levels.length - 1]).toEqual(design.levels[design.levels.length - 1])

    const edited = updateLevel(grown, grown.levels.length - 1, { durationMs: 9000, enemyIds: ['blob'] })!
    expect(edited.levels[edited.levels.length - 1]?.durationMs).toBe(9000)

    const shrunk = removeLevel(edited, 0)!
    expect(shrunk.levels.length).toBe(edited.levels.length - 1)
    let last = shrunk
    while (last.levels.length > 1) last = removeLevel(last, 0)!
    expect(removeLevel(last, 0)).toBeUndefined()
  })

  it('rejects a level referencing a missing enemy', () => {
    expect(updateLevel(defaultDesign(), 0, { enemyIds: ['nope'] })).toBeUndefined()
  })
})
