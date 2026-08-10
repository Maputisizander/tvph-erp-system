import { PDFDocument } from "pdf-lib";

/**
 * Combines 1–3 raster images (JPEG/PNG) into a single PDF, one image per page.
 * Each page is sized to its image so scans render without cropping/scaling.
 *
 * // ponytail: EXIF orientation is ignored (pdf-lib has no EXIF handling);
 * // phone photos taken in portrait may render rotated. Add `sharp` to
 * // auto-rotate by EXIF if this becomes a real pain.
 */
export async function combineImagesToPdf(
  images: { bytes: Uint8Array; mimeType: string }[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const img of images) {
    const isPng = img.mimeType === "image/png";
    const embedded = isPng ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
    const { width, height } = embedded.scale(1);
    const page = doc.addPage([width, height]);
    page.drawImage(embedded, { x: 0, y: 0, width, height });
  }
  return doc.save();
}
