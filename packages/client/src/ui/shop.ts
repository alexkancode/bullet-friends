import type { GameState } from '@bullet/core'
import { gearById } from '@bullet/core'
import type { GearModifier } from '@bullet/core'

const STAT_LABELS = {
  maxHp: 'Max HP',
  damage: 'Damage',
  fireRateMs: 'Attack Speed',
  moveSpeed: 'Move Speed',
  pickupRadius: 'Pickup Range'
}

export function describeModifier(mod: GearModifier): string {
  const label = STAT_LABELS[mod.stat]
  if (mod.flat !== undefined) return `+${mod.flat} ${label}`
  if (mod.mult !== undefined) {
    const percent = Math.round(Math.abs(mod.mult - 1) * 100)
    const faster = mod.stat === 'fireRateMs' ? mod.mult < 1 : mod.mult > 1
    return `${faster ? '+' : '-'}${percent}% ${label}`
  }
  return label
}

export function renderShop(
  container: HTMLElement,
  waiting: HTMLElement,
  state: GameState,
  selfId: string | undefined,
  artBase: string,
  onPick: (gearId: string) => void
): void {
  const offer = selfId ? state.pendingOffers[selfId] : undefined
  container.replaceChildren()
  if (!offer) {
    const stillPicking = Object.keys(state.pendingOffers)
      .map(id => state.players.find(p => p.id === id)?.name)
      .filter((name): name is string => Boolean(name))
    waiting.textContent = stillPicking.length > 0 ? `Waiting for ${stillPicking.join(', ')}...` : ''
    waiting.hidden = false
    return
  }
  waiting.hidden = true
  for (const gearId of offer) {
    const item = gearById(gearId)
    if (!item) continue
    const card = document.createElement('button')
    card.className = 'gear-card'
    const img = document.createElement('img')
    img.className = 'gear-card-art'
    img.src = `${artBase}${item.art}`
    img.alt = item.name
    const title = document.createElement('div')
    title.className = 'gear-card-name'
    title.textContent = item.name
    const mods = document.createElement('div')
    mods.className = 'gear-card-mods'
    mods.textContent = item.modifiers.map(describeModifier).join(' · ')
    card.append(img, title, mods)
    card.addEventListener('click', () => onPick(gearId))
    container.append(card)
  }
}
