import type { PlatformServices } from './services.js'

const SESSION_KEY = 'bullet-friends.session'
const MUTED_KEY = 'bullet-friends.muted'

export const browserPlatform: PlatformServices = {
  async getCameraStream() {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 240 }, height: { ideal: 240 }, facingMode: 'user' },
        audio: false
      })
    } catch {
      return undefined
    }
  },
  loadSession() {
    return localStorage.getItem(SESSION_KEY) ?? undefined
  },
  saveSession(token: string) {
    localStorage.setItem(SESSION_KEY, token)
  },
  clearSession() {
    localStorage.removeItem(SESSION_KEY)
  },
  loadAudioMuted() {
    return localStorage.getItem(MUTED_KEY) === 'true'
  },
  saveAudioMuted(muted: boolean) {
    localStorage.setItem(MUTED_KEY, String(muted))
  }
}
