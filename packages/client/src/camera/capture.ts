const FRAME_SIZE = 96
const FRAME_INTERVAL_MS = 140
const JPEG_QUALITY = 0.55

export function startFrameCapture(video: HTMLVideoElement, sendFrame: (bytes: Uint8Array) => void): () => void {
  const canvas = document.createElement('canvas')
  canvas.width = FRAME_SIZE
  canvas.height = FRAME_SIZE
  const ctx = canvas.getContext('2d')

  const timer = setInterval(() => {
    if (!ctx || video.readyState < video.HAVE_CURRENT_DATA) return
    const side = Math.min(video.videoWidth, video.videoHeight)
    if (side === 0) return
    const sx = (video.videoWidth - side) / 2
    const sy = (video.videoHeight - side) / 2
    ctx.drawImage(video, sx, sy, side, side, 0, 0, FRAME_SIZE, FRAME_SIZE)
    canvas.toBlob(
      blob => {
        if (!blob) return
        blob.arrayBuffer().then(buffer => sendFrame(new Uint8Array(buffer)))
      },
      'image/jpeg',
      JPEG_QUALITY
    )
  }, FRAME_INTERVAL_MS)

  return () => clearInterval(timer)
}
