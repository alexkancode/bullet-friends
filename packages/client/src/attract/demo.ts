import type { GameState, Rng } from '@bullet/core'
import { addPlayer, createGameState, createRng, pickGear, startRun, step, TICK_MS } from '@bullet/core'
import { botInputs } from './bots.js'

const BOT_NAMES = ['Spud', 'Tater', 'Chip']
const RESTART_DELAY_MS = 2500

export class DemoLoop {
  private readonly state: GameState
  private readonly rng: Rng
  private accumulatorMs = 0
  private restartTimerMs = 0

  constructor(seed = 2026) {
    this.rng = createRng(seed)
    this.state = createGameState()
    BOT_NAMES.forEach((name, index) => addPlayer(this.state, `bot-${index}`, name))
    startRun(this.state)
  }

  advance(deltaMs: number): GameState {
    this.accumulatorMs += deltaMs
    while (this.accumulatorMs >= TICK_MS) {
      this.accumulatorMs -= TICK_MS
      this.tickOnce()
    }
    return this.state
  }

  private tickOnce(): void {
    if (this.state.phase === 'runOver') {
      this.restartTimerMs += TICK_MS
      if (this.restartTimerMs >= RESTART_DELAY_MS) {
        this.restartTimerMs = 0
        startRun(this.state)
      }
      return
    }
    step(this.state, botInputs(this.state), this.rng)
    while (this.state.phase === 'shopping') {
      const entry = Object.entries(this.state.pendingOffers).find(([, offer]) => offer.length > 0)
      if (!entry) break
      pickGear(this.state, entry[0], entry[1][0]!)
    }
  }
}
