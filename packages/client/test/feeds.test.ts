import { describe, expect, it } from 'vitest'
import { CamFeeds } from '../src/camera/feeds.js'

function deferredDecoder() {
  const pending: { jpeg: Uint8Array; resolve: (bitmap: ImageBitmap) => void; reject: (error: Error) => void }[] = []
  const decode = (jpeg: Uint8Array) =>
    new Promise<ImageBitmap>((resolve, reject) => {
      pending.push({ jpeg, resolve, reject })
    })
  const settle = (index: number) => {
    const entry = pending[index]
    if (!entry) throw new Error(`no pending decode at ${index}`)
    const bitmap = { id: entry.jpeg[0], closed: false, close() {
      this.closed = true
    } } as unknown as ImageBitmap
    entry.resolve(bitmap)
    return bitmap
  }
  return { pending, decode, settle }
}

const frame = (id: number) => new Uint8Array([id])
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('CamFeeds', () => {
  it('exposes the decoded bitmap for a player', async () => {
    const decoder = deferredDecoder()
    const feeds = new CamFeeds(decoder.decode)
    void feeds.accept('p1', frame(1))
    const bitmap = decoder.settle(0)
    await flush()
    expect(feeds.get('p1')).toBe(bitmap)
  })

  it('keeps one decode in flight per player and drops all but the newest waiting frame', async () => {
    const decoder = deferredDecoder()
    const feeds = new CamFeeds(decoder.decode)
    void feeds.accept('p1', frame(1))
    void feeds.accept('p1', frame(2))
    void feeds.accept('p1', frame(3))
    expect(decoder.pending).toHaveLength(1)

    decoder.settle(0)
    await flush()
    expect(decoder.pending).toHaveLength(2)
    expect(decoder.pending[1]?.jpeg).toEqual(frame(3))

    decoder.settle(1)
    await flush()
    expect(decoder.pending).toHaveLength(2)
  })

  it('decodes for different players independently', async () => {
    const decoder = deferredDecoder()
    const feeds = new CamFeeds(decoder.decode)
    void feeds.accept('p1', frame(1))
    void feeds.accept('p2', frame(2))
    expect(decoder.pending).toHaveLength(2)
    decoder.settle(0)
    decoder.settle(1)
    await flush()
    expect(feeds.get('p1')).toBeDefined()
    expect(feeds.get('p2')).toBeDefined()
  })

  it('closes the bitmap it replaces', async () => {
    const decoder = deferredDecoder()
    const feeds = new CamFeeds(decoder.decode)
    void feeds.accept('p1', frame(1))
    const first = decoder.settle(0)
    await flush()
    void feeds.accept('p1', frame(2))
    decoder.settle(1)
    await flush()
    expect((first as unknown as { closed: boolean }).closed).toBe(true)
  })

  it('survives a failed decode and accepts the next frame', async () => {
    const decoder = deferredDecoder()
    const feeds = new CamFeeds(decoder.decode)
    void feeds.accept('p1', frame(1))
    decoder.pending[0]?.reject(new Error('bad jpeg'))
    await flush()
    expect(feeds.get('p1')).toBeUndefined()
    void feeds.accept('p1', frame(2))
    expect(decoder.pending).toHaveLength(2)
  })

  it('forgets a dropped player, including any frame waiting behind a decode', async () => {
    const decoder = deferredDecoder()
    const feeds = new CamFeeds(decoder.decode)
    void feeds.accept('p1', frame(1))
    const first = decoder.settle(0)
    await flush()
    void feeds.accept('p1', frame(2))
    void feeds.accept('p1', frame(3))
    feeds.drop('p1')
    decoder.settle(1)
    await flush()
    expect((first as unknown as { closed: boolean }).closed).toBe(true)
    expect(feeds.get('p1')).toBeUndefined()
    expect(decoder.pending).toHaveLength(2)
  })
})
