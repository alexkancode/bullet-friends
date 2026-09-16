export type CamDecoder = (jpeg: Uint8Array) => Promise<ImageBitmap>

const decodeJpeg: CamDecoder = jpeg => createImageBitmap(new Blob([jpeg as BlobPart], { type: 'image/jpeg' }))

export class CamFeeds {
  private readonly bitmaps = new Map<string, ImageBitmap>()
  private readonly decoding = new Set<string>()
  private readonly waiting = new Map<string, Uint8Array>()

  constructor(private readonly decode: CamDecoder = decodeJpeg) {}

  async accept(playerId: string, jpeg: Uint8Array): Promise<void> {
    if (this.decoding.has(playerId)) {
      this.waiting.set(playerId, jpeg)
      return
    }
    this.decoding.add(playerId)
    const bitmap = await this.decode(jpeg).catch(() => undefined)
    const stillWanted = this.decoding.delete(playerId)
    if (bitmap && !stillWanted) bitmap.close()
    if (bitmap && stillWanted) {
      this.bitmaps.get(playerId)?.close()
      this.bitmaps.set(playerId, bitmap)
    }
    const next = this.waiting.get(playerId)
    if (!next || !stillWanted) return
    this.waiting.delete(playerId)
    await this.accept(playerId, next)
  }

  get(playerId: string): ImageBitmap | undefined {
    return this.bitmaps.get(playerId)
  }

  drop(playerId: string): void {
    this.bitmaps.get(playerId)?.close()
    this.bitmaps.delete(playerId)
    this.decoding.delete(playerId)
    this.waiting.delete(playerId)
  }
}
