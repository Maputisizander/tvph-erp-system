# Performance and Release Hardening Design

**Date:** 2026-07-21

**Status:** Approved

## Goal

Remove the identified production blockers and performance bottlenecks without changing intended ERP behavior, automatically rewriting financial records, or coupling unrelated fixes into one release.

## Constraints

- `20260721_remove_invoice_approval.sql` is already applied in production and must remain unchanged as migration history.
- All database corrections must use new forward-only migrations.
- Existing invoice creation, explicit overage confirmation, document browsing, reports, and search result shapes must remain compatible during rollout.
- Financial inconsistencies must be reported for manual reconciliation, never silently corrected.
- No new runtime dependencies or caching layers are required.
- The Vendor Performance, AP Aging, and Tax Summary pages are outside this scope; their dead navigation entries will be removed.

## Delivery Architecture

Work is split into independently deployable phases:

1. Production database safety.
2. Application alignment and regression coverage.
3. Lint and navigation hygiene.
4. Measured performance improvements, one hotspot per change.

Each phase must pass its own verification gate. Database safety ships before performance work.

## Phase 1: Production Database Safety

### Preflight audit

Run read-only production queries that report:

- payment requests whose active consuming invoices exceed the approved amount;
- invoices with negative `carry_forward_amount`;
- execute privileges on `sync_payment_request_invoiced_status(uuid)`;
- the current execution plan for active invoices filtered by `payment_request_id`.

Store only aggregate counts and query plans in deployment notes. Do not export production row data.

### Corrective migration

Create a new migration after `20260721_remove_invoice_approval.sql`. It will:

- add `overage_confirmed boolean not null default false` if it does not already exist;
- backfill the field for existing intentional overages identified by negative `carry_forward_amount`;
- add `service_invoices_payment_request_active_idx` on `service_invoices(payment_request_id)` for non-deleted invoices in `pending_payment`, `partially_paid`, or `paid` status;
- revoke execution of the privileged payment-request synchronization function from `PUBLIC`, `anon`, and `authenticated`;
- install a `BEFORE INSERT` trigger named `service_invoice_guard_pr_balance`, backed by `guard_service_invoice_payment_request_balance()`, for invoices linked to payment requests.

The guard locks the referenced payment-request row, recalculates active consumed balance, and computes the authoritative carry-forward value. It rejects an accidental over-reservation with SQLSTATE `P0001` and message `PAYMENT_REQUEST_BALANCE_CONFLICT` unless the incoming record explicitly indicates overage confirmation. For compatibility with the application already deployed in production, a negative incoming `carry_forward_amount` also counts as explicit confirmation during the transition. Confirmed overages record the authenticated actor and timestamp using the existing override columns.

The existing after-write synchronization trigger remains responsible for toggling payment-request status. Existing over-consumed records are not modified.

### Deployment compatibility

The migration deploys before the application update. Both the current and updated application payloads work with the new guard. Rolling the application back therefore does not require rolling back the database migration.

Database changes are never undone by editing applied migration files. Any later correction is another reviewed forward migration.

## Phase 2: Application Alignment

Update invoice creation to persist explicit overage confirmation and use the database-computed carry-forward value as authoritative. Preserve the existing form, confirmation checkbox, error wording, redirects, audit logging, and storage workflow.

Map the database balance-conflict error to the existing recoverable overage response. Other database failures continue to use the existing generic error path.

The payment-request selector will replace its per-request invoice lookups with one batched invoice query and in-memory grouping. Its public return shape remains unchanged.

## Phase 3: Release Hygiene

Add `.worktrees/**` to ESLint global ignores, then fix the ten lint errors remaining in the main worktree. Do not weaken rules to hide failures.

Remove these navigation entries without adding replacement pages:

- `/dashboard/vendors/performance`
- `/dashboard/accounting/ap-aging`
- `/dashboard/accounting/tax`

No other navigation or role visibility changes are included.

## Phase 4: Performance Improvements

### Payment-request selector

Fetch payment requests once and active consuming invoices once, using a batched `payment_request_id` filter. Aggregate consumed and remaining amounts in memory. The number of Supabase data requests stays at two regardless of payment-request count.

### Document center

Flatten documents by storage bucket, sign all paths with one request per bucket, then restore the existing company, vendor, and customer data structures. Search behavior, tabs, document metadata, and component props remain unchanged.

### Accounting and AP aging

Add `get_accounting_overview(p_today date)` as a `SECURITY INVOKER` database function returning the existing AP-aging rows, tax totals, outstanding totals, paid totals, and expense-category totals as JSONB. Revoke default public execution, grant execution to `authenticated`, and enforce the existing `superadmin`, `admin`, or `finance` role check inside the query.

Use the function from both the accounting page and AP-aging PDF route so financial rules continue to have one source of truth. During migration, compare its staging output against the existing `computeApAging` fixtures. Remove the TypeScript calculation only after parity passes.

### Global search

Replace the ten application-level Supabase requests with `global_search(p_query text)`, a `SECURITY INVOKER` database function that returns the same ten categories and at most five results per category. Revoke default public execution, grant execution to `authenticated`, and preserve the current minimum query length and 300 ms debounce.

Use `EXPLAIN (ANALYZE, BUFFERS)` on staging-like data. Add trigram indexes only to searched expressions that still show material sequential-scan cost; do not index every field speculatively.

### Unbounded list pages

Reuse the existing `LIST_PAGE_SIZE`, `parsePage`, `pageRange`, and `Pagination` components for assets, HR, CRM customers, and vendor contracts. Each query uses deterministic ordering and database counts.

CRM contact loading is limited to accounts on the current page. Compliance and document-center summaries are computed independently of their paginated entity rows so totals stay accurate.

No cache is introduced for financial or permission-sensitive results.

## Error Handling

- Balance conflicts are recoverable validation errors and must not leave an invoice row behind.
- Storage failures retain the existing cleanup behavior.
- Migration preflight inconsistencies create reconciliation work items rather than blocking unrelated reads.
- RPC authorization failures return the same unauthorized/forbidden behavior as current capability checks.
- Partial performance-data failures use the existing empty/error UI states; they do not return misleading financial totals.

## Testing Strategy

### Automated checks

- Static migration tests assert the partial index, row lock, permission revocation, backward-compatibility branch, and explicit-overage behavior.
- Server-action tests cover normal reservation, explicit overage, accidental overage, and database balance-conflict mapping.
- A staging integration check launches two concurrent reservations against one payment request and verifies that only a valid combination commits.
- Existing AP-aging fixtures serve as parity cases for the database aggregation output.
- Request-count tests or mocks verify two payment-selector data requests and one signing request per storage bucket.
- Pagination tests verify page boundaries, counts, filters, deterministic ordering, and empty pages.
- Search contract tests verify all ten result categories and the five-item cap.

### Release gates

Every deployable phase must pass:

```text
npm run lint
npm test -- --runInBand
npm run build
```

Database phases additionally require staging migration success, the concurrent reservation check, Supabase database advisors, and post-migration read-only verification.

## Measurement and Rollout

Record baseline and post-change values for database request count, returned row count, relevant execution plans, and page response time. Deploy one performance hotspot at a time and observe balance-conflict errors, RPC errors, and page latency before proceeding.

Application rollback uses the previous application artifact. The protective database guard, index, and permission revocations remain installed. Disabling or changing them requires a separate forward migration and review.

## Out of Scope

- Building Vendor Performance, standalone AP Aging, or Tax Summary pages.
- Redesigning current screens.
- Adding caching infrastructure, queues, search services, or new third-party packages.
- Automatically reconciling existing production financial discrepancies.
