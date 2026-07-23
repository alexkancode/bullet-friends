export class SpriteStore {
  private readonly images = new Map<string, HTMLImageElement>()

  constructor(private readonly baseUrl: string) {}

  get(path: string): HTMLImageElement {
    const existing = this.images.get(path)
    if (existing) return existing
    const image = new Image()
    image.src = `${this.baseUrl}${path}`
    this.images.set(path, image)
    return image
  }

  ready(path: string): HTMLImageElement | undefined {
    const image = this.get(path)
    return image.complete && image.naturalWidth > 0 ? image : undefined
  }
}
