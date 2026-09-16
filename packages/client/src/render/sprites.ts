export function artUrl(baseUrl: string, art: string): string {
  return art.startsWith('data:') ? art : `${baseUrl}${art}`
}

export const SPRITE_CACHE_LIMIT = 64

export type SpritePainter = (ctx: CanvasRenderingContext2D, width: number, height: number) => void

export interface SpriteStoreDeps {
  createImage?: () => HTMLImageElement
  createCanvas?: (width: number, height: number) => HTMLCanvasElement
}

export class SpriteStore {
  private readonly images = new Map<string, HTMLImageElement>()
  private readonly canvases = new Map<string, HTMLCanvasElement>()
  private readonly createImage: () => HTMLImageElement
  private readonly createCanvas: (width: number, height: number) => HTMLCanvasElement

  constructor(
    private readonly baseUrl: string,
    deps: SpriteStoreDeps = {}
  ) {
    this.createImage = deps.createImage ?? (() => new Image())
    this.createCanvas = deps.createCanvas ?? defaultCanvas
  }

  get(path: string): HTMLImageElement {
    const existing = this.images.get(path)
    if (existing) return existing
    const image = this.createImage()
    image.src = artUrl(this.baseUrl, path)
    this.images.set(path, image)
    return image
  }

  ready(path: string): HTMLImageElement | undefined {
    const image = this.get(path)
    return image.complete && image.naturalWidth > 0 ? image : undefined
  }

  bitmap(path: string, width: number, height: number): HTMLCanvasElement | undefined {
    const image = this.ready(path)
    if (!image) return undefined
    return this.rendered(path, width, height, (ctx, w, h) => ctx.drawImage(image, 0, 0, w, h))
  }

  rendered(key: string, width: number, height: number, paint: SpritePainter): HTMLCanvasElement {
    const w = pixels(width)
    const h = pixels(height)
    const cacheKey = `${key}|${w}|${h}`
    const cached = this.canvases.get(cacheKey)
    if (cached) return cached
    if (this.canvases.size >= SPRITE_CACHE_LIMIT) this.canvases.clear()
    const canvas = this.createCanvas(w, h)
    const ctx = canvas.getContext('2d')
    if (ctx) paint(ctx, w, h)
    this.canvases.set(cacheKey, canvas)
    return canvas
  }
}

function defaultCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function pixels(value: number): number {
  return Math.max(1, Math.round(value))
}
