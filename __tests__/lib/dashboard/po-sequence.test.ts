import { parsePoSequenceNumber } from '@/lib/dashboard/po-sequence';

describe('parsePoSequenceNumber', () => {
  it('extracts the sequence from an ERP-style number', () => {
    expect(parsePoSequenceNumber('PO-2026000027')).toBe(27);
    expect(parsePoSequenceNumber('PO-2026000123')).toBe(123);
    expect(parsePoSequenceNumber('po-2026000042')).toBe(42);
  });

  it('returns null for numbers outside the ERP scheme', () => {
    expect(parsePoSequenceNumber('PO-2005-0123')).toBeNull();
    expect(parsePoSequenceNumber('PO-2026')).toBeNull();
    expect(parsePoSequenceNumber('')).toBeNull();
    expect(parsePoSequenceNumber('VENDOR-42')).toBeNull();
  });
});
