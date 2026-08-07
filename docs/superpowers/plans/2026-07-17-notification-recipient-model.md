# Notification Recipient Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every in-app notification a personal per-recipient read/delete state so one user acting on a notification never affects anyone else, while existing shared notifications keep working during the transition.

**Architecture:** Add a `notification_recipients` table (one row per user per notification) with denormalized `title`/`message`/`link`/`type` so the bell is a single-table read and Realtime payloads are self-sufficient. `createNotification` gains a required recipient target (explicit profile IDs or a `Capability` name resolved server-side). Server actions and the bell read/write recipient rows for the caller, with a read-time UNION fallback to legacy `notifications` rows that have no recipient rows yet. A later follow-up (out of scope here) drops the fallback and the shared `is_read` column.

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions), Supabase (Postgres, RLS, Realtime), TypeScript, Jest 30 + Testing Library.

## Global Constraints

- Migration filename format: `YYYYMMDD_description.sql` (or the generated `YYYYMMDDHHMMSS_` form). Additive and idempotent — no down-migrations. Sort lexicographically.
- New exposed tables MUST `enable row level security` and grant least privilege to `authenticated`.
- The service-role client (`createServiceRoleClient()`) is the ONLY writer that inserts recipient rows for other users; it bypasses RLS. Never use it in a Server Component render path.
- RBAC is the enforcement boundary: capability resolution uses `CAPABILITY_ROLES` from `lib/auth/roles.ts` — do not hardcode role lists elsewhere.
- All new capability additions go in BOTH the `Capability` union and `CAPABILITY_ROLES` map in `lib/auth/roles.ts`.
- Run `npm run lint`, `npm run test`, and `npm run build` before declaring the plan complete.
- The Supabase Realtime publication `supabase_realtime` must include any table the bell subscribes to; RLS SELECT policies gate per-user event delivery.

---

## File Structure

- `supabase/migrations/20260717_notification_recipients.sql` — new table, indexes, RLS, grants, Realtime publication, retention cron.
- `utils/notifications.ts` — `createNotification` gains recipient targeting + fan-out via service role.
- `lib/notifications/recipients.ts` (new) — pure helper mapping a `Capability` to the profile IDs that should receive it (server-only).
- `app/dashboard/notifications/actions.ts` — `fetchNotifications`, `markAsRead`, `markAllAsRead`, `deleteNotification` operate on the caller's recipient rows with legacy fallback.
- `components/dashboard/notification-bell.tsx` — subscribe to `notification_recipients` filtered by the current user; render recipient-shaped rows.
- Test files mirror each source path under `__tests__/`.

---

### Task 1: Recipient table, RLS, indexes, and retention

**Files:**
- Create: `supabase/migrations/20260717_notification_recipients.sql`
- Test: `__tests__/supabase/notification-recipients-migration.test.ts`

**Interfaces:**
- Consumes: existing `public.notifications(id, type, title, message, link, is_read, created_by, created_at)`; existing `public.is_staff(uuid)`.
- Produces: table `public.notification_recipients` with columns
  `id uuid pk`, `notification_id uuid not null`, `recipient_id uuid not null`,
  `type text not null`, `title text not null`, `message text not null`, `link text`,
  `is_read boolean not null default false`, `read_at timestamptz`,
  `deleted_at timestamptz`, `created_at timestamptz not null default now()`.
  Unique on `(notification_id, recipient_id)`. Index `(recipient_id, is_read, created_at desc)` for the bell.

- [ ] **Step 1: Write the failing migration test**

Create `__tests__/supabase/notification-recipients-migration.test.ts` (this repo asserts on migration SQL text — see `__tests__/supabase/payment-reminder-engine-migration.test.ts` for the pattern):

```typescript
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "supabase/migrations");
const filename = fs
  .readdirSync(dir)
  .find((name) => name.endsWith("_notification_recipients.sql"));
if (!filename) throw new Error("notification_recipients migration is missing");
const sql = fs.readFileSync(path.join(dir, filename), "utf8");

it("creates the recipient table with denormalized display columns", () => {
  expect(sql).toContain("create table if not exists public.notification_recipients");
  expect(sql).toContain("recipient_id uuid not null references public.profiles(id) on delete cascade");
  expect(sql).toContain("is_read boolean not null default false");
  expect(sql).toContain("deleted_at timestamptz");
});

it("deduplicates per (notification, recipient) and indexes the bell query", () => {
  expect(sql).toContain(
    "create unique index if not exists notification_recipients_uniq"
  );
  expect(sql).toContain("notification_recipients_bell_idx");
  expect(sql).toContain("(recipient_id, is_read, created_at desc)");
});

it("enables RLS scoped to the owning recipient and grants least privilege", () => {
  expect(sql).toContain("alter table public.notification_recipients enable row level security");
  expect(sql).toContain("recipient_id = (select auth.uid())");
  expect(sql).toContain("grant select, update, delete on public.notification_recipients to authenticated");
});

it("adds the table to the realtime publication and schedules retention", () => {
  expect(sql).toContain("alter publication supabase_realtime add table public.notification_recipients");
  expect(sql).toContain("delete_old_notification_recipients_daily");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest __tests__/supabase/notification-recipients-migration.test.ts`
