import type { GameState, Vec } from '@bullet/core'

interface TimedSnapshot {
  at: number
  state: GameState
}

interface Positioned {
  pos: Vec
}

export class SnapshotBuffer {
  private readonly snapshots: TimedSnapshot[] = []

  constructor(
    private readonly delayMs = 100,
    private readonly capacity = 30
  ) {}

  push(at: number, state: GameState): void {
    this.snapshots.push({ at, state })
    while (this.snapshots.length > this.capacity) this.snapshots.shift()
  }

  size(): number {
    return this.snapshots.length
  }

  latest(): GameState | undefined {
    return this.snapshots[this.snapshots.length - 1]?.state
  }

  sample(nowMs: number): GameState | undefined {
    const first = this.snapshots[0]
    const last = this.snapshots[this.snapshots.length - 1]
    if (!first || !last) return undefined
    const renderAt = nowMs - this.delayMs
    if (renderAt <= first.at) return first.state
    if (renderAt >= last.at) return last.state
    let previous = first
    for (const current of this.snapshots) {
      if (renderAt < current.at) {
        const t = (renderAt - previous.at) / (current.at - previous.at)
        return interpolateStates(previous.state, current.state, t)
      }
      previous = current
    }
    return last.state
  }
}

function interpolateStates(older: GameState, newer: GameState, t: number): GameState {
  return {
    ...newer,
    players: lerpAll(older.players, newer.players, t),
    enemies: lerpAll(older.enemies, newer.enemies, t),
    projectiles: lerpAll(older.projectiles, newer.projectiles, t)
  }
}

function lerpAll<T extends Positioned & { id: string | number }>(older: T[], newer: T[], t: number): T[] {
  const previous = new Map(older.map(entity => [entity.id, entity]))
  return newer.map(entity => lerpFrom(previous.get(entity.id), entity, t))
}

function lerpFrom<T extends Positioned>(previous: T | undefined, entity: T, t: number): T {
  if (!previous) return entity
  return {
    ...entity,
    pos: {
      x: previous.pos.x + (entity.pos.x - previous.pos.x) * t,
      y: previous.pos.y + (entity.pos.y - previous.pos.y) * t
    }
  }
}
