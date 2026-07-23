export interface AuthProfile {
  name: string
  email: string
}

export interface AuthProvider {
  enabled: boolean
  renderButton(host: HTMLElement, onSignIn: (token: string, profile: AuthProfile) => void): void
  token(): string | undefined
}

interface GisApi {
  accounts: {
    id: {
      initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void
      renderButton(host: HTMLElement, config: { theme: string; size: string; shape: string }): void
    }
  }
}

declare global {
  interface Window {
    google?: GisApi
  }
}

export const nullAuthProvider: AuthProvider = {
  enabled: false,
  renderButton: () => undefined,
  token: () => undefined
}

export function createGoogleAuthProvider(clientId: string): AuthProvider {
  let currentToken: string | undefined
  return {
    enabled: true,
    renderButton(host, onSignIn) {
      void loadGisScript().then(google => {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: response => {
            currentToken = response.credential
            onSignIn(response.credential, profileFromToken(response.credential))
          }
        })
        google.accounts.id.renderButton(host, { theme: 'filled_black', size: 'large', shape: 'pill' })
      })
    },
    token: () => currentToken
  }
}

function profileFromToken(idToken: string): AuthProfile {
  try {
    const payload = JSON.parse(atob((idToken.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'))) as {
      name?: string
      email?: string
    }
    return { name: payload.name ?? 'Player', email: payload.email ?? '' }
  } catch {
    return { name: 'Player', email: '' }
  }
}

function loadGisScript(): Promise<GisApi> {
  return new Promise((resolve, reject) => {
    if (window.google) {
      resolve(window.google)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => (window.google ? resolve(window.google) : reject(new Error('google identity failed to load')))
    script.onerror = () => reject(new Error('google identity script blocked'))
    document.head.append(script)
  })
}