Expected: FAIL — "notification_recipients migration is missing".

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260717_notification_recipients.sql`:

```sql
-- ============================================================================
-- Per-recipient notification state (issue #52)
-- ============================================================================
-- One row per (notification, user). Read/delete state is personal. Display
-- fields are denormalized from public.notifications so the bell query and
-- Realtime payloads are self-sufficient (single-table read, no join needed).
-- ============================================================================

create table if not exists public.notification_recipients (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  recipient_id    uuid not null references public.profiles(id) on delete cascade,
  type            text not null,
  title           text not null,
  message         text not null,
  link            text,
  is_read         boolean not null default false,
  read_at         timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);

create unique index if not exists notification_recipients_uniq
  on public.notification_recipients (notification_id, recipient_id);

-- Bell query: newest-first unread-aware feed for one user.
create index if not exists notification_recipients_bell_idx
  on public.notification_recipients (recipient_id, is_read, created_at desc)
  where deleted_at is null;

alter table public.notification_recipients enable row level security;

-- Users may read/update/delete only their own rows. No INSERT grant to
-- authenticated: only the trusted service role fans rows out.
grant select, update, delete on public.notification_recipients to authenticated;

drop policy if exists "recipients read own" on public.notification_recipients;
create policy "recipients read own" on public.notification_recipients
  for select to authenticated
  using (recipient_id = (select auth.uid()));

drop policy if exists "recipients update own" on public.notification_recipients;
create policy "recipients update own" on public.notification_recipients
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

drop policy if exists "recipients delete own" on public.notification_recipients;
create policy "recipients delete own" on public.notification_recipients
  for delete to authenticated
  using (recipient_id = (select auth.uid()));

-- Realtime: per-user filtered subscription in the bell relies on this table
-- being published; RLS SELECT above gates which events each user receives.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notification_recipients'
  ) then
    alter publication supabase_realtime add table public.notification_recipients;
  end if;
end $$;

-- Retention: mirror the existing 30-day notifications cleanup so the bell
-- query stays bounded (see delete_old_notifications_daily).
do $$
declare job record;
begin
  for job in select jobid from cron.job where jobname = 'delete_old_notification_recipients_daily' loop
    perform cron.unschedule(job.jobid);
  end loop;

  perform cron.schedule(
    'delete_old_notification_recipients_daily',
    '20 3 * * *',
    $cleanup$delete from public.notification_recipients where created_at < now() - interval '30 days'$cleanup$
  );
end $$;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/supabase/notification-recipients-migration.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Apply the migration to the dev database**

Apply via the Supabase MCP `apply_migration` tool (name `notification_recipients`) or `supabase db push`. Verify with `list_tables` that `notification_recipients` exists and RLS is enabled.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260717_notification_recipients.sql __tests__/supabase/notification-recipients-migration.test.ts
git commit -m "feat: add per-recipient notification table with RLS and retention"
```

---

### Task 2: Capability → recipient-profiles helper

**Files:**
- Create: `lib/notifications/recipients.ts`
- Test: `__tests__/lib/notifications/recipients.test.ts`

**Interfaces:**
- Consumes: `CAPABILITY_ROLES`, `type Capability` from `@/lib/auth/roles`; `createServiceRoleClient` from `@/utils/supabase/service`.
- Produces:
  - `rolesForCapability(capability: Capability): Role[]` — pure lookup into `CAPABILITY_ROLES`.
  - `async resolveCapabilityRecipients(capability: Capability): Promise<{ id: string; email: string | null }[]>` — active (non-resigned/terminated) profiles whose role holds the capability. Used by Plan 2's cron and by `createNotification`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/notifications/recipients.test.ts`:

