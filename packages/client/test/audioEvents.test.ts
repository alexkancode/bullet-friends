import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { GameState } from '@bullet/core'
import { addPlayer, createGameState, spawnEnemy, startRun } from '@bullet/core'
import { detectAudioEvents, musicForPhase, SOUND_FILES } from '../src/audio/events.js'

function fighting(): GameState {
  const state = createGameState()
  addPlayer(state, 'p1', 'Alex')
  addPlayer(state, 'p2', 'Sam')
  startRun(state)
  return state
}

function clone(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState
}

describe('detectAudioEvents', () => {
  it('is quiet with no prior state or no changes', () => {
    const state = fighting()
    expect(detectAudioEvents(undefined, state, 'p1')).toEqual([])
    expect(detectAudioEvents(clone(state), state, 'p1')).toEqual([])
  })

  it('hears a new projectile as a shot', () => {
    const prev = fighting()
    const next = clone(prev)
    next.projectiles.push({ id: 99, ownerId: 'p1', pos: { x: 0, y: 0 }, vel: { x: 1, y: 0 }, damage: 5, ttlMs: 1000 })
    expect(detectAudioEvents(prev, next, 'p1')).toContain('shoot')
  })

  it('hears enemy damage and enemy deaths separately', () => {
    const prev = fighting()
    spawnEnemy(prev, 'blob', { x: 100, y: 100 })
    spawnEnemy(prev, 'blob', { x: 200, y: 200 })
    const next = clone(prev)
    next.enemies[0]!.hp -= 5
    next.enemies.splice(1, 1)
    const events = detectAudioEvents(prev, next, 'p1')
    expect(events).toContain('enemyHit')
    expect(events).toContain('enemyDown')
  })

  it('does not mourn enemies cleared by a wave transition', () => {
    const prev = fighting()
    spawnEnemy(prev, 'blob', { x: 100, y: 100 })
    const next = clone(prev)
    next.enemies = []
    next.phase = 'shopping'
    const events = detectAudioEvents(prev, next, 'p1')
    expect(events).not.toContain('enemyDown')
    expect(events).toContain('shopOpen')
  })

  it('hears orb pickups during a fight but not the end-of-wave sweep', () => {
    const prev = fighting()
    prev.orbs.push({ id: 5, pos: { x: 0, y: 0 }, xp: 3 })
    const collected = clone(prev)
    collected.orbs = []
    expect(detectAudioEvents(prev, collected, 'p1')).toContain('orb')
    const swept = clone(prev)
    swept.orbs = []
    swept.phase = 'shopping'
    expect(detectAudioEvents(prev, swept, 'p1')).not.toContain('orb')
  })

  it('celebrates only the local player leveling up', () => {
    const prev = fighting()
    const mine = clone(prev)
    mine.players[0]!.level = 2
    expect(detectAudioEvents(prev, mine, 'p1')).toContain('levelUp')
    expect(detectAudioEvents(prev, mine, 'p2')).not.toContain('levelUp')
  })

  it('hears a player going down and the run ending', () => {
    const prev = fighting()
    const down = clone(prev)
    down.players[1]!.alive = false
    expect(detectAudioEvents(prev, down, 'p1')).toContain('playerDown')
    const over = clone(down)
    over.phase = 'runOver'
    expect(detectAudioEvents(down, over, 'p1')).toContain('runOver')
  })

  it('ticks once per countdown second and announces the wave start', () => {
    const prev = fighting()
    prev.phase = 'countdown'
    prev.countdownMsLeft = 2050
    const tick = clone(prev)
    tick.countdownMsLeft = 1950
    expect(detectAudioEvents(prev, tick, 'p1')).toContain('countdownTick')
    const sameSecond = clone(tick)
    sameSecond.countdownMsLeft = 1900
    expect(detectAudioEvents(tick, sameSecond, 'p1')).not.toContain('countdownTick')
    const started = clone(sameSecond)
    started.phase = 'fighting'
    expect(detectAudioEvents(sameSecond, started, 'p1')).toContain('waveStart')
  })
})

describe('musicForPhase', () => {
  it('maps every phase to a track', () => {
    expect(musicForPhase('fighting')).toBe('music-battle')
    expect(musicForPhase('countdown')).toBe('music-battle')
    expect(musicForPhase('lobby')).toBe('music-calm')
    expect(musicForPhase('shopping')).toBe('music-calm')
    expect(musicForPhase('runOver')).toBe('music-calm')
  })
})

describe('audio assets', () => {
  it('ships a valid wav for every declared sound (canary)', () => {
    for (const [name, file] of Object.entries(SOUND_FILES)) {
      const path = fileURLToPath(new URL(`../public/${file}`, import.meta.url))
      const bytes = readFileSync(path)
      expect(bytes.length, `${name} at ${file}`).toBeGreaterThan(1000)
      expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF')
      expect(bytes.subarray(8, 12).toString('ascii')).toBe('WAVE')
    }
  })
})
