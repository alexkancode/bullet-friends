export class CamFeeds {
  private readonly bitmaps = new Map<string, ImageBitmap>()

  async accept(playerId: string, jpeg: Uint8Array): Promise<void> {
    try {
      const bitmap = await createImageBitmap(new Blob([jpeg as BlobPart], { type: 'image/jpeg' }))
      this.bitmaps.get(playerId)?.close()
      this.bitmaps.set(playerId, bitmap)
    } catch {
      return
    }
  }

  get(playerId: string): ImageBitmap | undefined {
    return this.bitmaps.get(playerId)
  }

  drop(playerId: string): void {
    this.bitmaps.get(playerId)?.close()
    this.bitmaps.delete(playerId)
  }
}
