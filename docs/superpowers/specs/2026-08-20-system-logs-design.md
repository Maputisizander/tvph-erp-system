# System Logs Panel — Design

Date: 2026-08-20
Status: Approved inline by user (2026-08-20)

## Goal

Add a **Logs** section to the superadmin System panel (`/dashboard/system`)
showing recent service logs from **both Supabase and Vercel**, fetched server-side
via each provider's REST API and displayed in a client panel.

## Data sources

| Provider | Endpoint | Auth |
|---|---|---|
| Supabase | `GET https://api.supabase.com/v1/projects/{ref}/analytics/endpoints/logs.all` | `Authorization: Bearer <personal access token>` (+ `apikey` header, same token) |
| Vercel | `GET https://api.vercel.com/v1/projects/{projectId}/deployments/{deploymentId}/runtime-logs` | `Authorization: Bearer <vercel token>` |

Supabase Logs API takes query params `sql`, `iso_timestamp_start`,
`iso_timestamp_end`. Source tables queried: `postgres_logs`, `edge_logs`,
`function_edge_logs`, `auth_logs`, `storage_logs`.

Vercel runtime-logs returns an NDJSON stream; Vercel injects
`VERCEL_PROJECT_ID` and `VERCEL_DEPLOYMENT_ID` into the running deployment, so
no extra project/deployment config is needed. The stream is read with a hard
timeout (5s) to avoid hanging.

## Environment (all optional — panels degrade gracefully)

- `SUPABASE_ACCESS_TOKEN` — Supabase personal access token
- `SUPABASE_PROJECT_REF` — project ref (the `xxx` in `https://xxx.supabase.co`)
- `VERCEL_TOKEN` — Vercel API token

If missing, the corresponding panel shows "not configured" with setup hints.

## Retention

Free tiers: Supabase ~1 day, Vercel ~1 hour. Queries beyond retention simply
return fewer rows. Window options: 15m / 1h / 24h.

## Architecture

- `app/api/system/logs/route.ts` — single GET route. Re-checks superadmin via
  `getCurrentProfile`/`isSuperadmin`, then proxies to the provider named by
  `?provider=supabase|vercel` (plus `source`, `window` for supabase). Tokens
  never reach the client.
- `lib/system/logs.ts` — server-only fetch functions: `fetchSupabaseLogs(source, windowMinutes)`, `fetchVercelLogs()`.
- `components/dashboard/system/logs-panel.tsx` — client panel: Supabase/Vercel
  toggle, source dropdown, window dropdown, Refresh button, time + message
  table (newest first, capped at 50 rows).

## Data flow

1. `LogsPanel` mounts → GET `/api/system/logs?provider=supabase&source=postgres_logs&window=15m`
2. Route validates superadmin, calls provider fetch, returns `{ rows, error }`.
3. Panel renders rows or inline error / not-configured state.

## Error handling

- Non-superadmin → 401 from the route.
- Missing env token → 200 with `{ error: "not_configured" }` (panel shows hint).
- Provider HTTP errors / timeouts → `{ error: "Provider message" }` shown inline.

## Testing

- No pure logic worth unit-testing (thin fetch wrappers + proxy route). The
  existing `__tests__/lib/system-health.test.ts` is untouched.
- Verified by `npx tsc --noEmit`, `npx eslint`, `npx jest` (only pre-existing
  PO/PR suite failures).