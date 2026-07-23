import type { GameState, Inputs, Vec } from '@bullet/core'
import { dist, normalize, ARENA } from '@bullet/core'

const FLEE_RADIUS = 260
const CENTER_PULL = 0.25

export function botInputs(state: GameState): Inputs {
  const inputs: Inputs = {}
  for (const bot of state.players) {
    if (!bot.alive) continue
    let x = ((ARENA.width / 2 - bot.pos.x) / (ARENA.width / 2)) * CENTER_PULL
    let y = ((ARENA.height / 2 - bot.pos.y) / (ARENA.height / 2)) * CENTER_PULL
    const threat = nearest(state.enemies.map(e => e.pos), bot.pos)
    if (threat && dist(threat, bot.pos) < FLEE_RADIUS) {
      const away = normalize({ x: bot.pos.x - threat.x, y: bot.pos.y - threat.y })
      x += away.x * 2
      y += away.y * 2
    } else {
      const orb = nearest(state.orbs.map(o => o.pos), bot.pos)
      if (orb) {
        const toward = normalize({ x: orb.x - bot.pos.x, y: orb.y - bot.pos.y })
        x += toward.x
        y += toward.y
      }
    }
    inputs[bot.id] = { move: { x, y } }
  }
  return inputs
}

function nearest(points: Vec[], from: Vec): Vec | undefined {
  let best: Vec | undefined
  let bestDist = Infinity
  for (const point of points) {
    const d = dist(point, from)
    if (d < bestDist) {
      bestDist = d
      best = point
    }
  }
  return best
}
