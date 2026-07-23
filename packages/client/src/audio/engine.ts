import type { AudioEventName, MusicTrack } from './events.js'
import { SOUND_FILES } from './events.js'

const SFX_VOLUME = 0.5
const MUSIC_VOLUME = 0.25
const POOL_SIZE = 4

export class AudioEngine {
  private enabled = false
  private muted: boolean
  private readonly pools = new Map<AudioEventName, HTMLAudioElement[]>()
  private readonly poolCursor = new Map<AudioEventName, number>()
  private music: HTMLAudioElement | undefined
  private currentTrack: MusicTrack | undefined

  constructor(
    private readonly baseUrl: string,
    initiallyMuted: boolean
  ) {
    this.muted = initiallyMuted
  }

  enable(): void {
    if (this.enabled) return
    this.enabled = true
    this.applyMusicState()
  }

  isMuted(): boolean {
    return this.muted
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    this.applyMusicState()
  }

  play(name: AudioEventName): void {
    if (!this.enabled || this.muted) return
    const pool = this.poolFor(name)
    const cursor = (this.poolCursor.get(name) ?? 0) % pool.length
    this.poolCursor.set(name, cursor + 1)
    const element = pool[cursor]
    if (!element) return
    element.currentTime = 0
    void element.play().catch(() => undefined)
  }

  setMusic(track: MusicTrack): void {
    if (this.currentTrack === track) return
    this.currentTrack = track
    if (!this.music) {
      this.music = new Audio()
      this.music.loop = true
      this.music.volume = MUSIC_VOLUME
    }
    this.music.src = `${this.baseUrl}${SOUND_FILES[track]}`
    this.applyMusicState()
  }

  private applyMusicState(): void {
    if (!this.music || !this.currentTrack) return
    if (!this.enabled || this.muted) {
      this.music.pause()
      return
    }
    void this.music.play().catch(() => undefined)
  }

  private poolFor(name: AudioEventName): HTMLAudioElement[] {
    const existing = this.pools.get(name)
    if (existing) return existing
    const pool = Array.from({ length: POOL_SIZE }, () => {
      const element = new Audio(`${this.baseUrl}${SOUND_FILES[name]}`)
      element.volume = SFX_VOLUME
      return element
    })
    this.pools.set(name, pool)
    return pool
  }
}