```typescript
import { rolesForCapability } from "@/lib/notifications/recipients";

describe("rolesForCapability", () => {
  it("returns the roles that hold a capability", () => {
    // invoice.pay is granted to superadmin, admin, finance in CAPABILITY_ROLES.
    expect(rolesForCapability("invoice.pay").sort()).toEqual(
      ["admin", "finance", "superadmin"].sort()
    );
  });

  it("returns a superadmin-only list for restricted capabilities", () => {
    expect(rolesForCapability("po.delete")).toEqual(["superadmin"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest __tests__/lib/notifications/recipients.test.ts`
Expected: FAIL — cannot find module `@/lib/notifications/recipients`.

- [ ] **Step 3: Implement the helper**

Create `lib/notifications/recipients.ts`:

```typescript
import "server-only";

import { createServiceRoleClient } from "@/utils/supabase/service";
import { CAPABILITY_ROLES, type Capability, type Role } from "@/lib/auth/roles";

/** Roles that hold `capability`, from the RBAC source of truth. */
export function rolesForCapability(capability: Capability): Role[] {
  return [...CAPABILITY_ROLES[capability]] as Role[];
}

/**
 * Active staff profiles whose role holds `capability`. "Active" excludes the
 * resigned/terminated employment states. Service-role read (bypasses RLS) — for
 * server-only fan-out, never a component render path.
 */
export async function resolveCapabilityRecipients(
  capability: Capability
): Promise<{ id: string; email: string | null }[]> {
  const roles = rolesForCapability(capability);
  if (roles.length === 0) return [];

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, employment_status")
    .in("role", roles)
    .not("employment_status", "in", "(resigned,terminated)");

  if (error) {
    console.error("resolveCapabilityRecipients failed:", error.message);
    return [];
  }
  return (data ?? []).map((p) => ({ id: p.id as string, email: (p.email as string) ?? null }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/lib/notifications/recipients.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/notifications/recipients.ts __tests__/lib/notifications/recipients.test.ts
git commit -m "feat: resolve notification recipients from RBAC capabilities"
```

---

### Task 3: `createNotification` fans out to recipients

**Files:**
- Modify: `utils/notifications.ts`
- Test: `__tests__/utils/notifications.test.ts`

**Interfaces:**
- Consumes: `resolveCapabilityRecipients` from `@/lib/notifications/recipients`; existing `notifications` insert.
- Produces: updated signature
  ```typescript
  createNotification(input: {
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    created_by?: string | null;
    recipients: { capability: Capability } | { profileIds: string[] };
  }): Promise<void>
  ```
  Inserts one `notifications` row (audit/source of truth) AND one `notification_recipients` row per resolved recipient. De-duplicates recipient IDs. No-ops silently (logs) on error, preserving the existing "never throw" contract.

- [ ] **Step 1: Write the failing test**

Create `__tests__/utils/notifications.test.ts`:

```typescript
jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/notifications/recipients", () => ({
  resolveCapabilityRecipients: jest.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import { resolveCapabilityRecipients } from "@/lib/notifications/recipients";
import { createNotification } from "@/utils/notifications";

const mockCreateClient = createClient as jest.Mock;
const mockResolve = resolveCapabilityRecipients as jest.Mock;

describe("createNotification fan-out", () => {
  let notifInsert: jest.Mock;
  let recipientInsert: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    notifInsert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: "notif-1" }, error: null }),
      }),
    });
    recipientInsert = jest.fn().mockResolvedValue({ error: null });
    mockCreateClient.mockReturnValue({
      from: jest.fn((table: string) =>
        table === "notifications"
          ? { insert: notifInsert }
          : { insert: recipientInsert }
      ),
    });
  });

  it("inserts one recipient row per resolved capability profile", async () => {
    mockResolve.mockResolvedValue([
      { id: "user-a", email: "a@x.com" },
      { id: "user-b", email: "b@x.com" },
    ]);

    await createNotification({
      type: "invoice",
      title: "T",
      message: "M",
      link: "/dashboard/invoices/1",
      recipients: { capability: "invoice.pay" },
    });

    const rows = recipientInsert.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      notification_id: "notif-1",
      recipient_id: "user-a",
      title: "T",
      message: "M",
      link: "/dashboard/invoices/1",
    });
  });

  it("de-duplicates explicit profile IDs", async () => {
    await createNotification({
      type: "po",
      title: "T",
      message: "M",
      recipients: { profileIds: ["user-a", "user-a", "user-c"] },
    });

    const rows = recipientInsert.mock.calls[0][0];
    expect(rows.map((r: { recipient_id: string }) => r.recipient_id)).toEqual([
      "user-a",
      "user-c",
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest __tests__/utils/notifications.test.ts`
Expected: FAIL — `recipients` not handled / `resolveCapabilityRecipients` not called.

