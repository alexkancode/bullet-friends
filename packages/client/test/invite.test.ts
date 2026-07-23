import { describe, expect, it } from 'vitest'
import { inviteCodeFromSearch, inviteUrl } from '../src/auth/invites.js'

describe('invite links', () => {
  it('parses the invite code from a query string', () => {
    expect(inviteCodeFromSearch('?invite=ZK4Q7')).toBe('ZK4Q7')
    expect(inviteCodeFromSearch('?room=X&invite=abc12')).toBe('abc12')
  })

  it('returns undefined when absent or empty', () => {
    expect(inviteCodeFromSearch('')).toBeUndefined()
    expect(inviteCodeFromSearch('?invite=')).toBeUndefined()
    expect(inviteCodeFromSearch('?other=1')).toBeUndefined()
  })

  it('builds a shareable invite url on the current page', () => {
    expect(inviteUrl('https://game.example/play/', 'ZK4Q7')).toBe('https://game.example/play/?invite=ZK4Q7')
    expect(inviteUrl('https://game.example/play/?invite=OLD11', 'NEW22')).toBe('https://game.example/play/?invite=NEW22')
  })
})
