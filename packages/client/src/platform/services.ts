export interface PlatformServices {
  getCameraStream(): Promise<MediaStream | undefined>
  loadSession(): string | undefined
  saveSession(token: string): void
  clearSession(): void
  loadAudioMuted(): boolean
  saveAudioMuted(muted: boolean): void
}