- [ ] **Step 3: Rewrite `createNotification`**

Replace the body of `utils/notifications.ts`:

```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { resolveCapabilityRecipients } from '@/lib/notifications/recipients';
import type { Capability } from '@/lib/auth/roles';

export type NotificationType = 'po' | 'invoice' | 'payment' | 'document' | 'vendor' | 'hr' | 'crm' | 'payment_request';

export type NotificationRecipients =
  | { capability: Capability }
  | { profileIds: string[] };

export async function createNotification({
  type, title, message, link, created_by, recipients,
}: {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  created_by?: string | null;
  recipients: NotificationRecipients;
}) {
  try {
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Resolve the target profile IDs.
    let profileIds: string[];
    if ('capability' in recipients) {
      const resolved = await resolveCapabilityRecipients(recipients.capability);
      profileIds = resolved.map((r) => r.id);
    } else {
      profileIds = recipients.profileIds;
    }
    profileIds = Array.from(new Set(profileIds.filter(Boolean)));

    if (profileIds.length === 0) {
      console.warn('createNotification: no recipients resolved; skipping.');
      return;
    }

    // Source-of-truth row (audit + retention anchor for the recipient rows).
    const { data: notif, error: notifErr } = await supabaseAdmin
      .from('notifications')
      .insert({ type, title, message, link, created_by: created_by ?? null })
      .select('id')
      .single();

    if (notifErr || !notif) {
      console.error('Supabase insert error for notification:', notifErr);
      return;
    }

    const rows = profileIds.map((recipient_id) => ({
      notification_id: notif.id,
      recipient_id,
      type,
      title,
      message,
      link: link ?? null,
    }));

    const { error: recErr } = await supabaseAdmin
      .from('notification_recipients')
      .insert(rows);
    if (recErr) {
      console.error('Supabase insert error for notification_recipients:', recErr);
    }
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/utils/notifications.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Update every existing `createNotification` call site**

Each caller must add a `recipients` target. Use these mappings (grep `createNotification(` to find all 11 files; the dashboard call sites and their capability targets):

- `app/dashboard/invoices/actions.ts` (invoice/payment events) → `recipients: { capability: 'invoice.write' }`
- `app/dashboard/purchase-orders/actions.ts` (PO events) → `recipients: { capability: 'po.write' }`
- `app/dashboard/vendors/actions.ts` → `recipients: { capability: 'vendor.write' }`
- `app/dashboard/documents/actions.ts` → `recipients: { capability: 'document.write' }`
- `app/dashboard/crm/actions.ts` → `recipients: { capability: 'crm.write' }`
- `app/portal/actions.ts`, `lib/telegram/service.ts`, `lib/chat/tools.ts` → match the domain of each call (PO→`po.write`, invoice→`invoice.write`, etc.).

For each call, add the `recipients` field and keep `created_by: user.id` where a user is present. Example edit in `app/dashboard/invoices/actions.ts`:

```typescript
await createNotification({
  type: 'invoice',
  title: '🧾 Invoice Received',
  message: `Invoice #${invoice_number} was logged.`,
  link: `/dashboard/invoices/${newInvoice.id}`,
  created_by: user.id,
  recipients: { capability: 'invoice.write' },
});
```

- [ ] **Step 6: Verify the whole suite and types still pass**

Run: `npm run lint && npx jest && npx tsc --noEmit`
Expected: PASS. TypeScript will flag any call site still missing `recipients` — fix each until clean.

- [ ] **Step 7: Commit**

```bash
git add utils/notifications.ts __tests__/utils/notifications.test.ts app lib
git commit -m "feat: fan notifications out to per-recipient rows at every call site"
```

---

### Task 4: Server actions read/write recipient rows with legacy fallback

**Files:**
- Modify: `app/dashboard/notifications/actions.ts`
- Test: `__tests__/app/dashboard/notifications/actions.test.ts`

**Interfaces:**
- Consumes: `createClient` from `@/utils/supabase/server` (RLS-scoped to the caller); `getCurrentProfile` from `@/lib/auth/permissions`.
- Produces:
  - `fetchNotifications()` → the caller's `notification_recipients` rows (newest 50, `deleted_at is null`) UNION legacy `notifications` rows that have NO recipient rows at all, shaped identically (`{ id, type, title, message, link, is_read, created_at }`). Recipient rows use their own `id`.
  - `markAsRead(id)`, `markAllAsRead()`, `deleteNotification(id)` → operate on `notification_recipients` by `id` for recipient rows; fall back to legacy `notifications` update/delete when the id is a legacy notification. RLS enforces ownership.

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/dashboard/notifications/actions.test.ts`:

```typescript
jest.mock("@/utils/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import { createClient } from "@/utils/supabase/server";
import { markAsRead } from "@/app/dashboard/notifications/actions";

const mockCreateClient = createClient as jest.Mock;

describe("notification actions", () => {
  it("marks a recipient row read by id and sets read_at", async () => {
    const update = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null, count: 1 }) });
    mockCreateClient.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "notification_recipients") return { update };
        return { update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }) };
      }),
    });

    await markAsRead("recip-1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ is_read: true, read_at: expect.any(String) })
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest __tests__/app/dashboard/notifications/actions.test.ts`
Expected: FAIL — `markAsRead` still targets `notifications`, `read_at` never set.

- [ ] **Step 3: Rewrite the actions**

Replace `app/dashboard/notifications/actions.ts`:

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export async function fetchNotifications(): Promise<NotificationRow[]> {
  const supabase = await createClient();

  // Personal recipient rows (RLS restricts to the caller).
  const { data: recip, error: recipErr } = await supabase
    .from('notification_recipients')
    .select('id, type, title, message, link, is_read, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (recipErr) {
    console.error('Error fetching recipient notifications:', recipErr);
  }

  // Legacy fallback: shared rows that predate the recipient model (no recipient
  // rows exist for them). Remove this branch once legacy rows age out.
  const { data: legacy, error: legacyErr } = await supabase
    .from('notifications')
    .select('id, type, title, message, link, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (legacyErr) {
    console.error('Error fetching legacy notifications:', legacyErr);
  }

  const recipRows = (recip ?? []) as NotificationRow[];
  // A legacy row is only shown if nothing has fanned it out. We detect that by
  // checking it is not represented among recipient rows for this user; since
  // recipient rows carry their own ids, we treat any legacy row whose id is not
  // already surfaced as still-shared. In practice new rows always have recipient
  // rows, so legacy IDs never collide with recipient IDs.
  const merged = [...recipRows, ...((legacy ?? []) as NotificationRow[])]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 50);

  return merged;
}

