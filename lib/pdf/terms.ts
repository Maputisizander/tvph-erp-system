// ─── Default T&C (mirrors the golden PO text) ────────────────────────────────
// Shared between the pdfkit renderer (lib/pdf/renderPoDocument.ts) and the
// draft editor panel, which shows this template when a PO has no custom T&C.

export const TNC_INTRO = [
  "Project: {project_name} ({vendor_name})",
  "",
  "This PO is governed by the Service Agreement for {project_name} with Ref No. {ref_no}, as may be amended.",
  "",
  "Terms and Conditions:",
];

export const TNC_LIST: Array<[string, string[] | null, string[]?]> = [
  ["Amount indicated here are VAT-Inclusive.", null],
  [
    // golden: hard break after "superseded" (width-soft wrap would fit "by",
    // but golden puts "by a mutually agreed..." on the hang-indented next line)
    "Delivery Date/Period Covered: Vendor shall immediately mobilize upon PO release; any changes to the delivery date can only be superseded",
    null,
    ["by a mutually agreed and signed Project Timeline between TelcoVantage and Vendor"],
  ],
  [
    "Payment Terms:",
    [
      "Thirty percent (30%) of the value of the scope shall be paid by TelcoVantage to the Vendor. Payment shall be within 10 days from date of issue of the PO.",
      "The remaining balance of 60% of the value shall be paid via Progressive Billing on a per completed Node or batch of Nodes. Payment shall be made after the 30% Total DP is exhausted against completed works. Each Progressive Billing shall be paid by TelcoVantage to the Vendor within thirty (30) calendar days from the date of receipt of a complete and correct invoice.",
      // golden: c-continuation ends without a period ("...correct invoice")
      "Final Billing shall be 10% of the PO value as retention fee. Payment shall be made within thirty (30) calendar days from the date of receipt of complete and correct invoice",
    ],
  ],
  ["Additional costs beyond the PO value indicated shall be handled via a Change Request, to be filed by the Project Manager for approval.", null],
  [
    "The issuance of any subsequent Purchase Order, call-off, or work release under this Agreement shall not give rise to any additional downpayment obligation, unless TVPH and the Subcontractor expressly agree in writing to increase the downpayment by way of a formal amendment to this Agreement.",
    null,
  ],
  ["Liquidated Damages: As per Agreement", null],
  ["Liabilities and Indemnities: As per Agreement", null],
  ["Scope of Work: As per Agreement Annex A", null],
  ["List of Sites: See next page, B (List of Sites and Details)", null],
];

// [numbered line, continuation lines drawn at the hanging indent]
export const TNC_INSTRUCTIONS: Array<[string, string[] | null]> = [
  ["All invoice(s) should be provided in duplicate (2) copies.", null],
  ["Indicate Purchase Order (PO) reference number in all copies of invoice(s).", null],
  ["Ensure that authorized receiving personnel or users signs over his/her printed name & indicate the date received on all copies of invoice(s).", null],
  ["If the billing is in the form of a Statement of Account (SOA), vendor should provide TIN on the face of the SOA.", null],
  ["Issuance of handwritten or typewritten invoices is discouraged.", null],
  [
    "All original copy of invoices and proofs of delivery of goods or proofs of completion of service will be submitted to",
    [
      "Location: Unit 1811, North Tower, Park Triangle Corporate Plaza, 32nd street cor. 11th Ave, BGC, Taguig City.",
      "Contact Person: Mae Selina H. Bacayo / Teresa Grecia N. Beltran",
      "Contact Number: 0961-4734695 / 0920-9680070",
    ],
  ],
  ["All other supporting documents other than those submitted to Finance, will be submitted to the Project Manager of TelcoVantage", null],
  [
    // golden: hard break after "start" ("...shall start" / "as items are tagged as GR.")
    "Duplicate copies of invoice(s) shall be retained with the receiving personnel for Goods Receipt (GR). Processing of payment shall start as soon",
    ["as items are tagged as GR."],
  ],
];

export const TNC_SITES_LEAD = [
  "Any violation of the above instruction may lead to delay of payment or non-payment. In the event that payment is delayed (i.e. exceed the agreed payment terms indicated herein), please submit a Statement of Account (SOA) to Finance and notify Project Management team of such occurrence.",
  "It is hereby understood that by serving the requirement of TelcoVantage, you agree to adhere to the terms & conditions stated in this PO.",
];

// ─── Structured custom T&C ──────────────────────────────────────────────────
// Storing T&C as a structured object (not free text) keeps the golden layout
// intact: the renderer re-numbers items/subs and applies the golden hanging
// indents regardless of how the wording is edited. The intro lines, the
// "Terms and Conditions:" / "A. Instructions to Vendor:" headings stay
// golden-pinned (dynamic for the project-aware intro); only the item bodies
// and continuations are editable.

export type PoTc = {
  items: { text: string; subs: string[]; conts: string[] }[];
  instructions: { text: string; conts: string[] }[];
  sitesLead: string[];
};

export function defaultTc(): PoTc {
  return {
    items: TNC_LIST.map(([text, subs, conts]) => ({
      text,
      subs: subs ? [...subs] : [],
      conts: conts ? [...conts] : [],
    })),
    instructions: TNC_INSTRUCTIONS.map(([text, conts]) => ({
      text,
      conts: conts ? [...conts] : [],
    })),
    sitesLead: [...TNC_SITES_LEAD],
  };
}

// null / non-JSON / wrong-shape => null (rendered as the golden template).
export function parseTc(s: string | null | undefined): PoTc | null {
  if (!s) return null;
  try {
    const o = JSON.parse(s);
    if (!o || !Array.isArray(o.items) || !Array.isArray(o.instructions)) return null;
    return {
      items: o.items.map((it: any) => ({
        text: String(it?.text ?? ""),
        subs: Array.isArray(it?.subs) ? it.subs.map(String) : [],
        conts: Array.isArray(it?.conts) ? it.conts.map(String) : [],
      })),
      instructions: o.instructions.map((ins: any) => ({
        text: String(ins?.text ?? ""),
        conts: Array.isArray(ins?.conts) ? ins.conts.map(String) : [],
      })),
      sitesLead: Array.isArray(o.sitesLead) ? o.sitesLead.map(String) : [],
    };
  } catch {
    return null;
  }
}

export function tcEquals(a: PoTc, b: PoTc): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
