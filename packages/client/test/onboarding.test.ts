import { describe, expect, it } from 'vitest'
import { nextStep, selectGroup } from '../src/ui/onboarding.js'

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

const g = (id: string) => ({ id, name: `Group ${id}` })

describe('selectGroup', () => {
  it('auto-selects a lone group on load', () => {
    expect(selectGroup([g('a')], undefined, 'load')).toEqual(g('a'))
  })

  it('leaves the choice open when there are several groups on load', () => {
    expect(selectGroup([g('a'), g('b')], undefined, 'load')).toBeUndefined()
  })

  it('keeps the current group on load, using the fresh copy from the list', () => {
    const fresh = { id: 'a', name: 'Renamed' }
    expect(selectGroup([fresh, g('b')], g('a'), 'load')).toBe(fresh)
  })

  it('keeps the current group on load even before the list catches up', () => {
    expect(selectGroup([g('b')], g('a'), 'load')).toEqual(g('a'))
  })

  it('selects nothing on an explicit switch, even with a lone group', () => {
    expect(selectGroup([g('a')], g('a'), 'switch')).toBeUndefined()
    expect(selectGroup([g('a')], undefined, 'switch')).toBeUndefined()
  })
})
