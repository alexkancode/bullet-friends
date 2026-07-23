import { describe, expect, it } from 'vitest'
import { addPlayer, createGameState, createRng, startRun, step, ARENA, PLAYER_RADIUS, TICK_MS } from '@bullet/core'

describe('movement', () => {
  it('moves a player by moveSpeed over one tick', () => {
    const state = createGameState()
    const p = addPlayer(state, 'p1', 'Alex')
    startRun(state)
    const startX = p.pos.x
    step(state, { p1: { move: { x: 1, y: 0 } } }, createRng(1))
    expect(p.pos.x).toBeCloseTo(startX + p.stats.moveSpeed * (TICK_MS / 1000))
  })

  it('normalizes diagonal input so it is not faster', () => {
    const state = createGameState()
    const p = addPlayer(state, 'p1', 'Alex')
    startRun(state)
    const start = { ...p.pos }
    step(state, { p1: { move: { x: 1, y: 1 } } }, createRng(1))
    const moved = Math.hypot(p.pos.x - start.x, p.pos.y - start.y)
    expect(moved).toBeCloseTo(p.stats.moveSpeed * (TICK_MS / 1000), 5)
  })

  it('never leaves the arena', () => {
    const state = createGameState()
    const p = addPlayer(state, 'p1', 'Alex')
    startRun(state)
    p.pos = { x: PLAYER_RADIUS + 1, y: PLAYER_RADIUS + 1 }
    for (let i = 0; i < 100; i++) step(state, { p1: { move: { x: -1, y: -1 } } }, createRng(1))
    expect(p.pos.x).toBe(PLAYER_RADIUS)
    expect(p.pos.y).toBe(PLAYER_RADIUS)
    expect(p.pos.x).toBeGreaterThanOrEqual(0)
  })

  it('ignores input from downed players', () => {
    const state = createGameState()
    const p = addPlayer(state, 'p1', 'Alex')
    startRun(state)
    p.alive = false
    const start = { ...p.pos }
    step(state, { p1: { move: { x: 1, y: 0 } } }, createRng(1))
    expect(p.pos).toEqual(start)
  })

  it('keeps arena dimensions sane', () => {
    expect(ARENA.width).toBeGreaterThan(ARENA.height)
  })
})
