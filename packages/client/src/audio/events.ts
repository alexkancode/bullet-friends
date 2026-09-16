import type { GameState, Phase } from '@bullet/core'

export type AudioEventName =
  | 'shoot'
  | 'enemyHit'
  | 'enemyDown'
  | 'orb'
  | 'levelUp'
  | 'playerDown'
  | 'shopOpen'
  | 'gearPick'
  | 'countdownTick'
  | 'waveStart'
  | 'runOver'

export type MusicTrack = 'music-battle' | 'music-calm'

export const SOUND_FILES: Record<AudioEventName | MusicTrack, string> = {
  shoot: 'audio/shoot.wav',
  enemyHit: 'audio/enemy-hit.wav',
  enemyDown: 'audio/enemy-down.wav',
  orb: 'audio/orb.wav',
  levelUp: 'audio/level-up.wav',
  playerDown: 'audio/player-down.wav',
  shopOpen: 'audio/shop-open.wav',
  gearPick: 'audio/gear-pick.wav',
  countdownTick: 'audio/countdown-tick.wav',
  waveStart: 'audio/wave-start.wav',
  runOver: 'audio/run-over.wav',
  'music-battle': 'audio/music-battle.wav',
  'music-calm': 'audio/music-calm.wav'
}

export function musicForPhase(phase: Phase): MusicTrack {
  return phase === 'fighting' || phase === 'countdown' ? 'music-battle' : 'music-calm'
}

export function detectAudioEvents(prev: GameState | undefined, next: GameState, selfId: string | undefined): AudioEventName[] {
  if (!prev) return []
  const events: AudioEventName[] = []
  const stillFighting = prev.phase === 'fighting' && next.phase === 'fighting'

  const priorProjectiles = new Set(prev.projectiles.map(proj => proj.id))
  if (next.projectiles.some(proj => !priorProjectiles.has(proj.id))) events.push('shoot')

  if (stillFighting) {
    const survivors = new Map(next.enemies.map(e => [e.id, e]))
    let hit = false
    let down = false
    for (const enemy of prev.enemies) {
      const now = survivors.get(enemy.id)
      if (!now) down = true
      else if (now.hp < enemy.hp) hit = true
    }
    if (hit) events.push('enemyHit')
    if (down) events.push('enemyDown')
    const remainingOrbs = new Set(next.orbs.map(orb => orb.id))
    if (prev.orbs.some(orb => !remainingOrbs.has(orb.id))) events.push('orb')
  }

  const selfPrev = prev.players.find(p => p.id === selfId)
  const selfNext = next.players.find(p => p.id === selfId)
  if (selfPrev && selfNext && selfNext.level > selfPrev.level) events.push('levelUp')

  for (const player of prev.players) {
    const now = next.players.find(p => p.id === player.id)
    if (now && player.alive && !now.alive) {
      events.push('playerDown')
      break
    }
  }

  if (prev.phase !== 'shopping' && next.phase === 'shopping') events.push('shopOpen')
  if (prev.phase !== 'fighting' && next.phase === 'fighting' && next.wave > 0) events.push('waveStart')
  if (prev.phase !== 'runOver' && next.phase === 'runOver') events.push('runOver')

  if (next.phase === 'countdown' && prev.phase === 'countdown') {
    if (Math.ceil(prev.countdownMsLeft / 1000) !== Math.ceil(next.countdownMsLeft / 1000)) events.push('countdownTick')
  }

  return events
}
