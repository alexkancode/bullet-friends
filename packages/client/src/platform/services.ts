export interface PlatformServices {
  getCameraStream(): Promise<MediaStream | undefined>
  loadName(): string
  saveName(name: string): void
}
