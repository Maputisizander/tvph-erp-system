/**
 * Smoke test for the new pdfkit-based renderer.
 * Verifies a valid multi-page PDF comes out with mocked data, so pdfkit
 * actually runs (fonts, logo, page flow) without touching Supabase.
 */

import { renderPoDocument } from '@/lib/pdf/renderPoDocument';
import { fetchPoData } from '@/lib/pdf/fetchPoData';
import { createClient } from '@/utils/supabase/server';
import { writeFileSync, readFileSync } from 'fs';
import { inflateSync } from 'zlib';
import PDFDocument from 'pdfkit';

jest.mock('@/lib/pdf/fetchPoData');
jest.mock('@/utils/supabase/server');
jest.mock('server-only', () => ({}));

const mockPo: any = {
  po_number: 'PO-2026000027',
  po_date: '22 June 2026',
  vendor_name: 'JEWELINO TECH CONSTRUCTION SERVICES',
  vendor_no: '1000026',
  vendor_contact: 'ANGELITO BARCIAL',
  vendor_address: '303 L. Dela Torre St., Mag-Asawang Sapa, Sta. Maria, Bulacan',
  vendor_tel: '+639766680860',
  vendor_fax: '-',
  downpayment_amount: 43451.1,
  payment_terms: 'Refer to the PO notes below.',
  currency: 'PHP',
  line_items: [
    {
      line_no: '0010',
      item_code: 'Services',
      description:
        'SKY Cable Coaxial Cable Full Teardown, Recovery of Pole Equipment and Accessories, 1 Las Pinas City/Municipality, 5 Nodes, 16.093 km',
      quantity: 1,
      uom: 'LOT',
      unit_price: 144837,
      amount: 144837,
    },
  ],
  terms_and_conditions: '',
  mobilization_date: '06/22/2026',
  delivery_date: '06/30/2026',
  pr_number: 'PR-2026000027',
  requisitioner: 'M Bacayo',
  site_details: [
    { sn: 1, region: 'NCR', area_city: 'Las Pinas', no_of_nodes: 5, estimated_strand_km: 16.093, node_id: '', phase: '' },
  ],
  delivery_address_note: 'Pls coordinate with Mae Bacayo mae.bacayo@telcovantage.com',
  incoterms: null,
  date_prepared: '06/22/2026',
  approved_by: ['Edardnal Giovanni C. Canicula', 'Meinardo A. Opiana', 'Teresa Grecia N. Beltran'],
  project_name: 'EXTRACTION OF COAXIAL CABLES AND POLE-EQUIPMENT',
  ref_no: 'CM-1N-2026-017',
};

describe('renderPoDocument', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchPoData as jest.Mock).mockResolvedValue(mockPo);
    (createClient as jest.Mock).mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  company_name: 'TELCOVANTAGE PHILIPPINES\nSERVICES INC.',
                  company_address:
                    'Unit 1811 North Tower, Park Triangle\nCorporate Plaza, 32nd St. cor 11th Ave, Bonifacio\nGlobal City, Taguig City 1634',
                  company_tel: '09209680070',
                },
                error: null,
              }),
          }),
        }),
      }),
    });
  });

  it('produces a valid multi-page PDF from mock PO data', async () => {
    const { buffer } = await renderPoDocument('test-po-id');

    expect(buffer.length).toBeGreaterThan(1000);
    const head = buffer.subarray(0, 5).toString('latin1');
    expect(head).toBe('%PDF-');
    const pageCount = (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
    expect(pageCount).toBeGreaterThanOrEqual(3);

    writeFileSync('scripts/tmp-rendered.pdf', buffer);
  }, 30000);

  it('keeps long amounts inside the AMOUNT column', async () => {
    const po = {
      ...mockPo,
      line_items: [{ ...mockPo.line_items[0], unit_price: 14483.7, amount: 12345678.9 }],
    };
    (fetchPoData as jest.Mock).mockResolvedValue(po);

    const { buffer } = await renderPoDocument('test-po-id');
    // AMOUNT column is c6=482.75..c7=581.9. First item row: top=186.89,
    // header h=24.91, baseline=rowTop+9.06 → page y 220.86 → Tm y 792-220.86.
    // The description's first line sits at the same baseline (x≈154.9), and
    // unit price is drawn before amount — so the amount is the LAST op at
    // this baseline with x inside the numeric columns.
    const amountOp = contentStreams(buffer)
      .flatMap(textOpPositions)
      .filter((p) => Math.abs(p.y - (792 - 220.86)) < 3 && p.x >= 400)
      .at(-1);
    expect(amountOp).toBeDefined();

    const textWidth = measuredWidth('12,345,678.9 PHP');
    expect(amountOp!.x).toBeGreaterThanOrEqual(482.75 - 1);
    expect(amountOp!.x + textWidth).toBeLessThanOrEqual(581.9 + 1);
    // centered (≈493 for this string), not left-anchored at the old fixed 529.9
    expect(amountOp!.x).toBeLessThan(529.9);
  }, 30000);
});

// FlateDecode content streams (pdfkit does not compress by default, but the
// embedded logo JPEG forces streams into the file; only the text streams
// matter here, and only those inflate cleanly).
function contentStreams(buffer: Buffer): string[] {
  const s = buffer.toString('latin1');
  const out: string[] = [];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const start = m.index + m[0].length;
    const end = s.indexOf('endstream', start);
    const raw = s.slice(start, end).replace(/\r?\n$/, '');
    try {
      out.push(inflateSync(Buffer.from(raw, 'latin1')).toString('latin1'));
    } catch {
      // not a compressed stream (image data etc.)
    }
  }
  return out;
}

// Each text() call emits "x y Tm ... [glyphs] TJ"; pair every TJ with the
// most recent Tm to get the absolute x/y of each line of text.
function textOpPositions(content: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const re = /([\d.]+) ([\d.]+) Tm|\[[^\]]*\] TJ/g;
  let pos = { x: 0, y: 0 };
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    if (m[1] !== undefined) {
      pos = { x: parseFloat(m[1]), y: parseFloat(m[2]) };
    } else {
      out.push(pos);
    }
  }
  return out;
}

// Measure with the same engine + font the renderer uses (9pt Carlito).
// The renderer passes Uint8Array buffers to pdfkit, not paths (jest realm).
const FONT_REGULAR_BUF = new Uint8Array(readFileSync('public/fonts/Carlito-Regular.ttf').buffer);
function measuredWidth(text: string): number {
  const doc = new PDFDocument();
  doc.font(FONT_REGULAR_BUF).fontSize(9);
  return doc.widthOfString(text);
}
