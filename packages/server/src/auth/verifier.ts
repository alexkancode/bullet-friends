import { createPublicKey, verify as cryptoVerify } from 'node:crypto'
import type { JsonWebKey as NodeJwk } from 'node:crypto'
import { decodeSegment } from './jwt.js'

export interface TokenIdentity {
  userId: string
  name: string
  email: string
}

export interface TokenVerifier {
  verify(idToken: string): Promise<TokenIdentity | undefined>
}

export type Jwk = Record<string, unknown> & { kid?: string }

export interface Jwks {
  keys: Jwk[]
}

interface JwtHeader {
  alg: string
  kid?: string
}

interface JwtPayload {
  iss: string
  aud: string
  sub: string
  exp: number
  email?: string
  name?: string
}

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const JWKS_TTL_MS = 60 * 60 * 1000

export class GoogleTokenVerifier implements TokenVerifier {
  private cachedJwks: { at: number; jwks: Jwks } | undefined

  constructor(
    private readonly clientId: string,
    private readonly fetchJwks: () => Promise<Jwks> = fetchGoogleJwks,
    private readonly now: () => number = Date.now
  ) {}

  async verify(idToken: string): Promise<TokenIdentity | undefined> {
    const parts = idToken.split('.')
    if (parts.length !== 3) return undefined
    const [headerPart, payloadPart, signaturePart] = parts as [string, string, string]
    const header = decodeSegment<JwtHeader>(headerPart)
    const payload = decodeSegment<JwtPayload>(payloadPart)
    if (!header || !payload || header.alg !== 'RS256') return undefined
    if (payload.aud !== this.clientId) return undefined
    if (!GOOGLE_ISSUERS.includes(payload.iss)) return undefined
    if (payload.exp * 1000 <= this.now()) return undefined
    const key = await this.findKey(header.kid)
    if (!key) return undefined
    const valid = cryptoVerify(
      'RSA-SHA256',
      Buffer.from(`${headerPart}.${payloadPart}`),
      createPublicKey({ key: key as NodeJwk, format: 'jwk' }),
      Buffer.from(signaturePart, 'base64url')
    )
    if (!valid) return undefined
    return {
      userId: payload.sub,
      name: payload.name ?? payload.email ?? 'Player',
      email: payload.email ?? ''
    }
  }

  private async findKey(kid: string | undefined): Promise<Jwk | undefined> {
    if (!this.cachedJwks || this.now() - this.cachedJwks.at > JWKS_TTL_MS) {
      this.cachedJwks = { at: this.now(), jwks: await this.fetchJwks() }
    }
    return this.cachedJwks.jwks.keys.find(key => key.kid === kid)
  }
}

async function fetchGoogleJwks(): Promise<Jwks> {
  const response = await fetch(GOOGLE_JWKS_URL)
  return (await response.json()) as Jwks
}
