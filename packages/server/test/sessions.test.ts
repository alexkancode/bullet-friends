import { describe, expect, it } from 'vitest'
import { SessionTokens } from '../src/auth/sessions.js'
import { CompositeTokenVerifier } from '../src/auth/composite.js'
import type { TokenVerifier } from '../src/auth/verifier.js'

const NOW = 1_750_000_000_000
const identity = { userId: 'u9', name: 'Spud', email: 'spud@example.com' }

describe('SessionTokens', () => {
  it('round-trips an identity', async () => {
    const sessions = new SessionTokens('secret-a', () => NOW)
    const token = sessions.mint(identity)
    expect(await sessions.verify(token)).toEqual(identity)
  })

  it('rejects an expired token', async () => {
    const sessions = new SessionTokens('secret-a', () => NOW)
    const token = sessions.mint(identity)
    const later = new SessionTokens('secret-a', () => NOW + 31 * 24 * 3600 * 1000)
    expect(await later.verify(token)).toBeUndefined()
  })

  it('rejects tampering and wrong secrets', async () => {
    const sessions = new SessionTokens('secret-a', () => NOW)
    const token = sessions.mint(identity)
    expect(await sessions.verify(`${token.slice(0, -4)}AAAA`)).toBeUndefined()
    const other = new SessionTokens('secret-b', () => NOW)
    expect(await other.verify(token)).toBeUndefined()
    expect(await sessions.verify('garbage')).toBeUndefined()
  })
})

describe('CompositeTokenVerifier', () => {
  it('accepts the first verifier that recognizes the token and falls through otherwise', async () => {
    const sessions = new SessionTokens('secret-a', () => NOW)
    const fallback: TokenVerifier = {
      verify: token => Promise.resolve(token === 'google-token' ? { userId: 'g1', name: 'G', email: 'g@e.com' } : undefined)
    }
    const composite = new CompositeTokenVerifier([sessions, fallback])
    expect(await composite.verify(sessions.mint(identity))).toEqual(identity)
    expect((await composite.verify('google-token'))?.userId).toBe('g1')
    expect(await composite.verify('nonsense')).toBeUndefined()
  })
})
