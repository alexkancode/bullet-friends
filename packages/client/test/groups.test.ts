import { describe, expect, it } from 'vitest'
import { memberLabel, visibilityControl } from '../src/ui/groups.js'

const group = (isPublic?: boolean) => ({ id: 'g1', name: 'Crew', ownerId: 'u1', memberIds: ['u1', 'u2'], ...(isPublic === undefined ? {} : { isPublic }) })

describe('visibilityControl', () => {
  it('offers the owner of a private group the option to open it', () => {
    expect(visibilityControl(group(), 'u1')).toEqual({ label: 'Make public', next: true })
    expect(visibilityControl(group(false), 'u1')).toEqual({ label: 'Make public', next: true })
  })

  it('offers the owner of a public group the option to close it', () => {
    expect(visibilityControl(group(true), 'u1')).toEqual({ label: 'Make private', next: false })
  })

  it('hides the control from members and strangers', () => {
    expect(visibilityControl(group(true), 'u2')).toBeUndefined()
    expect(visibilityControl(group(), 'u9')).toBeUndefined()
    expect(visibilityControl(undefined, 'u1')).toBeUndefined()
  })
})

describe('memberLabel', () => {
  it('pluralises members', () => {
    expect(memberLabel(1)).toBe('1 member')
    expect(memberLabel(2)).toBe('2 members')
  })
})
