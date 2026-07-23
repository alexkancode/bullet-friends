import { describe, expect, it } from 'vitest'
import { roomCodeForGroup } from '@bullet/core'

describe('roomCodeForGroup', () => {
  it('is deterministic', () => {
    expect(roomCodeForGroup('g1')).toBe(roomCodeForGroup('g1'))
  })

  it('produces six characters from the unambiguous alphabet', () => {
    for (const id of ['g1', 'lNqgH1AGflVJNWIPFo2H', 'another-group-id']) {
      expect(roomCodeForGroup(id)).toMatch(/^[A-Z2-9]{6}$/)
    }
  })

  it('differs across group ids', () => {
    expect(roomCodeForGroup('g1')).not.toBe(roomCodeForGroup('g2'))
  })
})
