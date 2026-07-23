import { describe, expect, it } from 'vitest'
import type { EnemyState, GameState } from '@bullet/core'
import { addPlayer, createGameState, createRng, spawnEnemy, startRun, step, TICK_MS } from '@bullet/core'

function runWithEnemy(atX: number, atY: number): { state: GameState; enemy: EnemyState } {
  const state = createGameState()
  addPlayer(state, 'p1', 'Alex')
  startRun(state)
  state.waveMsLeft = 60000
  const enemy = spawnEnemy(state, 'blob', { x: atX, y: atY })
  return { state, enemy }
}

const noInput = { p1: { move: { x: 0, y: 0 } } }

describe('combat', () => {
  it('auto-fires a projectile at the nearest enemy once the cooldown allows', () => {
    const { state } = runWithEnemy(1200, 450)
    spawnEnemy(state, 'blob', { x: 1500, y: 450 })
    step(state, noInput, createRng(1))
    expect(state.projectiles.length).toBe(1)
    const proj = state.projectiles[0]!
    expect(proj.vel.x).toBeGreaterThan(0)
    expect(Math.abs(proj.vel.y)).toBeLessThan(Math.abs(proj.vel.x))
  })

  it('respects fire cooldown between shots', () => {
    const { state } = runWithEnemy(1200, 450)
    const player = state.players[0]!
    step(state, noInput, createRng(1))
    const afterFirst = state.projectiles.length
    step(state, noInput, createRng(1))
    expect(state.projectiles.length).toBe(afterFirst)
    for (let i = 0; i < Math.ceil(player.stats.fireRateMs / TICK_MS); i++) step(state, noInput, createRng(1))
    expect(state.projectiles.length).toBeGreaterThan(afterFirst)
  })

  it('does not fire with no enemies present', () => {
    const state = createGameState()
    addPlayer(state, 'p1', 'Alex')
    startRun(state)
    state.waveMsLeft = 60000
    state.enemies = []
    step(state, noInput, createRng(1))
    expect(state.projectiles.length).toBe(0)
  })

  it('projectile damages the enemy it hits and is consumed', () => {
    const { state, enemy } = runWithEnemy(1200, 450)
    const player = state.players[0]!
    player.stats.fireRateMs = 60000
    const before = enemy.hp
    for (let i = 0; i < 60 && enemy.hp === before; i++) step(state, noInput, createRng(1))
    expect(enemy.hp).toBe(before - player.stats.damage)
    expect(state.projectiles.length).toBe(0)
  })

  it('killing an enemy drops an xp orb and counts a kill', () => {
    const { state, enemy } = runWithEnemy(900, 450)
    enemy.hp = 1
    const player = state.players[0]!
    player.stats.pickupRadius = 0
    for (let i = 0; i < 120 && state.enemies.length > 0; i++) step(state, noInput, createRng(1))
    expect(state.enemies.length).toBe(0)
    expect(state.orbs.length).toBe(1)
    expect(player.waveStats.kills).toBe(1)
  })

  it('enemies chase the nearest player and deal contact damage over time', () => {
    const { state, enemy } = runWithEnemy(1400, 450)
    const player = state.players[0]!
    player.stats.damage = 0
    const gapBefore = enemy.pos.x - player.pos.x
    step(state, noInput, createRng(1))
    expect(enemy.pos.x - player.pos.x).toBeLessThan(gapBefore)
    enemy.pos = { ...player.pos }
    const hpBefore = player.hp
    step(state, noInput, createRng(1))
    expect(player.hp).toBeCloseTo(hpBefore - enemy.touchDamage * (TICK_MS / 1000))
    expect(player.waveStats.damageTaken).toBeGreaterThan(0)
  })

  it('downs a player at zero hp and ends the run when everyone is down', () => {
    const { state, enemy } = runWithEnemy(800, 450)
    const player = state.players[0]!
    player.stats.damage = 0
    player.hp = 0.01
    enemy.pos = { ...player.pos }
    step(state, noInput, createRng(1))
    expect(player.alive).toBe(false)
    expect(state.phase).toBe('runOver')
  })
})
