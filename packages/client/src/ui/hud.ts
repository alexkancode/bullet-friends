import type { GameDesign, GameState, PlayerState } from '@bullet/core'
import { defaultDesign, levelForWave, xpToNextLevel } from '@bullet/core'

export interface HudElements {
  wave: HTMLElement
  timerFill: HTMLElement
  hpFill: HTMLElement
  hpLabel: HTMLElement
  xpFill: HTMLElement
  levelLabel: HTMLElement
}

export function updateHud(elements: HudElements, state: GameState, self: PlayerState | undefined, design: GameDesign = defaultDesign()): void {
  elements.wave.textContent = `Wave ${state.wave}`
  const duration = levelForWave(design, Math.max(state.wave, 1)).durationMs
  elements.timerFill.style.setProperty('--fill', `${(state.waveMsLeft / duration) * 100}%`)
  if (!self) return
  elements.hpFill.style.setProperty('--fill', `${(self.hp / self.stats.maxHp) * 100}%`)
  elements.hpLabel.textContent = `${Math.ceil(self.hp)} / ${self.stats.maxHp}`
  elements.xpFill.style.setProperty('--fill', `${(self.xp / xpToNextLevel(self.level)) * 100}%`)
  elements.levelLabel.textContent = `Lv ${self.level}`
}
