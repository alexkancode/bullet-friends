export type EnemyKind = 'blob' | 'sprinter' | 'brute'

export interface EnemySpec {
  baseHp: number
  speed: number
  radius: number
  touchDamagePerSecond: number
  xpValue: number
  fromWave: number
  weight: number
}

export const ENEMY_SPECS: Record<EnemyKind, EnemySpec> = {
  blob: { baseHp: 20, speed: 90, radius: 26, touchDamagePerSecond: 20, xpValue: 3, fromWave: 1, weight: 60 },
  sprinter: { baseHp: 10, speed: 180, radius: 20, touchDamagePerSecond: 12, xpValue: 4, fromWave: 2, weight: 25 },
  brute: { baseHp: 80, speed: 55, radius: 44, touchDamagePerSecond: 40, xpValue: 10, fromWave: 4, weight: 15 }
}

export function scaledEnemyHp(baseHp: number, wave: number): number {
  return Math.round(baseHp * (1 + 0.2 * (wave - 1)))
}

export function enemyHpForWave(kind: EnemyKind, wave: number): number {
  return scaledEnemyHp(ENEMY_SPECS[kind].baseHp, wave)
}
