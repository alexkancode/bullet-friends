import { describe, expect, it } from 'vitest'
import { addPlayer, createGameState, spawnEnemy, startRun, ARENA, TICK_MS } from '@bullet/core'
import { botInputs } from '../src/attract/bots.js'
import { DemoLoop } from '../src/attract/demo.js'

describe('botInputs', () => {
  it('flees a nearby enemy', () => {
    const state = createGameState()
    const bot = addPlayer(state, 'b1', 'Spud')
    startRun(state)
    bot.pos = { x: 800, y: 450 }
    spawnEnemy(state, 'blob', { x: 860, y: 450 })
    const move = botInputs(state)['b1']!.move
    expect(move.x).toBeLessThan(0)
  })

  it('drifts toward an orb when no enemy threatens', () => {
    const state = createGameState()
    const bot = addPlayer(state, 'b1', 'Spud')
    startRun(state)
    bot.pos = { x: 400, y: 450 }
    state.orbs.push({ id: 1, pos: { x: 700, y: 450 }, xp: 3 })
    const move = botInputs(state)['b1']!.move
    expect(move.x).toBeGreaterThan(0)
  })

  it('gives no input for downed bots', () => {
    const state = createGameState()
    const bot = addPlayer(state, 'b1', 'Spud')
    startRun(state)
    bot.alive = false
    expect(botInputs(state)['b1']).toBeUndefined()
  })
})

describe('DemoLoop', () => {
  it('starts fighting immediately with three bots inside the arena', () => {
    const demo = new DemoLoop(7)
    const state = demo.advance(0)
    expect(state.phase).toBe('fighting')
    expect(state.players.length).toBe(3)
    for (const bot of state.players) {
      expect(bot.pos.x).toBeGreaterThan(0)
      expect(bot.pos.x).toBeLessThan(ARENA.width)
    }
  })

  it('accumulates partial frame deltas into whole ticks', () => {
    const demo = new DemoLoop(7)
    const before = demo.advance(0).tick
    demo.advance(TICK_MS / 2)
    expect(demo.advance(0).tick).toBe(before)
    demo.advance(TICK_MS / 2)
    expect(demo.advance(0).tick).toBe(before + 1)
  })

  it('plays through shopping on its own', () => {
    const demo = new DemoLoop(7)
    let sawShopping = false
    let sawCountdown = false
    for (let i = 0; i < 60_000 / TICK_MS; i++) {
      const state = demo.advance(TICK_MS)
      if (state.phase === 'shopping') sawShopping = true
      if (state.phase === 'countdown') sawCountdown = true
      if (state.wave >= 2) break
    }
    expect(sawCountdown).toBe(true)
    expect(sawShopping).toBe(false)
  })

  it('restarts a fresh run after the bots fall', () => {
    const demo = new DemoLoop(7)
    let state = demo.advance(0)
    for (const bot of state.players) {
      bot.hp = 0
      bot.alive = false
    }
    state = demo.advance(TICK_MS)
    expect(state.phase).toBe('runOver')
    for (let i = 0; i < 5000 / TICK_MS; i++) state = demo.advance(TICK_MS)
    expect(state.phase).toBe('fighting')
    expect(state.wave).toBe(1)
    expect(state.players.every(p => p.alive)).toBe(true)
  })

  it('is deterministic for a given seed (canary)', () => {
    const a = new DemoLoop(11)
    const b = new DemoLoop(11)
    for (let i = 0; i < 400; i++) {
      a.advance(TICK_MS)
      b.advance(TICK_MS)
    }
    expect(JSON.stringify(a.advance(0))).toBe(JSON.stringify(b.advance(0)))
  })
})
