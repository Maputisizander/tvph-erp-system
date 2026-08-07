# Recurring Invoice & PO Due Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send milestone-and-overdue due reminders for eligible invoices AND purchase orders to every capability-holding staff member — one daily digest email per recipient plus a personal in-app notification per record — with idempotent, resolution-aware, timezone-correct scheduling.

**Architecture:** A pure `lib/reminders/schedule.ts` decides, from a record's days-until-due and its already-sent milestone log, the single milestone (or overdue day) to fire today — never a ladder replay. A shared `reminder_log` table with a unique idempotency key gates both email and in-app delivery per channel. One cron route (`/api/cron/due-reminders`) loads eligible invoices + POs, computes outstanding via a shared SQL view, resolves recipients from the `notification.payment_reminders` capability, sends each recipient one digest email, and creates one per-record in-app notification (built on Plan 1's recipient model).

**Tech Stack:** Next.js 16 Route Handlers, Supabase (Postgres, RLS, Vault, pg_cron/pg_net), Resend + React Email, TypeScript, Jest 30.

## Global Constraints

- **Depends on Plan 1 (notification recipient model).** `createNotification` must already accept `recipients: { capability }` and fan out to `notification_recipients`.
- All day boundaries and milestone math use **`Asia/Manila`** calendar dates. Reuse `manilaDateString` / `addCalendarDays` from `lib/payment-terms.ts` — do NOT introduce a second date helper.
- Migration filename format `YYYYMMDD_description.sql`, additive/idempotent, sorted lexicographically. New exposed tables enable RLS + least-privilege grants.
- Outstanding-balance math is `greatest(amount - total_paid, 0)` — the exact formula in `20260714_dashboard_bottlenecks.sql:153-154`. Expose it once as a SQL view; never reimplement in TypeScript.
- Cron auth: shared-secret bearer token, `Bearer ${process.env.CRON_SECRET}`, matching `app/api/cron/invoice-due-reminders/route.ts`.
- Email sending goes through `sendEmail` (`lib/email/send.ts`); it never throws and records to `email_log`.
- New capability goes in BOTH the `Capability` union AND `CAPABILITY_ROLES` in `lib/auth/roles.ts`.
- Run `npm run lint`, `npm run test`, `npm run build` before completion.

## Milestone & eligibility policy (verbatim — every task depends on this)

- **Before-due milestones:** 14, 7, 3, 1, 0 days. Fire the largest milestone `m` such that `daysUntilDue <= m` and no `reminder_log` row exists for that record at milestone `m`. This makes a missed-cron day self-heal (down on day 7 → next run fires the 7 milestone) and lets late-created records join mid-ladder.
- **Overdue:** decay schedule — fire on `daysOverdue` ∈ {1,2,3,4,5,6,7} (daily first week), then every 3rd day to day 30, then every 7th day after. One `reminder_log` row per fired overdue day.
- **Eligible invoices:** `status in ('approved','partially_paid')`, `deleted_at is null`, outstanding > 0. `disputed`, `received`, `under_review`, `paid` are EXCLUDED (never remind on a contested or unpayable bill).
- **Eligible POs:** `status in ('issued','partially_paid')`, `deleted_at is null`, outstanding > 0.
- **Stop conditions:** a record dropping out of the eligible set (paid/overpaid/cancelled/deleted/zero-outstanding/status change) simply stops matching the query next run — no explicit teardown.
- **NULL due_date:** never remind; count as `skipped_no_due_date` in the response.
- **Idempotency key:** `(record_type, record_id, due_date, milestone_key, recipient_id, channel)` unique. `milestone_key` is `'m14'|'m7'|'m3'|'m1'|'m0'|'od{n}'`. Including `due_date` means editing a due date restarts the ladder against the new date (desired); the "largest-unsent milestone" rule caps this at one send per record per day.

---

## File Structure

- `lib/reminders/schedule.ts` (new) — pure milestone/overdue decision + eligibility predicates. Fully unit-tested, no I/O.
- `lib/reminders/messages.ts` (new) — pure formatters: subject line, digest row shape, in-app title/message.
- `lib/email/templates/due-digest.tsx` (new) — React Email digest listing due/overdue rows.
- `supabase/migrations/20260717_reminder_log_and_outstanding.sql` (new) — `reminder_log` table + `record_outstanding` view + `notification.payment_reminders` grant note.
- `app/api/cron/due-reminders/route.ts` (new) — orchestration.
- `supabase/migrations/20260718_due_reminders_cron.sql` (new) — pg_cron schedule.
- `lib/auth/roles.ts` — add `notification.payment_reminders` capability.
- Tests mirror each path under `__tests__/`.

---

### Task 1: `notification.payment_reminders` capability

**Files:**
- Modify: `lib/auth/roles.ts:22-105`
- Test: `__tests__/lib/auth/payment-reminders-capability.test.ts`

