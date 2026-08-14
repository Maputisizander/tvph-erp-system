import { mapPdfItemsToExtract, type PdfTextItem } from '@/lib/pdf/extractLegacyPo';

// Fixture mirroring the real PO-2026000027 layout (pdfkit top-down coords).
function sampleItems(): PdfTextItem[] {
  return [
    // Page 1 — header PO box
    { page: 1, x: 400.9, y: 82.9, text: 'PO No.' },
    { page: 1, x: 450.2, y: 82.9, text: 'PO-2026000027' },
    { page: 1, x: 400.9, y: 95.6, text: 'Date' },
    { page: 1, x: 450.2, y: 95.6, text: '11 June 2026' },
    // Page 1 — vendor block
    { page: 1, x: 42, y: 146.2, text: 'VENDOR: JEWEL INOTECH CONSTRUCTION SERVICES' },
    // Page 1 — downpayment (decoy: value has no currency suffix)
    { page: 1, x: 410.5, y: 182.8, text: 'DOWNPAYMENT AMT: PHP' },
    { page: 1, x: 525.5, y: 182.8, text: '110,980.80' },
    // Page 1 — one line item: unit price is two runs (decoy), amount is one run
    { page: 1, x: 55.7, y: 208.7, text: '0010' },
    { page: 1, x: 155.2, y: 208.7, text: 'Services: SKY Cable Coaxial Cable Full' },
    { page: 1, x: 326.2, y: 208.7, text: '1.00' },
    { page: 1, x: 376.6, y: 208.7, text: 'LOT' },
    { page: 1, x: 430.7, y: 208.7, text: '369,936' },
    { page: 1, x: 462.6, y: 208.7, text: 'PHP' },
    { page: 1, x: 530.4, y: 208.7, text: '369,936 PHP' },
    // Page 1 — PR number decoy (must not be picked up as the PO number)
    { page: 1, x: 155.2, y: 506.4, text: 'PR No.: PR-2026000027' },
    // Page 2 — terms intro carries project + vendor
    {
      page: 2,
      x: 56.5,
      y: 197.6,
      text: 'Project: EXTRACTION OF COAXIAL CABLES AND POLE-EQUIPMENT (JEWEL INOTECH CONSTRUCTION SERVICES)',
    },
  ];
}

describe('mapPdfItemsToExtract', () => {
  it('extracts all fields from a generated-layout PO', () => {
    expect(mapPdfItemsToExtract(sampleItems())).toEqual({
      poNumber: 'PO-2026000027',
      poDate: '11 June 2026',
      project: 'EXTRACTION OF COAXIAL CABLES AND POLE-EQUIPMENT',
      vendorName: 'JEWEL INOTECH CONSTRUCTION SERVICES',
      currency: 'PHP',
      amount: 369936,
    });
  });

  it('returns nulls for an empty document', () => {
    expect(mapPdfItemsToExtract([])).toEqual({
      poNumber: null,
      poDate: null,
      project: null,
      vendorName: null,
      currency: null,
      amount: null,
    });
  });

  it('sums amounts across multiple line items', () => {
    const items = sampleItems();
    items.push({ page: 1, x: 530.4, y: 220.1, text: '25,000.50 PHP' });
    const extract = mapPdfItemsToExtract(items);
    expect(extract.amount).toBe(394936.5);
  });

  it('ignores amount-like runs outside the AMOUNT column band', () => {
    const items = sampleItems();
    // A "12,000 PHP" run inside the items band but left of the AMOUNT column (unit price)
    items.push({ page: 1, x: 430.7, y: 208.7, text: '12,000 PHP' });
    expect(mapPdfItemsToExtract(items).amount).toBe(369936);
  });

  it('falls back to the VENDOR block when the Project line has no parens', () => {
    const items = sampleItems().filter((it) => it.page !== 2);
    items.push({ page: 2, x: 56.5, y: 197.6, text: 'Project: EXTRACTION OF COAXIAL CABLES AND POLE-EQUIPMENT' });
    expect(mapPdfItemsToExtract(items)).toMatchObject({
      project: 'EXTRACTION OF COAXIAL CABLES AND POLE-EQUIPMENT',
      vendorName: 'JEWEL INOTECH CONSTRUCTION SERVICES',
    });
  });

  it('derives currency from surrounding text when no amount cell matches', () => {
    const items = sampleItems().filter((it) => !/^\d[\d,]* PHP$/.test(it.text));
    expect(mapPdfItemsToExtract(items)).toMatchObject({ amount: null, currency: 'PHP' });
  });
});
