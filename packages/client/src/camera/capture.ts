const FRAME_SIZE = 96
const FRAME_INTERVAL_MS = 140
const JPEG_QUALITY = 0.55

interface CaptureSurface {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  encode: () => Promise<Blob | null>
}

export function startFrameCapture(video: HTMLVideoElement, sendFrame: (bytes: Uint8Array) => void): () => void {
  const surface = createCaptureSurface()
  let encoding = false

  const timer = setInterval(() => {
    const ctx = surface.ctx
    if (!ctx || encoding || video.readyState < video.HAVE_CURRENT_DATA) return
    const side = Math.min(video.videoWidth, video.videoHeight)
    if (side === 0) return
    const sx = (video.videoWidth - side) / 2
    const sy = (video.videoHeight - side) / 2
    ctx.drawImage(video, sx, sy, side, side, 0, 0, FRAME_SIZE, FRAME_SIZE)
    encoding = true
    void surface
      .encode()
      .then(blob => (blob ? blob.arrayBuffer() : undefined))
      .then(buffer => {
        if (buffer) sendFrame(new Uint8Array(buffer))
      })
      .catch(() => undefined)
      .finally(() => {
        encoding = false
      })
  }, FRAME_INTERVAL_MS)

  return () => clearInterval(timer)
}

function createCaptureSurface(): CaptureSurface {
  if (typeof OffscreenCanvas === 'function') {
    const canvas = new OffscreenCanvas(FRAME_SIZE, FRAME_SIZE)
    return { ctx: canvas.getContext('2d'), encode: () => canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY }) }
  }
  const canvas = document.createElement('canvas')
  canvas.width = FRAME_SIZE
  canvas.height = FRAME_SIZE
  return { ctx: canvas.getContext('2d'), encode: () => new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)) }
}