**Interfaces:**
- Produces: capability `"notification.payment_reminders"` granted to `["superadmin","admin","finance"]`.

- [ ] **Step 1: Write the failing test**

```typescript
import { CAPABILITY_ROLES, hasCapability } from "@/lib/auth/roles";

it("grants payment reminders to finance, admin, superadmin only", () => {
  expect([...CAPABILITY_ROLES["notification.payment_reminders"]].sort()).toEqual(
    ["admin", "finance", "superadmin"].sort()
  );
  expect(hasCapability("operations", "notification.payment_reminders")).toBe(false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest __tests__/lib/auth/payment-reminders-capability.test.ts`
Expected: FAIL — capability not in the map (also a TS error).

- [ ] **Step 3: Add the capability**

In `lib/auth/roles.ts`, add to the `Capability` union (after `payment_request.approve`):

```typescript
  | "payment_request.approve"
  | "notification.payment_reminders";
```

And to `CAPABILITY_ROLES`:

```typescript
  "payment_request.approve": ["superadmin", "admin", "finance"],
  "notification.payment_reminders": ["superadmin", "admin", "finance"],
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/lib/auth/payment-reminders-capability.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/roles.ts __tests__/lib/auth/payment-reminders-capability.test.ts
git commit -m "feat: add notification.payment_reminders capability"
```

---

### Task 2: Pure scheduling logic

**Files:**
- Create: `lib/reminders/schedule.ts`
- Test: `__tests__/lib/reminders/schedule.test.ts`

**Interfaces:**
- Consumes: `manilaDateString`, `addCalendarDays` from `@/lib/payment-terms`.
- Produces:
  - `type MilestoneKey = 'm14'|'m7'|'m3'|'m1'|'m0'|\`od${number}\``
  - `daysUntilDue(dueDate: string, today: string): number` — signed integer calendar-day difference (`due - today`); negative when overdue.
  - `dueMilestoneToFire(days: number, alreadySent: Set<MilestoneKey>): MilestoneKey | null` — largest unsent before-due milestone at/under `days`, or null.
  - `overdueMilestoneToFire(daysOverdue: number, alreadySent: Set<MilestoneKey>): MilestoneKey | null` — applies the decay schedule; returns `od{n}` if `n` is a firing day and unsent, else null.
  - `milestoneToFire(days: number, alreadySent: Set<MilestoneKey>): MilestoneKey | null` — dispatches on sign.

- [ ] **Step 1: Write the failing test**

```typescript
import {
  daysUntilDue,
  dueMilestoneToFire,
  overdueMilestoneToFire,
  milestoneToFire,
  type MilestoneKey,
} from "@/lib/reminders/schedule";

describe("daysUntilDue", () => {
  it("counts calendar days, negative when overdue", () => {
    expect(daysUntilDue("2026-07-31", "2026-07-17")).toBe(14);
    expect(daysUntilDue("2026-07-17", "2026-07-17")).toBe(0);
    expect(daysUntilDue("2026-07-10", "2026-07-17")).toBe(-7);
  });
});

describe("dueMilestoneToFire", () => {
  const none = new Set<MilestoneKey>();
  it("fires the exact milestone on the day", () => {
    expect(dueMilestoneToFire(14, none)).toBe("m14");
    expect(dueMilestoneToFire(7, none)).toBe("m7");
    expect(dueMilestoneToFire(0, none)).toBe("m0");
  });
  it("self-heals a missed day by firing the largest unsent crossed milestone", () => {
    // Cron was down on day 7; today the record is 6 days out and m7 unsent.
    expect(dueMilestoneToFire(6, none)).toBe("m7");
  });
  it("does not refire a milestone already sent", () => {
    expect(dueMilestoneToFire(6, new Set<MilestoneKey>(["m7"]))).toBe("m3");
  });
  it("returns null before the first milestone", () => {
    expect(dueMilestoneToFire(20, none)).toBeNull();
  });
});

describe("overdueMilestoneToFire", () => {
  const none = new Set<MilestoneKey>();
  it("fires daily for the first week", () => {
    expect(overdueMilestoneToFire(1, none)).toBe("od1");
    expect(overdueMilestoneToFire(7, none)).toBe("od7");
  });
  it("fires every third day in the second window", () => {
    expect(overdueMilestoneToFire(10, none)).toBe("od10"); // 7 + 3
    expect(overdueMilestoneToFire(11, none)).toBeNull();
  });
  it("fires weekly after day 30", () => {
    expect(overdueMilestoneToFire(37, none)).toBe("od37"); // 30 + 7
    expect(overdueMilestoneToFire(38, none)).toBeNull();
  });
  it("does not refire an overdue day already sent", () => {
    expect(overdueMilestoneToFire(3, new Set<MilestoneKey>(["od3"]))).toBeNull();
  });
});

describe("milestoneToFire dispatch", () => {
  it("routes by sign of daysUntilDue", () => {
    expect(milestoneToFire(3, new Set())).toBe("m3");
    expect(milestoneToFire(-1, new Set())).toBe("od1");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest __tests__/lib/reminders/schedule.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the schedule logic**

Create `lib/reminders/schedule.ts`:

```typescript
export type MilestoneKey = "m14" | "m7" | "m3" | "m1" | "m0" | `od${number}`;

