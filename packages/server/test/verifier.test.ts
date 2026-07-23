import { describe, expect, it } from 'vitest'
import { generateKeyPairSync, sign } from 'node:crypto'
import { GoogleTokenVerifier } from '../src/auth/verifier.js'

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' }
const fetchJwks = () => Promise.resolve({ keys: [jwk] })

const NOW = 1_750_000_000_000

function makeToken(payload: Record<string, unknown>, kid = 'test-key'): string {
  const encode = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url')
  const body = `${encode({ alg: 'RS256', typ: 'JWT', kid })}.${encode(payload)}`
  const signature = sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64url')
  return `${body}.${signature}`
}

function goodPayload(): Record<string, unknown> {
  return {
    iss: 'https://accounts.google.com',
    aud: 'client-123',
    sub: 'user-9',
    email: 'spud@example.com',
    name: 'Spud',
    exp: Math.floor(NOW / 1000) + 3600,
    iat: Math.floor(NOW / 1000)
  }
}

const verifier = new GoogleTokenVerifier('client-123', fetchJwks, () => NOW)

describe('GoogleTokenVerifier', () => {
  it('accepts a valid token and extracts identity', async () => {
    const identity = await verifier.verify(makeToken(goodPayload()))
    expect(identity).toEqual({ userId: 'user-9', name: 'Spud', email: 'spud@example.com' })
  })

  it('rejects an expired token', async () => {
    const payload = { ...goodPayload(), exp: Math.floor(NOW / 1000) - 10 }
    expect(await verifier.verify(makeToken(payload))).toBeUndefined()
  })

  it('rejects a wrong audience', async () => {
    const payload = { ...goodPayload(), aud: 'someone-else' }
    expect(await verifier.verify(makeToken(payload))).toBeUndefined()
  })

  it('rejects a wrong issuer', async () => {
    const payload = { ...goodPayload(), iss: 'https://evil.example.com' }
    expect(await verifier.verify(makeToken(payload))).toBeUndefined()
  })

  it('rejects a token signed with an unknown key', async () => {
    expect(await verifier.verify(makeToken(goodPayload(), 'other-kid'))).toBeUndefined()
  })

  it('rejects a tampered token and garbage input', async () => {
    const token = makeToken(goodPayload())
    const tampered = `${token.slice(0, -6)}AAAAAA`
    expect(await verifier.verify(tampered)).toBeUndefined()
    expect(await verifier.verify('not-a-jwt')).toBeUndefined()
    expect(await verifier.verify('')).toBeUndefined()
  })
})
