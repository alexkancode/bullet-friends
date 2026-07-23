import type { TokenIdentity, TokenVerifier } from './verifier.js'

export class CompositeTokenVerifier implements TokenVerifier {
  constructor(private readonly verifiers: TokenVerifier[]) {}

  async verify(token: string): Promise<TokenIdentity | undefined> {
    for (const verifier of this.verifiers) {
      const identity = await verifier.verify(token)
      if (identity) return identity
    }
    return undefined
  }
}