const DUE_MILESTONES = [14, 7, 3, 1, 0] as const;

/** Signed calendar-day difference (dueDate - today), both `YYYY-MM-DD`. */
export function daysUntilDue(dueDate: string, today: string): number {
  const toUtc = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((toUtc(dueDate) - toUtc(today)) / 86_400_000);
}

/** Largest unsent before-due milestone at or under `days`, else null. */
export function dueMilestoneToFire(
  days: number,
  alreadySent: Set<MilestoneKey>
): MilestoneKey | null {
  for (const m of DUE_MILESTONES) {
    if (days <= m) {
      const key = `m${m}` as MilestoneKey;
      if (!alreadySent.has(key)) return key;
    }
  }
  return null;
}

/** True when daysOverdue is a firing day under the decay schedule. */
function isOverdueFiringDay(daysOverdue: number): boolean {
  if (daysOverdue < 1) return false;
  if (daysOverdue <= 7) return true; // daily first week
  if (daysOverdue <= 30) return (daysOverdue - 7) % 3 === 0; // every 3rd day
  return (daysOverdue - 30) % 7 === 0; // weekly thereafter
}

export function overdueMilestoneToFire(
  daysOverdue: number,
  alreadySent: Set<MilestoneKey>
): MilestoneKey | null {
  if (!isOverdueFiringDay(daysOverdue)) return null;
  const key = `od${daysOverdue}` as MilestoneKey;
  return alreadySent.has(key) ? null : key;
}

/** Dispatch on the sign of daysUntilDue. */
export function milestoneToFire(
  days: number,
  alreadySent: Set<MilestoneKey>
): MilestoneKey | null {
  return days >= 0
    ? dueMilestoneToFire(days, alreadySent)
    : overdueMilestoneToFire(-days, alreadySent);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/lib/reminders/schedule.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/reminders/schedule.ts __tests__/lib/reminders/schedule.test.ts
git commit -m "feat: pure milestone and overdue reminder scheduling logic"
```

---

### Task 3: Idempotency log + shared outstanding view

**Files:**
- Create: `supabase/migrations/20260717_reminder_log_and_outstanding.sql`
- Test: `__tests__/supabase/reminder-log-migration.test.ts`

**Interfaces:**
- Produces:
  - Table `public.reminder_log(id, record_type text check in ('invoice','po'), record_id uuid, due_date date, milestone_key text, recipient_id uuid, channel text check in ('email','in_app'), created_at)` with UNIQUE on `(record_type, record_id, due_date, milestone_key, recipient_id, channel)`.
  - View `public.record_outstanding(record_type, record_id, outstanding)` — invoices and POs with `greatest(amount - total_paid, 0)`.

- [ ] **Step 1: Write the failing test**

```typescript
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "supabase/migrations");
const filename = fs
  .readdirSync(dir)
  .find((n) => n.endsWith("_reminder_log_and_outstanding.sql"));
if (!filename) throw new Error("reminder_log migration is missing");
const sql = fs.readFileSync(path.join(dir, filename), "utf8");

it("creates an idempotency-keyed reminder log", () => {
  expect(sql).toContain("create table if not exists public.reminder_log");
  expect(sql).toContain("channel text not null check (channel in ('email', 'in_app'))");
  expect(sql).toContain("reminder_log_idem_idx");
  expect(sql).toContain("(record_type, record_id, due_date, milestone_key, recipient_id, channel)");
});

