import type { Rng } from './rng.js'

export type StatKey = 'maxHp' | 'damage' | 'fireRateMs' | 'moveSpeed' | 'pickupRadius'

export type GearSlot = 'hat' | 'eyes' | 'nose' | 'mouth'

export interface GearModifier {
  stat: StatKey
  mult?: number
  flat?: number
}

export interface GearItem {
  id: string
  name: string
  slot: GearSlot
  art: string
  modifiers: GearModifier[]
}

export const GEAR_CATALOG: GearItem[] = [
  { id: 'top-hat', name: 'Top Hat', slot: 'hat', art: 'art/gear/top-hat.svg', modifiers: [{ stat: 'maxHp', flat: 25 }] },
  { id: 'viking-helm', name: 'Viking Helm', slot: 'hat', art: 'art/gear/viking-helm.svg', modifiers: [{ stat: 'maxHp', flat: 10 }, { stat: 'damage', mult: 1.15 }] },
  { id: 'propeller-cap', name: 'Propeller Cap', slot: 'hat', art: 'art/gear/propeller-cap.svg', modifiers: [{ stat: 'moveSpeed', mult: 1.18 }] },
  { id: 'laser-glasses', name: 'Laser Glasses', slot: 'eyes', art: 'art/gear/laser-glasses.svg', modifiers: [{ stat: 'damage', mult: 1.3 }] },
  { id: 'monocle', name: 'Monocle', slot: 'eyes', art: 'art/gear/monocle.svg', modifiers: [{ stat: 'pickupRadius', mult: 1.5 }] },
  { id: 'star-shades', name: 'Star Shades', slot: 'eyes', art: 'art/gear/star-shades.svg', modifiers: [{ stat: 'fireRateMs', mult: 0.85 }] },
  { id: 'pipe', name: 'Bubble Pipe', slot: 'mouth', art: 'art/gear/pipe.svg', modifiers: [{ stat: 'damage', mult: 1.1 }, { stat: 'maxHp', flat: 10 }] },
  { id: 'mustache', name: 'Mustache', slot: 'nose', art: 'art/gear/mustache.svg', modifiers: [{ stat: 'moveSpeed', mult: 1.1 }, { stat: 'fireRateMs', mult: 0.92 }] }
]

export function gearById(id: string): GearItem | undefined {
  return GEAR_CATALOG.find(g => g.id === id)
}

export function rollOffers(rng: Rng, catalog: GearItem[] = GEAR_CATALOG, count = 3): string[] {
  const pool = catalog.map(g => g.id)
  const offers: string[] = []
  while (offers.length < count && pool.length > 0) {
    const index = Math.floor(rng() * pool.length)
    offers.push(...pool.splice(index, 1))
  }
  return offers
}
