const ART_SIZE = 96

export async function fileToArtDataUrl(file: File): Promise<string | undefined> {
  try {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = ART_SIZE
    canvas.height = ART_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    const scale = Math.min(ART_SIZE / bitmap.width, ART_SIZE / bitmap.height)
    const width = bitmap.width * scale
    const height = bitmap.height * scale
    ctx.drawImage(bitmap, (ART_SIZE - width) / 2, (ART_SIZE - height) / 2, width, height)
    bitmap.close()
    return canvas.toDataURL('image/png')
  } catch {
    return undefined
  }
}
