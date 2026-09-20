/**
 * Shrinks a photo in the browser before it is uploaded: longest side ≤ 1800 px, JPEG at 85% quality.
 * A 6 MB phone photo becomes ~300–600 KB — it uploads several times faster on mobile data, and it fits comfortably
 * under the ~4.5 MB request limit of serverless hosts such as Vercel. The server still re-checks every file.
 */
const MAX_SIDE = 1800
const QUALITY = 0.85
const SKIP_UNDER = 700 * 1024 // already small: leave it alone

export async function compressImage(file: File): Promise<File> {
  try {
    if (file.size < SKIP_UNDER) return file
    // imageOrientation applies the camera's rotation flag, so portrait photos don't come out sideways
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.fillStyle = '#ffffff' // transparent PNGs get a white background instead of black
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close?.()
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', QUALITY))
    if (!blob || blob.size >= file.size) return file // never make it bigger
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  }
}
