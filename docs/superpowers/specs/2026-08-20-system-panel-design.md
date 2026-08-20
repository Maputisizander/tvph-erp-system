# System Panel (superadmin-only) — Design

Date: 2026-08-20
Status: Approved

## Goal

A superadmin-only `/dashboard/system` page showing storage usage, the deployed
app version (from Vercel), and a service health-check list.

## Access

- Route `app/dashboard/system/page.tsx` (server component).
- Hard gate: non-superadmin roles are redirected away (redirect to `/dashboard`).
  Uses `isSuperadmin` + `getCurrentProfile` from `lib/auth/permissions.ts`.
- Sidebar: new `System` item in `MODULE_CONFIG` (`components/dashboard/sidebar.tsx`)
  with `roles: ["superadmin"]`, placed after Audit Logs.

## Storage panel

Supabase Storage (S3-compatible) usage = sum of object sizes per bucket.

- Migration `20260820_storage_usage.sql`:
  - `storage_usage()` SQL function (security definer, search_path `storage, public`)
    returning `(bucket_id text, files bigint, bytes bigint)` grouped from
    `storage.objects`. Called via service-role RPC — avoids pulling every row.
  - `system_settings.storage_quota_bytes bigint` (nullable) — plan quota set by
    the superadmin.
- Helper `lib/system/storage.ts` → `fetchStorageUsage(supabase)` returns
  per-bucket rows + total bytes.
- Display: per-bucket used bytes + file count, total used. If quota is set,
  show `used / quota` + progress bar; otherwise "no quota configured".
- Quota editing: small client form (`components/dashboard/system/quota-form.tsx`)
  posting to `saveStorageQuota` server action in
  `app/dashboard/system/actions.ts` (gated superadmin), then `revalidatePath`.

## Version panel

Server component reads Vercel-provided env vars (set automatically on Vercel;
absent elsewhere):

- `VERCEL_GIT_COMMIT_SHA` (7-char short), `VERCEL_GIT_COMMIT_REF`,
  `VERCEL_ENV`, `VERCEL_DEPLOYMENT_ID`, `VERCEL_GIT_COMMIT_MESSAGE`
- App version from `package.json`
- Fallback when none present: "not deployed on Vercel".

## Health checks

Computed server-side (`lib/system/health.ts`), each fails independently:

| Check | Signal | ok | warn | error |
|-------|--------|----|------|-------|
| Postgres | `select now()` via service client + latency | ok | — | query throws |
| Email (Resend) | `RESEND_API_KEY` + `EMAIL_FROM` configured; age of last `email_log` row | configured + recent | stale send | missing config |
| Node-status cron | age of latest `vendor_sync_state.updated_at` | ≤30 min | ≤2 h | older / none |

Pure helpers (`classifyEmail`, `classifyNodeSync`) are unit-tested.

## Error handling

Each panel/check is wrapped in try/catch; a failure renders its error inline
and the rest of the page still renders.

## Files

- `supabase/migrations/20260820_storage_usage.sql`
- `lib/system/storage.ts`, `lib/system/health.ts`, `lib/system/format.ts`
- `app/dashboard/system/page.tsx`, `app/dashboard/system/actions.ts`
- `components/dashboard/system/{storage-panel,version-panel,health-panel,quota-form}.tsx`
- `components/dashboard/sidebar.tsx` (edit)
- `__tests__/lib/system/health.test.ts`