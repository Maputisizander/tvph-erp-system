import fs from "fs";
import path from "path";

const sql = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations", "20260806_node_status.sql"),
  "utf8",
);
const cronSql = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations", "20260806_node_status_cron.sql"),
  "utf8",
);

describe("node_status migration", () => {
  it("creates node_status keyed by (vendor_id, node_id)", () => {
    expect(sql).toMatch(/create table if not exists public\.node_status/i);
    expect(sql).toMatch(/unique \(vendor_id, node_id\)/i);
  });

  it("creates vendor_sync_state with the unmatched reconciliation status", () => {
    expect(sql).toMatch(/create table if not exists public\.vendor_sync_state/i);
    expect(sql).toContain("'unmatched'");
  });

  it("keeps manual project overrides via nullable project_id", () => {
    expect(sql).toMatch(/project_id\s+uuid references public\.projects\(id\) on delete set null/i);
  });

  it("enables RLS on both tables gated by is_staff", () => {
    expect(sql).toMatch(/alter table public\.node_status enable row level security/i);
    expect(sql).toMatch(/alter table public\.vendor_sync_state enable row level security/i);
    expect(sql).toMatch(/public\.is_staff\(auth\.uid\(\)\)/i);
  });

  it("schedules the sync every 15 minutes via pg_cron + pg_net", () => {
    expect(cronSql).toMatch(/cron\.schedule\('node-status-sync', '\*\/15 \* \* \* \*'/i);
    expect(cronSql).toMatch(/net\.http_post/i);
    expect(cronSql).toMatch(/api\/cron\/node-status/i);
  });
});
