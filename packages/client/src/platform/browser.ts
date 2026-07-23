import type { PlatformServices } from './services.js'

const NAME_KEY = 'bullet-friends.name'

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
  loadName() {
    return localStorage.getItem(NAME_KEY) ?? ''
  },
  saveName(name: string) {
    localStorage.setItem(NAME_KEY, name)
  }
}
