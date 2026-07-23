import { describe, expect, it } from 'vitest'
import { addPlayer, computeStats, createGameState, createRng, pickGear, rollOffers, startRun, GEAR_CATALOG, BASE_STATS } from '@bullet/core'

describe('gear', () => {
  it('has a catalog where every item renders on a bubble anchor', () => {
    expect(GEAR_CATALOG.length).toBeGreaterThanOrEqual(6)
    for (const item of GEAR_CATALOG) {
      expect(['hat', 'eyes', 'mouth']).toContain(item.slot)
      expect(item.art.length).toBeGreaterThan(0)
    }
  })

  it('rolls three distinct offers excluding owned gear', () => {
    const owned = [GEAR_CATALOG[0]!.id]
    const offers = rollOffers(createRng(3), owned)
    expect(offers.length).toBe(3)
    expect(new Set(offers).size).toBe(3)
    expect(offers).not.toContain(owned[0])
  })

  it('applies multiplicative and flat modifiers to stats', () => {
    const item = GEAR_CATALOG.find(g => g.id === 'laser-glasses')!
    const stats = computeStats(1, [item.id])
    expect(stats.damage).toBeGreaterThan(BASE_STATS.damage)
  })

  it('stacks gear from multiple items', () => {
    const one = computeStats(1, ['laser-glasses'])
    const two = computeStats(1, ['laser-glasses', 'viking-helm'])
    expect(two.damage).toBeGreaterThan(one.damage)
  })

  it('picking offered gear equips it, recomputes stats, and starts the next wave when everyone picked', () => {
    const state = createGameState()
    const p = addPlayer(state, 'p1', 'Alex')
    startRun(state)
    state.phase = 'shopping'
    state.pendingOffers = { p1: ['laser-glasses', 'top-hat', 'monocle'] }
    pickGear(state, 'p1', 'top-hat')
    expect(p.gear).toContain('top-hat')
    expect(p.stats.maxHp).toBeGreaterThan(BASE_STATS.maxHp)
    expect(state.phase).toBe('countdown')
  })

  it('rejects picking gear that was not offered', () => {
    const state = createGameState()
    const p = addPlayer(state, 'p1', 'Alex')
    startRun(state)
    state.phase = 'shopping'
    state.pendingOffers = { p1: ['top-hat'] }
    pickGear(state, 'p1', 'laser-glasses')
    expect(p.gear).not.toContain('laser-glasses')
    expect(state.phase).toBe('shopping')
  })
})
