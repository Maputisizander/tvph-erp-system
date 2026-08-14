/**
 * Extract the shared po_number_seq value implied by an ERP-style PO number
 * ("PO-YYYYNNNNNN", e.g. "PO-2026000027" -> 27). Returns null for numbers that
 * don't use the ERP scheme (e.g. hand-typed legacy formats), so the caller can
 * skip the sequence bump.
 */
export function parsePoSequenceNumber(poNumber: string): number | null {
  const m = /^PO-(\d{4})(\d{6})$/i.exec(poNumber.trim());
  if (!m) return null;
  return parseInt(m[2], 10);
}
