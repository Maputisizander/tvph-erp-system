import { mapPdfItemsToExtract, type LegacyPoExtract, type PdfTextItem } from "./extractLegacyPo";

export async function extractLegacyPoFromPdf(buffer: ArrayBuffer | Buffer): Promise<LegacyPoExtract> {
  // ponytail: pdfjs legacy build touches DOMMatrix/Path2D at import time; Node has neither
  // (Vercel /var/task). Stub them before the dynamic import so external ESM doesn't throw.
  if (typeof (globalThis as any).DOMMatrix === "undefined") {
    (globalThis as any).DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      constructor() {}
    };
  }
  if (typeof (globalThis as any).Path2D === "undefined") {
    (globalThis as any).Path2D = class Path2D {
      constructor() {}
      addPath() {}
    };
  }
  // ponytail: lazy so Jest never parses pdfjs-dist's .mjs (Jest is CJS-only);
  // the dependency only loads when the server action actually runs.
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data =
    buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const loadingTask = getDocument({ data });
  const doc = await loadingTask.promise;
  const items: PdfTextItem[] = [];
  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const pageH = page.view[3];
      const tc = await page.getTextContent();
      for (const item of tc.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        items.push({ page: pageNum, x: item.transform[4], y: pageH - item.transform[5], text: item.str });
      }
    }
  } finally {
    await loadingTask.destroy();
  }
  return mapPdfItemsToExtract(items);
}