it("exposes a shared outstanding view using the greatest(amount - paid, 0) formula", () => {
  expect(sql).toContain("create or replace view public.record_outstanding");
  expect(sql).toContain("greatest(i.amount - coalesce(p.total_paid, 0), 0)");
  expect(sql).toContain("greatest(po.amount - coalesce(pp.total_paid, 0), 0)");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest __tests__/supabase/reminder-log-migration.test.ts`
Expected: FAIL — migration missing.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260717_reminder_log_and_outstanding.sql`:

```sql
-- ============================================================================
-- Recurring due reminders: idempotency log + shared outstanding view (#52)
-- ============================================================================

create table if not exists public.reminder_log (
  id           uuid primary key default gen_random_uuid(),
  record_type  text not null check (record_type in ('invoice', 'po')),
  record_id    uuid not null,
  due_date     date not null,
  milestone_key text not null,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  channel      text not null check (channel in ('email', 'in_app')),
  created_at   timestamptz not null default now()
);

-- Idempotency: one send per record/due-date/milestone/recipient/channel.
create unique index if not exists reminder_log_idem_idx
  on public.reminder_log
  (record_type, record_id, due_date, milestone_key, recipient_id, channel);

-- Look up prior sends for a record quickly when computing the next milestone.
create index if not exists reminder_log_record_idx
  on public.reminder_log (record_type, record_id, due_date);

alter table public.reminder_log enable row level security;
-- Only the service role (bypasses RLS) writes/reads this; no authenticated grant.

-- Shared outstanding view — single source for the greatest(amount - paid, 0)
-- formula used by the dashboard bottlenecks query. Do not reimplement in TS.
create or replace view public.record_outstanding as
  select
    'invoice'::text as record_type,
    i.id as record_id,
    greatest(i.amount - coalesce(p.total_paid, 0), 0) as outstanding
  from public.service_invoices i
  left join (
    select invoice_id, sum(amount_paid) as total_paid
    from public.payments where deleted_at is null group by invoice_id
  ) p on p.invoice_id = i.id
  where i.deleted_at is null
  union all
  select
    'po'::text as record_type,
    po.id as record_id,
    greatest(po.amount - coalesce(pp.total_paid, 0), 0) as outstanding
  from public.purchase_orders po
  left join (
    select po_id, sum(amount_paid) as total_paid
    from public.payments where deleted_at is null group by po_id
  ) pp on pp.po_id = po.id
  where po.deleted_at is null;

grant select on public.record_outstanding to service_role;
```

Note: confirm `payments` has a `po_id` column during implementation (grep the migrations). If AP payments link only via `invoice_id`, derive PO paid totals by summing payments of the PO's invoices instead — adjust the `pp` subquery accordingly and update the test's expected string.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/supabase/reminder-log-migration.test.ts`
Expected: PASS.

- [ ] **Step 5: Apply and sanity-check**

Apply via Supabase MCP `apply_migration` (name `reminder_log_and_outstanding`). Run `select * from public.record_outstanding limit 5;` and confirm both record types appear with sensible outstanding values.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260717_reminder_log_and_outstanding.sql __tests__/supabase/reminder-log-migration.test.ts
git commit -m "feat: reminder idempotency log and shared outstanding view"
```

---

### Task 4: Message formatters + digest email template

**Files:**
- Create: `lib/reminders/messages.ts`, `lib/email/templates/due-digest.tsx`
- Test: `__tests__/lib/reminders/messages.test.ts`

**Interfaces:**
- Consumes: `MilestoneKey` from `@/lib/reminders/schedule`.
- Produces:
  - `type DigestRow = { recordType: 'invoice'|'po'; number: string; vendorName: string; outstanding: string; dueDate: string; daysLabel: string; url: string; }`
  - `daysLabel(days: number): string` — `"due today"`, `"due in 3 days"`, `"1 day overdue"`, `"5 days overdue"`.
  - `inAppMessage(row: DigestRow): { title: string; message: string }`.
  - `DueDigestEmail(props: { recipientName: string; dueSoon: DigestRow[]; overdue: DigestRow[] })` React Email component.

- [ ] **Step 1: Write the failing test**

```typescript
import { daysLabel, inAppMessage, type DigestRow } from "@/lib/reminders/messages";

describe("daysLabel", () => {
  it("formats due-soon and overdue phrasing", () => {
    expect(daysLabel(0)).toBe("due today");
    expect(daysLabel(3)).toBe("due in 3 days");
    expect(daysLabel(1)).toBe("due in 1 day");
    expect(daysLabel(-1)).toBe("1 day overdue");
    expect(daysLabel(-5)).toBe("5 days overdue");
  });
});

describe("inAppMessage", () => {
  it("summarizes a record for the bell", () => {
    const row: DigestRow = {
      recordType: "invoice",
      number: "INV-9",
      vendorName: "Acme",
      outstanding: "10,000",
      dueDate: "31 July 2026",
      daysLabel: "due in 3 days",
      url: "/dashboard/invoices/1",
    };
    const { title, message } = inAppMessage(row);
    expect(title).toContain("INV-9");
    expect(message).toContain("Acme");
    expect(message).toContain("10,000");
    expect(message).toContain("due in 3 days");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest __tests__/lib/reminders/messages.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement formatters**

Create `lib/reminders/messages.ts`:

```typescript
export type DigestRow = {
  recordType: "invoice" | "po";
  number: string;
  vendorName: string;
  outstanding: string;
  dueDate: string;
  daysLabel: string;
  url: string;
};

export function daysLabel(days: number): string {
  if (days === 0) return "due today";
  if (days > 0) return `due in ${days} day${days === 1 ? "" : "s"}`;
  const overdue = -days;
  return `${overdue} day${overdue === 1 ? "" : "s"} overdue`;
}

export function inAppMessage(row: DigestRow): { title: string; message: string } {
  const kind = row.recordType === "invoice" ? "Invoice" : "PO";
  return {
    title: `${kind} #${row.number} — ${row.daysLabel}`,
    message: `${kind} #${row.number} from ${row.vendorName} (₱${row.outstanding}) is ${row.daysLabel} (due ${row.dueDate}).`,
  };
}
```

- [ ] **Step 4: Implement the digest email template**

Create `lib/email/templates/due-digest.tsx` (follow `lib/email/templates/invoice-due.tsx` for `EmailLayout`/`styles`):

```tsx
import * as React from "react";
import { Button, Hr, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./layout";
import type { DigestRow } from "@/lib/reminders/messages";

export interface DueDigestEmailProps {
  recipientName: string;
  dueSoon: DigestRow[];
  overdue: DigestRow[];
}

function RowBlock({ row }: { row: DigestRow }) {
  const kind = row.recordType === "invoice" ? "Invoice" : "PO";
  return (
    <Section style={styles.panel}>
      <Text style={{ ...styles.paragraph, margin: "0 0 4px" }}>
        <strong>{kind} #{row.number}</strong> — {row.vendorName}
      </Text>
      <Text style={{ ...styles.paragraph, margin: "0 0 4px" }}>
        ₱{row.outstanding} outstanding · {row.daysLabel} · due {row.dueDate}
      </Text>
      <Button href={row.url} style={styles.button}>View record</Button>
    </Section>
  );
}

export function DueDigestEmail({ recipientName, dueSoon, overdue }: DueDigestEmailProps) {
  const total = dueSoon.length + overdue.length;
  return (
    <EmailLayout preview={`You have ${total} payment reminder${total === 1 ? "" : "s"}`}>
      <Text style={styles.heading}>Payment reminders</Text>
      <Text style={styles.paragraph}>Hi {recipientName}, the following records need attention.</Text>
      {overdue.length > 0 && (
        <>
          <Text style={{ ...styles.paragraph, fontWeight: 700 }}>Overdue ({overdue.length})</Text>
          {overdue.map((r) => <RowBlock key={`${r.recordType}-${r.number}`} row={r} />)}
          <Hr />
        </>
      )}
      {dueSoon.length > 0 && (
        <>
          <Text style={{ ...styles.paragraph, fontWeight: 700 }}>Due soon ({dueSoon.length})</Text>
          {dueSoon.map((r) => <RowBlock key={`${r.recordType}-${r.number}`} row={r} />)}
        </>
      )}
      <Text style={styles.meta}>Automated reminder from TVPH. Ignore if already handled.</Text>
    </EmailLayout>
  );
}

export default DueDigestEmail;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest __tests__/lib/reminders/messages.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/reminders/messages.ts lib/email/templates/due-digest.tsx __tests__/lib/reminders/messages.test.ts
git commit -m "feat: reminder message formatters and digest email template"
```

---

### Task 5: Extend `email_log.kind` for the digest

**Files:**
- Create: `supabase/migrations/20260717_due_digest_email_kind.sql`
- Modify: `lib/email/send.ts:8-13` (add to `EmailKind` union)
- Test: `__tests__/supabase/due-digest-kind-migration.test.ts`

**Interfaces:**
- Produces: `email_log.kind` accepts `'due_reminder_digest'`; `EmailKind` union includes it.

- [ ] **Step 1: Write the failing test**

```typescript
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "supabase/migrations");
const filename = fs.readdirSync(dir).find((n) => n.endsWith("_due_digest_email_kind.sql"));
if (!filename) throw new Error("due digest kind migration is missing");
const sql = fs.readFileSync(path.join(dir, filename), "utf8");

it("adds due_reminder_digest to the email_log kind constraint", () => {
  expect(sql).toContain("email_log_kind_check");
  expect(sql).toContain("due_reminder_digest");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest __tests__/supabase/due-digest-kind-migration.test.ts`
Expected: FAIL — migration missing.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260717_due_digest_email_kind.sql` (preserve the existing values from `20260714083524_payment_reminder_engine.sql:51-54`):

```sql
alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check check (kind = any (array[
  'po_issued', 'po_pending_approval', 'doc_reminder', 'doc_request', 'invoice_due_reminder',
  'invoice_due_date', 'vendor_deadline_reminder', 'due_reminder_digest'
]));
```

- [ ] **Step 4: Add the kind to the TS union**

In `lib/email/send.ts`, extend `EmailKind`:

```typescript
export type EmailKind =
  | "po_issued"
  | "po_pending_approval"
  | "doc_reminder"
  | "doc_request"
  | "invoice_due_reminder"
  | "due_reminder_digest";
```

- [ ] **Step 5: Run the test + apply**

Run: `npx jest __tests__/supabase/due-digest-kind-migration.test.ts`
Expected: PASS. Apply via `apply_migration` (name `due_digest_email_kind`).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260717_due_digest_email_kind.sql lib/email/send.ts __tests__/supabase/due-digest-kind-migration.test.ts
git commit -m "feat: allow due_reminder_digest email kind"
```

---

### Task 6: Cron route orchestration

**Files:**
- Create: `app/api/cron/due-reminders/route.ts`
- Test: `__tests__/app/api/cron/due-reminders.test.ts`

**Interfaces:**
- Consumes: `createServiceRoleClient`; `resolveCapabilityRecipients` from `@/lib/notifications/recipients`; `createNotification`; `sendEmail`; `manilaDateString` from `@/lib/payment-terms`; `milestoneToFire`, `daysUntilDue`, `type MilestoneKey` from `@/lib/reminders/schedule`; `daysLabel`, `inAppMessage`, `DueDigestEmail`, `type DigestRow`.
- Produces: `POST` handler returning
  `{ processed, remindersSent, emailsSent, skippedNoDueDate, skippedNoMilestone, alreadySent }`.

**Algorithm (implement exactly):**
1. Auth: bearer check (copy from `invoice-due-reminders/route.ts:14-18`).
2. `today = manilaDateString()`.
3. Resolve recipients once: `resolveCapabilityRecipients('notification.payment_reminders')`, keep those with a valid email for the digest; all of them get in-app notifications.
4. Load eligible invoices (`status in ('approved','partially_paid')`, `deleted_at is null`, `due_date not null`) and POs (`status in ('issued','partially_paid')`, `deleted_at is null`, `due_date not null`) with vendor name; join `record_outstanding` (or query the view) and drop rows with `outstanding <= 0`. Count `skippedNoDueDate` from the null-due_date rows.
5. For each record: `days = daysUntilDue(due_date, today)`. Load prior `reminder_log` milestone_keys for `(record_type, record_id, due_date)` into a `Set<MilestoneKey>` (in_app channel is the milestone marker). `key = milestoneToFire(days, sent)`. If null → `skippedNoMilestone++`, continue. Otherwise build a `DigestRow` and, per recipient, create the in-app notification + queue the digest row.
6. In-app: for each record firing today, `createNotification({ type, ..., recipients: { profileIds: recipientIds }, link })` then insert a `reminder_log` row per recipient with `channel='in_app'`. Guard each insert with the unique index (`.upsert(..., { onConflict, ignoreDuplicates: true })` or catch 23505) so a re-run is a no-op.
7. Email: per recipient, split their queued rows into `overdue`/`dueSoon`, `sendEmail({ kind: 'due_reminder_digest', to: [email], react: DueDigestEmail(...) })`, then insert one `reminder_log` row per (record, milestone) with `channel='email'` — but only for rows not already email-logged (query first, or upsert-ignore).
8. Return the counts.

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/api/cron/due-reminders.test.ts`. Mock the service client, `resolveCapabilityRecipients`, `createNotification`, and `sendEmail`; assert (a) 401 without the bearer token, (b) a NULL-due_date record increments `skippedNoDueDate`, (c) an invoice 3 days out with an empty reminder_log triggers `createNotification` once and one digest `sendEmail` per recipient, (d) re-running with the reminder_log already containing that milestone yields `alreadySent` and no new sends.

```typescript
jest.mock("@/utils/supabase/service", () => ({ createServiceRoleClient: jest.fn() }));
jest.mock("@/lib/notifications/recipients", () => ({ resolveCapabilityRecipients: jest.fn() }));
jest.mock("@/utils/notifications", () => ({ createNotification: jest.fn() }));
jest.mock("@/lib/email/send", () => ({ sendEmail: jest.fn().mockResolvedValue({ status: "sent" }) }));

import { POST } from "@/app/api/cron/due-reminders/route";
import { resolveCapabilityRecipients } from "@/lib/notifications/recipients";
import { createNotification } from "@/utils/notifications";
import { sendEmail } from "@/lib/email/send";

const OLD_ENV = process.env;
beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...OLD_ENV, CRON_SECRET: "s3cret" };
  (resolveCapabilityRecipients as jest.Mock).mockResolvedValue([
    { id: "fin-1", email: "fin@x.com" },
  ]);
});
afterEach(() => { process.env = OLD_ENV; });

function req(auth?: string) {
  return { headers: { get: (k: string) => (k === "authorization" ? auth ?? null : null) } } as any;
}

it("rejects an unauthenticated call", async () => {
  const res = await POST(req());
  expect(res.status).toBe(401);
});

// Additional cases (b)–(d) build a mocked service client whose
// service_invoices/purchase_orders/record_outstanding/reminder_log queries return
// fixtures; assert createNotification and sendEmail call counts per the algorithm.
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest __tests__/app/api/cron/due-reminders.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Implement the route**

Create `app/api/cron/due-reminders/route.ts` implementing the algorithm above. Key skeleton (fill the query bodies against the mocked shapes your test uses; keep all date math via `manilaDateString`/`daysUntilDue`):

```typescript
import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { resolveCapabilityRecipients } from "@/lib/notifications/recipients";
import { createNotification, type NotificationType } from "@/utils/notifications";
import { sendEmail } from "@/lib/email/send";
import { manilaDateString } from "@/lib/payment-terms";
import { daysUntilDue, milestoneToFire, type MilestoneKey } from "@/lib/reminders/schedule";
import { daysLabel, inAppMessage, type DigestRow } from "@/lib/reminders/messages";
import { DueDigestEmail } from "@/lib/email/templates/due-digest";

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const today = manilaDateString();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://erp.telcovantage.com";

  const recipients = await resolveCapabilityRecipients("notification.payment_reminders");
  const recipientIds = recipients.map((r) => r.id);

  let skippedNoDueDate = 0, skippedNoMilestone = 0, alreadySent = 0, remindersSent = 0;
  // Per-recipient email queues.
  const queues = new Map<string, { dueSoon: DigestRow[]; overdue: DigestRow[] }>();
  for (const r of recipients) if (r.email) queues.set(r.id, { dueSoon: [], overdue: [] });

  // Build the eligible record list (invoices + POs) joined to record_outstanding.
  // Records with null due_date increment skippedNoDueDate. Pseudocode below —
  // implement the two queries and the outstanding join.
  type Eligible = {
    recordType: "invoice" | "po"; id: string; number: string;
    vendorName: string; dueDate: string; outstanding: number;
  };
  const eligible: Eligible[] = []; // populate from service_invoices + purchase_orders
  // ...load eligible, increment skippedNoDueDate for null due dates...

  for (const rec of eligible) {
    if (rec.outstanding <= 0) continue;
    const days = daysUntilDue(rec.dueDate, today);

    const { data: prior } = await supabase
      .from("reminder_log")
      .select("milestone_key")
      .eq("record_type", rec.recordType)
      .eq("record_id", rec.id)
      .eq("due_date", rec.dueDate)
      .eq("channel", "in_app");
    const sent = new Set<MilestoneKey>((prior ?? []).map((p) => p.milestone_key as MilestoneKey));

    const key = milestoneToFire(days, sent);
    if (!key) { skippedNoMilestone++; continue; }

    const path = rec.recordType === "invoice" ? "invoices" : "purchase-orders";
    const row: DigestRow = {
      recordType: rec.recordType,
      number: rec.number,
      vendorName: rec.vendorName,
      outstanding: rec.outstanding.toLocaleString(),
      dueDate: new Date(rec.dueDate).toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric" }),
      daysLabel: daysLabel(days),
      url: `${baseUrl}/dashboard/${path}/${rec.id}`,
    };

    // In-app: one personal notification per recipient (Plan 1 fan-out).
    const { title, message } = inAppMessage(row);
    await createNotification({
      type: rec.recordType as NotificationType,
      title,
      message,
      link: `/dashboard/${path}/${rec.id}`,
      recipients: { profileIds: recipientIds },
    });

    // Idempotency markers (in_app) + email queueing.
    for (const r of recipients) {
      const { error } = await supabase.from("reminder_log").upsert(
        { record_type: rec.recordType, record_id: rec.id, due_date: rec.dueDate, milestone_key: key, recipient_id: r.id, channel: "in_app" },
        { onConflict: "record_type,record_id,due_date,milestone_key,recipient_id,channel", ignoreDuplicates: true }
      );
      if (error) continue;
      const q = queues.get(r.id);
      if (q) (days < 0 ? q.overdue : q.dueSoon).push(row);
    }
    remindersSent++;
  }

  // Email digests, one per recipient with queued rows.
  let emailsSent = 0;
  for (const r of recipients) {
    const q = queues.get(r.id);
    if (!q || (q.dueSoon.length === 0 && q.overdue.length === 0) || !r.email) continue;
    const result = await sendEmail({
      kind: "due_reminder_digest",
      to: [r.email],
      subject: `You have ${q.dueSoon.length + q.overdue.length} payment reminder(s)`,
      react: DueDigestEmail({ recipientName: r.email, dueSoon: q.dueSoon, overdue: q.overdue }),
    });
    if (result.status === "sent") emailsSent++;
  }

  return Response.json({
    processed: eligible.length, remindersSent, emailsSent,
    skippedNoDueDate, skippedNoMilestone, alreadySent,
  });
}
```

Fill the `eligible` population (two Supabase queries + outstanding join) to match the fixtures in your test. Increment `alreadySent` when `milestoneToFire` returns null purely because every crossed milestone is already logged (distinguish from "no milestone crossed yet" if the test asserts it; otherwise fold into `skippedNoMilestone`).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/app/api/cron/due-reminders.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/due-reminders/route.ts __tests__/app/api/cron/due-reminders.test.ts
git commit -m "feat: recurring due-reminder cron orchestration"
```

---

### Task 7: Schedule the cron

**Files:**
- Create: `supabase/migrations/20260718_due_reminders_cron.sql`
- Test: `__tests__/supabase/due-reminders-cron-migration.test.ts`

**Interfaces:**
- Produces: `trigger_due_reminders()` + a daily `cron.schedule('due-reminders', ...)` POSTing `/api/cron/due-reminders`.

- [ ] **Step 1: Write the failing test**

```typescript
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "supabase/migrations");
const filename = fs.readdirSync(dir).find((n) => n.endsWith("_due_reminders_cron.sql"));
if (!filename) throw new Error("due-reminders cron migration is missing");
const sql = fs.readFileSync(path.join(dir, filename), "utf8");

it("schedules the due-reminders route via vault secrets", () => {
  expect(sql).toContain("/api/cron/due-reminders");
  expect(sql).toContain("cron.schedule");
  expect(sql).toContain("'due-reminders'");
  expect(sql).toContain("app_base_url");
  expect(sql).toContain("cron_secret");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest __tests__/supabase/due-reminders-cron-migration.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260718_due_reminders_cron.sql` (copy the vault-reading pattern from `20260703_invoice_due_reminders_cron.sql`; schedule at `30 0 * * *` = 08:30 PHT so it runs after the existing 00:00 UTC jobs):

```sql
create or replace function public.trigger_due_reminders()
returns void
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  base_url text;
  secret   text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'app_base_url';
  select decrypted_secret into secret   from vault.decrypted_secrets where name = 'cron_secret';
  if base_url is null or secret is null then
    raise notice 'due-reminders skipped: vault secret missing';
    return;
  end if;
  perform net.http_post(
    url     := base_url || '/api/cron/due-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body    := '{}'::jsonb
  );
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'due-reminders') then
    perform cron.unschedule('due-reminders');
  end if;
  perform cron.schedule('due-reminders', '30 0 * * *', $cron$ select public.trigger_due_reminders(); $cron$);
end $$;
```

- [ ] **Step 4: Run the test + apply**

Run: `npx jest __tests__/supabase/due-reminders-cron-migration.test.ts`
Expected: PASS. Apply via `apply_migration` (name `due_reminders_cron`).

- [ ] **Step 5: Retire the superseded invoice-only reminder**

The old `invoice-due-reminders` job (single 14-day, vendor-addressed) is superseded. In this same migration, unschedule it so reminders don't double-fire:

```sql
do $$
begin
  if exists (select 1 from cron.job where jobname = 'invoice-due-reminders') then
    perform cron.unschedule('invoice-due-reminders');
  end if;
end $$;
```

Leave the old route file in place (harmless, unscheduled) or delete `app/api/cron/invoice-due-reminders/route.ts` if no test references it — check with `grep -r invoice-due-reminders` first.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260718_due_reminders_cron.sql __tests__/supabase/due-reminders-cron-migration.test.ts
git commit -m "feat: schedule recurring due-reminders cron and retire the 14-day invoice job"
```

---

### Task 8: End-to-end verification

- [ ] **Step 1: Full suite + build**

Run: `npm run lint && npm run test && npm run build`
Expected: all PASS.

- [ ] **Step 2: Live dry-run against the dev DB**

With `CRON_SECRET` set, POST to the deployed/dev route and inspect the JSON counts against known due records:

```bash
curl -s -X POST "$APP_BASE_URL/api/cron/due-reminders" -H "Authorization: Bearer $CRON_SECRET" | jq
```

Confirm: counts are sane; a second immediate POST returns the same records under `alreadySent`/`skippedNoMilestone` with `emailsSent: 0` (idempotency holds); the bell shows one personal notification per recipient; the digest email lists correct amounts and days labels.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "chore: due-reminders verification fixes"
```

---

## Self-Review Notes

- **Spec coverage (issue #52 acceptance criteria):** milestone + daily-overdue schedule (Task 2); no duplicates on re-run (Task 3 unique index + Task 6 upsert-ignore); individual email + personal in-app per recipient (Task 6 via Plan 1); one user's read state isolated (Plan 1); links open correct record (Task 4 URLs); amount/due/days present (Tasks 4/6); resolved records stop immediately (eligibility query, Task 6 step 4); existing non-reminder notifications keep working (Plan 1); tests cover milestones/overdue/dedup/recipients/stop states (Tasks 2,3,6).
- **Deviations from the merged payment-reminder-engine design (deliberate, per grilling):** capability-scoped recipients instead of hardcoded finance/admin/superadmin lists; one digest email instead of per-record emails; excludes `disputed`; "largest-unsent milestone" instead of exact-day equality. Note these in the PR so reviewers see the supersession is intentional.
- **Type consistency:** `MilestoneKey` identical across `schedule.ts` and the route; `DigestRow` identical across `messages.ts`, `due-digest.tsx`, and the route; `resolveCapabilityRecipients` return shape (`{ id, email }`) matches Plan 1 Task 2.
- **Open implementation check flagged in Task 3:** confirm the `payments`→PO linkage column before finalizing the outstanding view.
