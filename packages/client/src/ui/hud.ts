import type { GameDesign, GameState, PlayerState } from '@bullet/core'
import { defaultDesign, levelForWave, xpToNextLevel } from '@bullet/core'
import { buildSummary } from './build.js'
import type { BuildSummary } from './build.js'

export interface HudElements {
  wave: HTMLElement
  timerFill: HTMLElement
  hpFill: HTMLElement
  hpLabel: HTMLElement
  xpFill: HTMLElement
  levelLabel: HTMLElement
  buildItems: HTMLElement
  buildStats: HTMLElement
}

let renderedBuild = ''

export function updateHud(elements: HudElements, state: GameState, self: PlayerState | undefined, design: GameDesign = defaultDesign()): void {
  elements.wave.textContent = `Wave ${state.wave}`
  const duration = levelForWave(design, Math.max(state.wave, 1)).durationMs
  elements.timerFill.style.setProperty('--fill', `${(state.waveMsLeft / duration) * 100}%`)
  if (!self) return
  elements.hpFill.style.setProperty('--fill', `${(self.hp / self.stats.maxHp) * 100}%`)
  elements.hpLabel.textContent = `${Math.ceil(self.hp)} / ${self.stats.maxHp}`
  elements.xpFill.style.setProperty('--fill', `${(self.xp / xpToNextLevel(self.level)) * 100}%`)
  elements.levelLabel.textContent = `Lv ${self.level}`
  renderBuild(elements, buildSummary(self, design))
}

function renderBuild(elements: HudElements, summary: BuildSummary): void {
  const key = JSON.stringify(summary)
  if (key === renderedBuild) return
  renderedBuild = key
  elements.buildItems.replaceChildren(...summary.items.map(item => listItem(item.count > 1 ? `${item.name} x${item.count}` : item.name)))
  elements.buildStats.replaceChildren(...summary.stats.map(stat => listItem(`${stat.label} ${stat.value}${stat.ratio ? ` (${stat.ratio})` : ''}`, stat.ratio !== undefined)))
}

function listItem(text: string, emphasised = false): HTMLLIElement {
  const item = document.createElement('li')
  item.textContent = text
  item.classList.toggle('hud-build-changed', emphasised)
  return item
}
