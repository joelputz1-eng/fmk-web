/**
 * Foto-Pipeline (2.2), komplett clientseitig, kein Upload:
 * createImageBitmap → zentrierter quadratischer Crop → 512x512 → WebP-Blob.
 */

export const PHOTO_SIZE = 512;
const WEBP_QUALITY = 0.85;
const JPEG_QUALITY = 0.85;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function processPhoto(source: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  try {
    // Zentrierter Square-Crop: kuerzere Kante gewinnt, funktioniert fuer Hoch- und Querformat.
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;

    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(PHOTO_SIZE, PHOTO_SIZE);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
        try {
          return await canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY });
        } catch {
          return await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
        }
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = PHOTO_SIZE;
    canvas.height = PHOTO_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas-Kontext nicht verfügbar.');
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);

    const webp = await canvasToBlob(canvas, 'image/webp', WEBP_QUALITY);
    // Safari <16 kennt kein WebP-Encoding und liefert dann stillschweigend PNG.
    if (webp && webp.type === 'image/webp') return webp;
    const jpeg = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);
    if (jpeg) return jpeg;
    if (webp) return webp;
    throw new Error('Bild konnte nicht kodiert werden.');
  } finally {
    bitmap.close();
  }
}
