import type { GameState } from '@bullet/core'
import type { RunRecord } from './store.js'

export function buildRunRecord(state: GameState, endedAt: number): RunRecord {
  return {
    endedAt,
    wave: state.wave,
    players: state.players.map(player => ({
      name: player.name,
      level: player.level,
      kills: total(player.history, 'kills'),
      damageDealt: total(player.history, 'damageDealt'),
      damageTaken: total(player.history, 'damageTaken'),
      xpGained: total(player.history, 'xpGained')
    }))
  }
}

function total(history: GameState['players'][number]['history'], key: keyof GameState['players'][number]['history'][number]): number {
  return history.reduce((sum, entry) => sum + entry[key], 0)
}
