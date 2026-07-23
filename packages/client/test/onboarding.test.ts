import { describe, expect, it } from 'vitest'
import { nextStep } from '../src/ui/onboarding.js'

const profile = (camConsent?: boolean) => ({ userId: 'u1', name: 'Spud', email: 's@e.com', ...(camConsent === undefined ? {} : { camConsent }) })

describe('nextStep', () => {
  it('starts at auth without a profile', () => {
    expect(nextStep(undefined, false)).toBe('auth')
  })

  it('asks for consent exactly once', () => {
    expect(nextStep(profile(), false)).toBe('consent')
  })

  it('moves to grouping when consent is answered either way', () => {
    expect(nextStep(profile(true), false)).toBe('group')
    expect(nextStep(profile(false), false)).toBe('group')
  })

  it('is ready once a group is active', () => {
    expect(nextStep(profile(true), true)).toBe('ready')
    expect(nextStep(profile(false), true)).toBe('ready')
  })

  it('never skips consent even with an active group', () => {
    expect(nextStep(profile(), true)).toBe('consent')
  })
})