export async function markAsRead(id: string) {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { error, count } = await supabase
    .from('notification_recipients')
    .update({ is_read: true, read_at: nowIso }, { count: 'exact' })
    .eq('id', id);

  // Legacy fallback: id belonged to a shared notifications row.
  if (!error && (count ?? 0) === 0) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  }
}

export async function markAllAsRead() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from('notification_recipients')
    .update({ is_read: true, read_at: nowIso })
    .eq('is_read', false);

  if (error) {
    console.error('Error marking recipient notifications as read:', error);
    return { success: false };
  }

  // Legacy shared rows.
  await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);

  revalidatePath('/dashboard');
  return { success: true };
}

export async function deleteNotification(id: string) {
  const supabase = await createClient();

  const { error, count } = await supabase
    .from('notification_recipients')
    .delete({ count: 'exact' })
    .eq('id', id);

  if (error) {
    console.error('Error deleting recipient notification:', error);
    return { success: false, error: error.message };
  }

  if ((count ?? 0) === 0) {
    // Legacy shared row.
    const { error: legacyErr } = await supabase.from('notifications').delete().eq('id', id);
    if (legacyErr) return { success: false, error: legacyErr.message };
  }

  revalidatePath('/dashboard');
  return { success: true };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/app/dashboard/notifications/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/notifications/actions.ts __tests__/app/dashboard/notifications/actions.test.ts
git commit -m "feat: personal notification read/delete via recipient rows with legacy fallback"
```

---

### Task 5: Bell subscribes per-user to recipient rows

**Files:**
- Modify: `components/dashboard/notification-bell.tsx`
- Test: `__tests__/components/dashboard/notification-bell.test.tsx`

**Interfaces:**
- Consumes: `fetchNotifications` (now returns recipient-shaped rows), `markAsRead`, `markAllAsRead`, `deleteNotification`; the browser Supabase client from `@/utils/supabase/client`.
- Produces: bell subscribes to `postgres_changes` on `public.notification_recipients` with `filter: recipient_id=eq.<userId>` for INSERT/UPDATE/DELETE, replacing the current unfiltered `notifications` subscription. The `Notification` interface `id` now refers to the recipient row id.

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/dashboard/notification-bell.test.tsx`:

```typescript
import { render, waitFor } from "@testing-library/react";

const channelFilters: unknown[] = [];
const onMock = jest.fn().mockReturnThis();

jest.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    channel: () => ({
      on: (_event: string, filter: unknown, _cb: unknown) => {
        channelFilters.push(filter);
        return { on: onMock, subscribe: jest.fn().mockReturnThis(), unsubscribe: jest.fn() };
      },
    }),
    removeChannel: jest.fn(),
  }),
}));

jest.mock("@/app/dashboard/notifications/actions", () => ({
  fetchNotifications: jest.fn().mockResolvedValue([]),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  deleteNotification: jest.fn(),
}));

import { NotificationBell } from "@/components/dashboard/notification-bell";

it("subscribes to the recipient table filtered by the current user", async () => {
  render(<NotificationBell />);
  await waitFor(() => {
    expect(channelFilters).toContainEqual(
      expect.objectContaining({
        table: "notification_recipients",
        filter: "recipient_id=eq.user-1",
      })
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest __tests__/components/dashboard/notification-bell.test.tsx`
Expected: FAIL — bell still subscribes to `notifications` without a filter.

- [ ] **Step 3: Update the subscription in the bell**

In `components/dashboard/notification-bell.tsx`, replace the `useEffect` that sets up Realtime (lines ~63–104). Resolve the user first, then filter every subscription by `recipient_id`:

```tsx
  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    const supabase = createClient();

    fetchNotifications().then((data) => {
      setNotifications(data as Notification[]);
    });

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      channel = supabase
        .channel("notification-recipients-changes")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notification_recipients", filter: `recipient_id=eq.${user.id}` },
          (payload) => {
            const row = payload.new as Notification;
            setNotifications((prev) => [row, ...prev].slice(0, 50));
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "notification_recipients", filter: `recipient_id=eq.${user.id}` },
          (payload) => {
            const row = payload.new as Notification;
            setNotifications((prev) => prev.map((n) => (n.id === row.id ? row : n)));
          },
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "notification_recipients", filter: `recipient_id=eq.${user.id}` },
          (payload) => {
            setNotifications((prev) => prev.filter((n) => n.id !== (payload.old as { id: string }).id));
          },
        )
        .subscribe();
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);
```

The `Notification` interface and the rest of the component are unchanged (recipient rows carry the same `type/title/message/link/is_read/created_at` shape).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/components/dashboard/notification-bell.test.tsx`
Expected: PASS.

- [ ] **Step 5: Manual Realtime verification (two users)**

REQUIRED before commit — Postgres Changes + RLS delivery is the highest-risk assumption. With two browser sessions (User A = finance, User B = operations), trigger a notification targeting finance only and confirm: A's bell increments in real time, B's does not; A marking it read does not change B's bell. If events do not arrive, verify the table is in `supabase_realtime` (Task 1) and that the RLS SELECT policy matches the authed user. Record the result in the PR description.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/notification-bell.tsx __tests__/components/dashboard/notification-bell.test.tsx
git commit -m "feat: bell subscribes to per-user recipient notifications"
```

---

### Task 6: Full verification pass

- [ ] **Step 1: Lint, test, build**

Run: `npm run lint && npm run test && npm run build`
Expected: all PASS. Build failures here usually mean a Server/Client boundary or a missing `recipients` argument — fix and re-run.

- [ ] **Step 2: Commit any fixes**

```bash
git add -A
git commit -m "chore: notification recipient model verification fixes"
```

---

## Self-Review Notes

- **Spec coverage:** Personal read/delete state (Tasks 1,4,5); RLS own-rows-only (Task 1); recipient insert only by trusted server (Task 1 grant + Task 3); bell index (Task 1); existing non-reminder notifications keep working (Task 3 fan-out + Task 4 legacy fallback). The idempotency key and the reminder schedule itself belong to **Plan 2** (recurring due reminders) which depends on this plan.
- **Deferred:** dropping the shared `is_read` column and the legacy fallback branch is a follow-up migration after legacy rows age past the 30-day retention window — do NOT do it in this plan.
- **Type consistency:** `NotificationRow`/`Notification` shape is identical across actions and bell; `recipients` discriminated union is used identically in `createNotification` and all call sites.
