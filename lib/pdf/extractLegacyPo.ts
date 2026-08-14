/**
 * A positioned text run from a PO page. `y` is in the same top-down
 * coordinate space the generator uses (0 at the top of the page), so it maps
 * straight onto the layout constants in lib/pdf/renderPoDocument.ts.
 */
export type PdfTextItem = { page: number; x: number; y: number; text: string };

export type LegacyPoExtract = {
  poNumber: string | null;
  poDate: string | null;
  project: string | null;
  vendorName: string | null;
  currency: "PHP" | "USD" | null;
  amount: number | null;
};

// Layout anchors from lib/pdf/renderPoDocument.ts (page 1 only).
const AMOUNT_X0 = 482.75; // ITEM_COLS[6] — left edge of the AMOUNT column
const AMOUNT_X1 = 581.9; // ITEM_COLS[7] (X3)
const ITEMS_Y0 = 190; // just below ITEM_HEADER_TOP (186.89)
const ITEMS_Y1 = 700; // below any 15-item table; only the AMOUNT column lives here

// AMOUNT cells are drawn as "<fmtMoney> <currency>", e.g. "369,936 PHP".
// Unit-price cells are two separate runs ("369,936" + "PHP") so neither
// matches; the downpayment value has no currency suffix and also fails.
const MONEY_CELL_RE = /^([\d,]+(?:\.\d+)?)\s+(PHP|USD)$/;
// Terms intro line: "Project: <project name> (<vendor name>)".
const PROJECT_LINE_RE = /^Project:\s*(.+?)\s+\(([^)]+)\)$/;

export function mapPdfItemsToExtract(items: PdfTextItem[]): LegacyPoExtract {
  const amountCells = items.filter(
    (it) =>
      it.page === 1 &&
      it.x >= AMOUNT_X0 &&
      it.x <= AMOUNT_X1 &&
      it.y >= ITEMS_Y0 &&
      it.y <= ITEMS_Y1 &&
      MONEY_CELL_RE.test(it.text),
  );

  let amount: number | null = null;
  let currency: LegacyPoExtract["currency"] = null;
  if (amountCells.length > 0) {
    amount = amountCells.reduce((sum, it) => sum + Number(it.text.replace(/[^\d.]/g, "")), 0);
    currency = (MONEY_CELL_RE.exec(amountCells[0].text)?.[2] as LegacyPoExtract["currency"]) || null;
  }
  if (!currency) {
    const m = /(PHP|USD)/.exec(items.map((it) => it.text).join(" "));
    if (m) currency = (m[1] as LegacyPoExtract["currency"]) || null;
  }

  // "PO No." / "Date" labels sit at x≈401; their value is the next run on the
  // same row at x≈450.
  const rowValue = (label: string) => {
    const labelItem = items.find((it) => it.page === 1 && it.text === label);
    if (!labelItem) return null;
    const value = items
      .filter((it) => it.page === 1 && Math.abs(it.y - labelItem.y) < 2 && it.x > labelItem.x)
      .sort((a, b) => a.x - b.x)[0];
    return value ? value.text.trim() || null : null;
  };

  const poNumber = rowValue("PO No.");
  const poDate = rowValue("Date");

  const projectText = items.map((it) => it.text).find((t) => t.startsWith("Project:")) || "";
  const projectMatch = projectText ? PROJECT_LINE_RE.exec(projectText) : null;
  const project = projectMatch
    ? projectMatch[1].trim()
    : projectText.replace(/^Project:\s*/, "").trim() || null;
  let vendorName = projectMatch ? projectMatch[2].trim() : null;
  if (!vendorName) {
    const vendor = items.find((it) => /^VENDOR:\s*/.test(it.text));
    if (vendor) vendorName = vendor.text.replace(/^VENDOR:\s*/, "").trim();
  }

  return { poNumber, poDate, project, vendorName, currency, amount };
}
