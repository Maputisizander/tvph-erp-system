import PDFDocument from 'pdfkit';
import { readFileSync } from 'fs';

describe('pdfkit font debug', () => {
  it('registers font from buffer', () => {
    const buf = readFileSync('public/fonts/Carlito-Regular.ttf');
    const view = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    console.log('buf len', buf.length, 'view is Uint8Array', view instanceof Uint8Array);
    const doc = new PDFDocument({ size: [612, 792], margin: 0, autoFirstPage: false });
    doc.addPage();
    doc.registerFont('F', view);
    doc.font('F').fontSize(10).text('hello');
    console.log('OK');
  }, 15000);
});
