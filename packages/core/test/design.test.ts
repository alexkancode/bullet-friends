import { describe, expect, it } from 'vitest'
import type { GameDesign } from '@bullet/core'
import {
  addPlayer,
  createGameState,
  createRng,
  defaultDesign,
  designEnemy,
  levelForWave,
  pickGear,
  startRun,
  step,
  ENEMY_SPECS,
  GEAR_CATALOG,
  TICK_MS
} from '@bullet/core'

function customDesign(): GameDesign {
  return {
    name: 'Lava World',
    enemies: [
      { id: 'magma', name: 'Magma Blob', baseHp: 6, speed: 120, radius: 20, touchDamagePerSecond: 15, xpValue: 5, weight: 100, art: 'data:image/png;base64,AAAA' }
    ],
    gear: [
      { id: 'lava-crown', name: 'Lava Crown', slot: 'hat', art: 'data:image/png;base64,BBBB', modifiers: [{ stat: 'damage', mult: 1.5 }] }
    ],
    levels: [
      { durationMs: 5000, spawnIntervalMs: 400, enemyIds: ['magma'] },
      { durationMs: 6000, spawnIntervalMs: 300, enemyIds: ['magma'] }
    ]
  }
}

const noInput = { p1: { move: { x: 0, y: 0 } } }

describe('defaultDesign', () => {
  it('mirrors the legacy enemy and gear tables', () => {
    const design = defaultDesign()
    expect(design.enemies.map(e => e.id).sort()).toEqual(Object.keys(ENEMY_SPECS).sort())
    expect(design.gear).toEqual(GEAR_CATALOG)
    expect(design.levels.length).toBeGreaterThanOrEqual(4)
    expect(design.levels[0]?.enemyIds).toEqual(['blob'])
  })

  it('repeats the last level for endless runs', () => {
    const design = customDesign()
    expect(levelForWave(design, 1)).toBe(design.levels[0])
    expect(levelForWave(design, 2)).toBe(design.levels[1])
    expect(levelForWave(design, 9)).toBe(design.levels[1])
  })
})

describe('running a custom design', () => {
  it('spawns only the designed enemies at the designed rate and duration', () => {
    const design = customDesign()
    const state = createGameState()
    addPlayer(state, 'p1', 'Alex')
    startRun(state, design)
    expect(state.waveMsLeft).toBe(5000)
    for (let i = 0; i < 3000 / TICK_MS; i++) step(state, noInput, createRng(1), design)
    expect(state.enemies.length).toBeGreaterThan(0)
    expect(new Set(state.enemies.map(e => e.kind))).toEqual(new Set(['magma']))
    const magma = designEnemy(design, 'magma')!
    expect(state.enemies[0]!.speed).toBe(magma.speed)
  })

  it('offers and applies only the designed gear', () => {
    const design = customDesign()
    const state = createGameState()
    const player = addPlayer(state, 'p1', 'Alex')
    startRun(state, design)
    state.waveMsLeft = TICK_MS
    state.enemies = []
    step(state, noInput, createRng(1), design)
    expect(state.phase).toBe('shopping')
    expect(state.pendingOffers['p1']).toEqual(['lava-crown'])
    const damageBefore = player.stats.damage
    pickGear(state, 'p1', 'lava-crown', design)
    expect(player.stats.damage).toBeCloseTo(damageBefore * 1.5)
    expect(state.phase).toBe('countdown')
  })

  it('keeps the classic game byte-identical under the default argument', () => {
    const withDefault = createGameState()
    addPlayer(withDefault, 'p1', 'Alex')
    startRun(withDefault)
    const explicit = createGameState()
    addPlayer(explicit, 'p1', 'Alex')
    startRun(explicit, defaultDesign())
    for (let i = 0; i < 100; i++) {
      step(withDefault, noInput, createRng(1))
      step(explicit, noInput, createRng(1), defaultDesign())
    }
    expect(JSON.stringify(withDefault)).toBe(JSON.stringify(explicit))
  })
})
