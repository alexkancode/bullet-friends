export interface WaveStats {
  kills: number
  damageDealt: number
  damageTaken: number
  xpGained: number
}

export function createWaveStats(): WaveStats {
  return { kills: 0, damageDealt: 0, damageTaken: 0, xpGained: 0 }
}
