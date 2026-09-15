import { describe, expect, it } from 'vitest'
import { addPlayer, computeStats, createGameState, createRng, pickGear, rollOffers, startRun, GEAR_CATALOG, GEAR_SLOTS, BASE_STATS } from '@bullet/core'

describe('gear', () => {
  it('has a catalog where every item renders on a bubble anchor', () => {
    expect(GEAR_CATALOG.length).toBeGreaterThanOrEqual(6)
    for (const item of GEAR_CATALOG) {
      expect(GEAR_SLOTS).toContain(item.slot)
      expect(item.art.length).toBeGreaterThan(0)
    }
  })

  it('offers three hand-held items on the hand slot', () => {
    expect(GEAR_SLOTS).toContain('hand')
    const hands = GEAR_CATALOG.filter(g => g.slot === 'hand').map(g => g.id)
    expect(hands).toEqual(['wooden-sword', 'slingshot', 'torch'])
  })

  it('places the mustache on the nose and the pipe on the mouth', () => {
    expect(GEAR_CATALOG.find(g => g.id === 'mustache')?.slot).toBe('nose')
    expect(GEAR_CATALOG.find(g => g.id === 'pipe')?.slot).toBe('mouth')
  })

  it('rolls three distinct offers from the whole catalog', () => {
    const offers = rollOffers(createRng(3))
    expect(offers.length).toBe(3)
    expect(new Set(offers).size).toBe(3)
  })

  it('can offer an item the player already owns', () => {
    const seen = new Set<string>()
    for (let seed = 0; seed < 40; seed++) rollOffers(createRng(seed)).forEach(id => seen.add(id))
    expect(seen.has(GEAR_CATALOG[0]!.id)).toBe(true)
  })

  it('stacks copies of the same item', () => {
    expect(computeStats(1, ['top-hat', 'top-hat']).maxHp).toBe(BASE_STATS.maxHp + 50)
    const once = computeStats(1, ['laser-glasses']).damage
    const twice = computeStats(1, ['laser-glasses', 'laser-glasses']).damage
    expect(twice / once).toBeCloseTo(1.3, 5)
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
