import fs from "fs";
import path from "path";

const sql = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations", "20260806_pr_po_number_alignment.sql"),
  "utf8",
);

describe("pr/po number alignment migration", () => {
  it("shares one sequence: PRs consume po_number_seq and pr_number_seq is dropped", () => {
    expect(sql).toMatch(/nextval\('public\.po_number_seq'\)/);
    expect(sql).toMatch(/drop sequence if exists public\.pr_number_seq/);
  });

  it("derives the PO number from the PR number at conversion", () => {
    expect(sql).toMatch(/purchase_request_id is not null/i);
    expect(sql).toMatch(/'PO-' \|\| substr\(v_pr_number, 4\)/);
  });

  it("keeps the sequence fallback for direct POs", () => {
    expect(sql).toMatch(/nextval\('public\.po_number_seq'\)/);
  });

  it("backfills drifted PR numbers and syncs the copied PO column", () => {
    expect(sql).toMatch(/update public\.purchase_requests pr/i);
    expect(sql).toMatch(/'PR-' \|\| substr\(po\.po_number, 4\)/i);
    expect(sql).toMatch(/update public\.purchase_orders po\s+set pr_number = pr\.pr_number/i);
  });
});
