import { createHmac, timingSafeEqual } from 'node:crypto'
import type { TokenIdentity, TokenVerifier } from './verifier.js'
import { base64UrlEncode, decodeSegment } from './jwt.js'

const ISSUER = 'bullet-friends'
const TTL_MS = 30 * 24 * 3600 * 1000

interface SessionPayload {
  iss: string
  sub: string
  name: string
  email: string
  exp: number
}

export class SessionTokens implements TokenVerifier {
  constructor(
    private readonly secret: string,
    private readonly now: () => number = Date.now
  ) {}

  mint(identity: TokenIdentity): string {
    const payload: SessionPayload = {
      iss: ISSUER,
      sub: identity.userId,
      name: identity.name,
      email: identity.email,
      exp: Math.floor((this.now() + TTL_MS) / 1000)
    }
    const body = `${base64UrlEncode({ alg: 'HS256', typ: 'JWT' })}.${base64UrlEncode(payload)}`
    return `${body}.${this.sign(body)}`
  }

  verify(token: string): Promise<TokenIdentity | undefined> {
    const parts = token.split('.')
    if (parts.length !== 3) return Promise.resolve(undefined)
    const [header, payloadPart, signature] = parts as [string, string, string]
    const expected = this.sign(`${header}.${payloadPart}`)
    const actualBytes = Buffer.from(signature)
    const expectedBytes = Buffer.from(expected)
    if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
      return Promise.resolve(undefined)
    }
    const payload = decodeSegment<SessionPayload>(payloadPart)
    if (!payload || payload.iss !== ISSUER) return Promise.resolve(undefined)
    if (payload.exp * 1000 <= this.now()) return Promise.resolve(undefined)
    return Promise.resolve({ userId: payload.sub, name: payload.name, email: payload.email })
  }

  private sign(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url')
  }
}
