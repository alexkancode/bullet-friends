import { describe, expect, it } from 'vitest'
import { addPlayer, createGameState, spawnEnemy } from '@bullet/core'
import { SnapshotBuffer } from '../src/net/interpolation.js'

function snapshotWithPlayerX(x: number) {
  const state = createGameState()
  const p = addPlayer(state, 'p1', 'Alex')
  p.pos = { x, y: 450 }
  return state
}

describe('SnapshotBuffer', () => {
  it('interpolates player positions between two snapshots', () => {
    const buffer = new SnapshotBuffer(100)
    buffer.push(1000, snapshotWithPlayerX(0))
    buffer.push(1100, snapshotWithPlayerX(100))
    const sampled = buffer.sample(1150)
    expect(sampled?.players[0]?.pos.x).toBeCloseTo(50)
  })

  it('returns the earliest snapshot before the buffer starts', () => {
    const buffer = new SnapshotBuffer(100)
    buffer.push(1000, snapshotWithPlayerX(30))
    buffer.push(1100, snapshotWithPlayerX(100))
    const sampled = buffer.sample(1050)
    expect(sampled?.players[0]?.pos.x).toBe(30)
  })

  it('returns the newest snapshot when render time passes the buffer end', () => {
    const buffer = new SnapshotBuffer(100)
    buffer.push(1000, snapshotWithPlayerX(0))
    buffer.push(1100, snapshotWithPlayerX(100))
    const sampled = buffer.sample(5000)
    expect(sampled?.players[0]?.pos.x).toBe(100)
  })

  it('keeps entities that only exist in the newer snapshot', () => {
    const buffer = new SnapshotBuffer(100)
    const older = snapshotWithPlayerX(0)
    const newer = snapshotWithPlayerX(100)
    spawnEnemy(newer, 'blob', { x: 500, y: 500 })
    buffer.push(1000, older)
    buffer.push(1100, newer)
    const sampled = buffer.sample(1150)
    expect(sampled?.enemies.length).toBe(1)
    expect(sampled?.enemies[0]?.pos).toEqual({ x: 500, y: 500 })
  })

  it('takes discrete fields from the newer snapshot', () => {
    const buffer = new SnapshotBuffer(100)
    const older = snapshotWithPlayerX(0)
    const newer = snapshotWithPlayerX(100)
    newer.phase = 'shopping'
    newer.players[0]!.hp = 60
    buffer.push(1000, older)
    buffer.push(1100, newer)
    const sampled = buffer.sample(1150)
    expect(sampled?.phase).toBe('shopping')
    expect(sampled?.players[0]?.hp).toBe(60)
  })

  it('is empty until pushed and discards old snapshots beyond capacity', () => {
    const buffer = new SnapshotBuffer(100, 3)
    expect(buffer.sample(1000)).toBeUndefined()
    for (let i = 0; i < 10; i++) buffer.push(1000 + i * 50, snapshotWithPlayerX(i))
    expect(buffer.size()).toBe(3)
  })
})
