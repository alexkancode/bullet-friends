import type { StatKey } from '@bullet/core'

export const STAT_LABELS: Record<StatKey, string> = {
  maxHp: 'Max HP',
  damage: 'Damage',
  fireRateMs: 'Attack Speed',
  moveSpeed: 'Move Speed',
  pickupRadius: 'Pickup Range'
}

export const STAT_ORDER: StatKey[] = ['maxHp', 'damage', 'fireRateMs', 'moveSpeed', 'pickupRadius']
