import { describe, expect, it } from 'vitest'
import { statsExit } from '../src/ui/leave.js'

describe('statsExit', () => {
  it('returns to the room lobby after a normal run', () => {
    expect(statsExit(false)).toEqual({ label: 'Back to lobby', action: 'playAgain' })
  })

  it('leaves the room after a run ended by leaving', () => {
    expect(statsExit(true)).toEqual({ label: 'Back to group', action: 'disconnect' })
  })
})
