import fs from "fs";
import path from "path";

const sql = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations", "20260731_purchase_requests.sql"),
  "utf8",
);

describe("purchase_requests migration", () => {
  it("creates the PR table with the full status lifecycle", () => {
    expect(sql).toMatch(/create table if not exists public\.purchase_requests/i);
    for (const status of ["draft", "pending_approval", "approved", "rejected", "converted", "cancelled"]) {
      expect(sql).toContain(`'${status}'`);
    }
  });

  it("creates pr_line_items with cascade delete", () => {
    expect(sql).toMatch(/create table if not exists public\.pr_line_items/i);
    expect(sql).toMatch(/references public\.purchase_requests\(id\) on delete cascade/i);
  });

  it("enforces 1 PR → 1 PO via a unique partial index", () => {
    expect(sql).toMatch(/add column if not exists purchase_request_id/i);
    expect(sql).toMatch(/create unique index if not exists purchase_orders_purchase_request_id_key/i);
    expect(sql).toMatch(/where purchase_request_id is not null/i);
  });

  it("attaches the existing pr_number generator to the new table", () => {
    expect(sql).toMatch(/create trigger set_pr_number\s+before insert on public\.purchase_requests/i);
    expect(sql).toMatch(/execute function public\.generate_pr_number\(\)/i);
  });

  it("enables RLS on both new tables", () => {
    expect(sql).toMatch(/alter table public\.purchase_requests enable row level security/i);
    expect(sql).toMatch(/alter table public\.pr_line_items enable row level security/i);
  });

  it("registers the new email kinds in email_log", () => {
    expect(sql).toContain("'pr_pending_approval'");
    expect(sql).toContain("'pr_approved'");
  });
});
