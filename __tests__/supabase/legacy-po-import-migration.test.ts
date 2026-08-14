import fs from "fs";
import path from "path";

const sql = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations", "20260814_legacy_po_import.sql"),
  "utf8",
);

describe("legacy po import migration", () => {
  it("marks POs with a source column defaulting to erp", () => {
    expect(sql).toMatch(/add column if not exists source text not null default 'erp'/);
    expect(sql).toMatch(/check \(source = any \(array\['erp', 'legacy'\]\)\)/);
  });

  it("bumps the shared po_number_seq via a security definer rpc", () => {
    expect(sql).toMatch(/create or replace function public\.ensure_po_sequence\(min_seq bigint\)/);
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/setval\('public\.po_number_seq', greatest\(min_seq, \(select last_value from public\.po_number_seq\)\)\)/);
    expect(sql).toMatch(/grant execute on function public\.ensure_po_sequence\(bigint\) to authenticated/);
  });
});
