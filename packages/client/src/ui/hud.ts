import type { GameState, PlayerState } from '@bullet/core'
import { waveDurationMs, xpToNextLevel } from '@bullet/core'

export interface HudElements {
  wave: HTMLElement
  timerFill: HTMLElement
  hpFill: HTMLElement
  hpLabel: HTMLElement
  xpFill: HTMLElement
  levelLabel: HTMLElement
}

export function updateHud(elements: HudElements, state: GameState, self: PlayerState | undefined): void {
  elements.wave.textContent = `Wave ${state.wave}`
  const duration = waveDurationMs(Math.max(state.wave, 1))
  elements.timerFill.style.setProperty('--fill', `${(state.waveMsLeft / duration) * 100}%`)
  if (!self) return
  elements.hpFill.style.setProperty('--fill', `${(self.hp / self.stats.maxHp) * 100}%`)
  elements.hpLabel.textContent = `${Math.ceil(self.hp)} / ${self.stats.maxHp}`
  elements.xpFill.style.setProperty('--fill', `${(self.xp / xpToNextLevel(self.level)) * 100}%`)
  elements.levelLabel.textContent = `Lv ${self.level}`
}
