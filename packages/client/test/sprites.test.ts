import { describe, expect, it } from 'vitest'
import { SpriteStore, SPRITE_CACHE_LIMIT } from '../src/render/sprites.js'

function loadedImage(): HTMLImageElement {
  return { complete: true, naturalWidth: 120, naturalHeight: 60, src: '' } as unknown as HTMLImageElement
}

function pendingImage(): HTMLImageElement {
  return { complete: false, naturalWidth: 0, naturalHeight: 0, src: '' } as unknown as HTMLImageElement
}

function canvasFactory() {
  const created: { width: number; height: number; draws: number; paints: number }[] = []
  const createCanvas = (width: number, height: number) => {
    const record = { width, height, draws: 0, paints: 0 }
    created.push(record)
    return {
      width,
      height,
      getContext: () => ({
        drawImage: () => {
          record.draws += 1
        },
        fillRect: () => {
          record.paints += 1
        }
      })
    } as unknown as HTMLCanvasElement
  }
  return { created, createCanvas }
}

function store(image: HTMLImageElement = loadedImage()) {
  const { created, createCanvas } = canvasFactory()
  return { created, sprites: new SpriteStore('/base/', { createImage: () => image, createCanvas }) }
}

describe('SpriteStore', () => {
  it('serves nothing until the source image has loaded', () => {
    const { sprites, created } = store(pendingImage())
    expect(sprites.ready('art/blob.svg')).toBeUndefined()
    expect(sprites.bitmap('art/blob.svg', 40, 40)).toBeUndefined()
    expect(created).toHaveLength(0)
  })

  it('rasterizes a sprite once and reuses it at the same size', () => {
    const { sprites, created } = store()
    const first = sprites.bitmap('art/blob.svg', 57, 57)
    const second = sprites.bitmap('art/blob.svg', 57, 57)
    expect(first).toBe(second)
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ width: 57, height: 57, draws: 1 })
  })

  it('rasterizes again for a different size', () => {
    const { sprites, created } = store()
    sprites.bitmap('art/blob.svg', 57, 57)
    sprites.bitmap('art/blob.svg', 114, 114)
    expect(created.map(entry => entry.width)).toEqual([57, 114])
  })

  it('rounds fractional sizes so a moving scale cannot rasterize every frame', () => {
    const { sprites, created } = store()
    for (const size of [57.1, 57.2, 56.8, 57.4]) sprites.bitmap('art/blob.svg', size, size)
    expect(created).toHaveLength(1)
    expect(created[0]?.width).toBe(57)
  })

  it('keeps separate entries per art path', () => {
    const { sprites, created } = store()
    sprites.bitmap('art/blob.svg', 57, 57)
    sprites.bitmap('art/brute.svg', 57, 57)
    expect(created).toHaveLength(2)
  })

  it('drops the cache once it passes its limit instead of growing forever', () => {
    const { sprites, created } = store()
    for (let size = 1; size <= SPRITE_CACHE_LIMIT + 1; size++) sprites.bitmap('art/blob.svg', size, size)
    expect(created).toHaveLength(SPRITE_CACHE_LIMIT + 1)
    sprites.bitmap('art/blob.svg', 1, 1)
    expect(created).toHaveLength(SPRITE_CACHE_LIMIT + 2)
  })

  it('caches anything painted through rendered, not only art files', () => {
    const { sprites, created } = store()
    const paint = (ctx: CanvasRenderingContext2D) => ctx.fillRect(0, 0, 1, 1)
    const first = sprites.rendered('orb', 48, 48, paint)
    const second = sprites.rendered('orb', 48, 48, paint)
    expect(first).toBe(second)
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ paints: 1 })
  })

  it('never asks for a zero-sized canvas', () => {
    const { sprites, created } = store()
    sprites.bitmap('art/blob.svg', 0.2, 0.2)
    expect(created[0]).toMatchObject({ width: 1, height: 1 })
  })
})
