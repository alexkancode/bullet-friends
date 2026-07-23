import type { GameState, Inputs } from './state.js'
import { clampToArena, normalize, scale, add } from './geometry.js'
import { PLAYER_RADIUS, TICK_MS } from './constants.js'

export function applyInputs(state: GameState, inputs: Inputs): void {
  const dt = TICK_MS / 1000
  for (const player of state.players) {
    if (!player.alive) continue
    const input = inputs[player.id]
    if (!input) continue
    const direction = normalize(input.move)
    const next = add(player.pos, scale(direction, player.stats.moveSpeed * dt))
    player.pos = clampToArena(next, PLAYER_RADIUS)
  }
}
