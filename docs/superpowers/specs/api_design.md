# External Project Progress Receiver API Design

## Purpose

Receive lightweight project-node progress events from one external system without
changing the ERP's existing project lifecycle or completion calculations.

The external system supplies:

- vendor/subcontractor name;
- project name;
- node identifier;
- node status.

The receiver adds the integration metadata required for reliable delivery:

- `event_id`;
- `occurred_at`;
- `schema_version`.

## Existing ERP Context

- `vendors` and `projects` use internal UUID primary keys.
- Projects and vendors are linked through `project_vendors`.
- Project lifecycle status uses `active`, `completed`, `on_hold`, or `cancelled`.
- Project completion shown in the project detail flow is derived from approved PO
  completion certificates.
- `projects.completion_pct` also exists, but this integration must not write it.
- Existing inbound routes already use server-only secrets and service-role database
  access.

The external node feed is therefore a separate source of operational progress. It
must not overwrite:

- `projects.status`;
- `projects.completion_pct`;
- PO completion certificates;
- billing or payment state.

## Goals

- Accept one small event when a node becomes `ongoing` or `finished`.
- Match the submitted names to existing ERP vendor and project records.
- Reject missing, ambiguous, or invalid relationships explicitly.
- Make duplicate delivery safe through `event_id`.
- Enforce a monotonic `ongoing -> finished` lifecycle.
- Preserve a compact event audit while keeping current-state reads fast.
- Keep receiver work to one authenticated HTTP request and one atomic database call.
- Avoid polling, queues, workers, callbacks, and realtime processing in v1.

## Non-Goals

- Calculating project completion percentage.
- Accepting arbitrary or user-defined status values.
- Creating vendors, projects, or vendor-project links from external events.
- Fuzzy-matching names.
- Moving a node between vendors.
- Batch ingestion.
- Adding an integration dashboard, notification, or analytics service.
- Updating ERP project, PO, invoice, billing, or certificate records.

## Chosen Architecture

Use a synchronous event ledger plus a current-state projection:

```text
External system
  -> signed HTTPS POST
  -> in-memory authentication and contract validation
  -> one Supabase RPC
       -> append event outcome
       -> insert or advance current node state
  -> compact JSON response after commit
```

This provides auditability, idempotency, ordering protection, and fast current-state
queries without the operational overhead of a queue or background worker.

## HTTP Contract

### Endpoint

```http
POST /api/integrations/project-progress/v1/events
Content-Type: application/json
```

The maximum request-body size is 8 KiB.

### Request

```json
{
  "schema_version": "1.0",
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "occurred_at": "2026-07-24T14:30:00+08:00",
  "vendor_subcon": "ABC Construction Corporation",
  "project": "Davao Fiber Expansion",
  "node_id": "NODE-001",
  "status": "ongoing"
}
```

### Field Rules

| Field | Type | Rules |
|---|---|---|
| `schema_version` | string | Required; exact value `"1.0"` |
| `event_id` | string | Required UUID v4; generated once per business event |
| `occurred_at` | string | Required RFC 3339 timestamp with an explicit timezone |
| `vendor_subcon` | string | Required; trimmed length 1-200 |
| `project` | string | Required; trimmed length 1-200 |
| `node_id` | string | Required; trimmed length 1-128 |
| `status` | string | Required; exact lowercase `ongoing` or `finished` |

Additional JSON properties are rejected. Strings containing NUL characters are
rejected. `occurred_at` may be historical but cannot be more than five minutes
ahead of receiver time.

### Business Meaning

- `ongoing` means work on the node has started but is not complete.
- `finished` means the node is complete and is terminal.
- A node may first appear as `finished` when an earlier event was unavailable.
- Repeated events with an unchanged status do not represent a completion
  percentage.
- Because v1 carries no percentage or total expected node count, it cannot calculate
  a reliable project completion percentage.

To keep both systems lightweight, the sender should emit only actual state
transitions. A node normally produces at most:

```text
no record -> ongoing -> finished
```

or, when first observed after completion:

```text
no record -> finished
```

## Name and Relationship Matching

### Normalization

Vendor and project lookup keys use:

```text
lower(trim(name))
```

Matching is case-insensitive but otherwise exact. The receiver does not remove
punctuation, normalize corporate suffixes, perform partial matching, or use fuzzy
matching.

Examples:

- ` ABC Builders ` matches `ABC Builders`.
- `abc builders` matches `ABC Builders`.
- `ABC Builders` does not match `ABC Builders Inc.`.

`node_id` is trimmed and otherwise treated as an opaque, case-sensitive value.
`NODE-001` and `node-001` are different nodes.

### Required ERP State

- Exactly one non-deleted vendor must match `vendor_subcon`.
- Exactly one non-deleted project must match `project`.
- The vendor must already be linked to the project in `project_vendors`.
- The receiver does not create or repair missing records or links.
- Vendor and project lifecycle statuses do not gate ingestion because the feed is
  reporting data, not authorizing work.

### Uniqueness

Before enabling the receiver, report all case-insensitive duplicate names and
resolve them manually. Do not auto-merge records.

After cleanup, add partial unique indexes equivalent to:

```text
unique lower(trim(vendors.name)) where deleted_at is null
unique lower(trim(projects.name)) where deleted_at is null
```

Names become external integration identifiers. Renaming a vendor or project requires
coordinating the same change in the sending system.

### Node Identity

A node is uniquely identified by:

```text
(project_id, node_id)
```

The vendor assignment recorded by the first accepted event is fixed. A later event
that submits the same project and node under another vendor is rejected rather than
silently reassigning it.

## Authentication and Replay Protection

### Headers

```http
X-TVPH-Key-Id: external-progress-prod
X-TVPH-Timestamp: 1784874600
X-TVPH-Signature: v1=<base64-signature>
```

`X-TVPH-Timestamp` is Unix time in seconds.

### Signature

The sender serializes the JSON body once, then signs the exact bytes sent:

```text
base64(
  HMAC-SHA256(
    shared_secret,
    X-TVPH-Timestamp + "." + exact_raw_request_body
  )
)
```

Receiver processing order:

1. Reject a body larger than 8 KiB.
2. Require `application/json`.
3. Read the key ID, timestamp, and signature headers.
4. Reject request timestamps more than five minutes from receiver time.
5. Verify the signature with a constant-time comparison.
6. Parse and validate the JSON.
7. Make one database RPC.

HTTPS is mandatory. The signing secret and Supabase service-role credential remain
server-side. Secrets, signatures, and full request headers must not be logged.

### Key Configuration

Required:

```text
PROJECT_PROGRESS_WEBHOOK_KEY_ID
PROJECT_PROGRESS_WEBHOOK_SECRET
```

Optional during rotation:

```text
PROJECT_PROGRESS_WEBHOOK_PREVIOUS_KEY_ID
PROJECT_PROGRESS_WEBHOOK_PREVIOUS_SECRET
```

The receiver accepts at most one current and one previous key. Remove the previous
key after the agreed rotation window.

If no current key is configured, return `503 temporarily_unavailable` before any
database work. Staging and production use different keys.

## Database Design

### `project_progress_events`

A compact ledger for authenticated requests that pass structural validation.

| Column | Type | Purpose |
|---|---|---|
| `event_id` | uuid primary key | Idempotency key |
| `schema_version` | text | Received contract version |
| `occurred_at` | timestamptz | External business time |
| `received_at` | timestamptz | First ERP receipt time |
| `last_received_at` | timestamptz | Latest duplicate receipt time |
| `delivery_count` | integer | Delivery count, starting at 1 |
| `vendor_name_received` | text | Submitted vendor/subcontractor name |
| `project_name_received` | text | Submitted project name |
| `node_id` | text | Submitted node identifier |
| `status` | text | `ongoing` or `finished` |
| `vendor_id` | uuid null | Resolved ERP vendor |
| `project_id` | uuid null | Resolved ERP project |
| `outcome` | text | `applied`, `recorded`, or `rejected` |
| `reason_code` | text null | Stable machine-readable rejection reason |
| `canonical_payload_hash` | text | Detects event ID reuse with changed data |

The validated columns contain the complete v1 payload, so no duplicate raw JSONB
payload is stored.

Outcome meanings:

- `applied`: the event created or changed current node state.
- `recorded`: the event is valid history but did not change current state.
- `rejected`: the event failed a business mapping or transition rule.

Malformed, oversized, unauthenticated, and structurally invalid requests never reach
this table. Authenticated, structurally valid business rejections are committed to
the ledger so operators can diagnose them.

### `project_node_progress`

The current node-state projection.

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid primary key | Internal identifier |
| `project_id` | uuid | ERP project |
| `vendor_id` | uuid | Fixed ERP vendor assignment |
| `node_id` | text | Case-sensitive external identifier |
| `status` | text | Current `ongoing` or `finished` |
| `status_occurred_at` | timestamptz | Business time of current status |
| `first_event_id` | uuid | Event that introduced the node |
| `last_event_id` | uuid | Event producing current state |
| `created_at` | timestamptz | Projection creation time |
| `updated_at` | timestamptz | Projection update time |

Constraints:

- unique `(project_id, node_id)`;
- status check allowing only `ongoing` and `finished`;
- foreign keys to project, vendor, and event records;
- fixed vendor assignment after insertion.

### Indexes

- Event history: `(project_id, node_id, occurred_at)`.
- Current counts/filtering: `(project_id, status)`.
- Existing `event_id` primary key for idempotency.
- Existing `project_vendors(project_id, vendor_id)` primary key for link checks.
- Partial case-insensitive unique indexes for non-deleted vendor and project names.

At the expected maximum of two normal events per node, indefinite event retention is
acceptable for v1. Add archival only after measured volume warrants it.

### Access Control

- Enable RLS on both integration tables.
- Revoke direct access from `anon` and `authenticated`.
- The server route uses the server-only service role.
- Implement the atomic database operation as a security-invoker RPC.
- Revoke function execution from `PUBLIC`, `anon`, and `authenticated`.
- Grant function execution only to `service_role`.

The function must not use `SECURITY DEFINER`.

## Atomic Processing

Use one database function, `ingest_project_progress_event`, for all mapping,
idempotency, transition, ledger, and current-state work.

The function returns structured data instead of throwing for expected business
rejections so the rejected audit row can still commit.

Processing steps:

1. Check `event_id`.
2. If it exists, compare the canonical payload hash.
3. For an exact duplicate, increment delivery metadata and return the original
   outcome.
4. For the same ID with different data, return `idempotency_conflict` without
   changing business state.
5. Resolve the non-deleted vendor and project using the normalized names.
6. Reject unknown records or a missing vendor-project link.
7. Acquire a transaction-scoped per-node advisory lock derived from
   `(project_id, node_id)`. Hash collisions can only serialize unrelated nodes; they
   cannot corrupt state.
8. Confirm an existing node has the same vendor.
9. Validate the new event against accepted node history.
10. Insert the event outcome.
11. Insert or update the current projection when the event becomes the latest
    accepted state.
12. Commit and return the result.

The advisory lock covers concurrent first events, where no current row exists to
lock. The unique node constraint remains the final database guard.

## Idempotency

The canonical hash covers the normalized values of all seven v1 fields. JSON
whitespace and property order do not affect it.

- Same event ID and same canonical payload: return the original outcome and increment
  `delivery_count`.
- Same event ID with different canonical data: return `409 idempotency_conflict`.
- An exact retry never inserts a second event or changes node state twice.
- Correcting a rejected event requires a new event ID.
- A duplicate of a rejected event returns the original rejection.

For network retries, the body and event ID remain unchanged. Only the request
timestamp and signature headers are refreshed.

## Status and Chronology Rules

Status rank:

```text
ongoing = 1
finished = 2
```

Accepted history must be nondecreasing by `occurred_at`. At equal timestamps,
`finished` ranks after `ongoing`.

| Current state | Incoming state | Result |
|---|---|---|
| None | `ongoing` | Create current node |
| None | `finished` | Create terminal current node |
| `ongoing` | `ongoing` | Record activity; update current time only when later |
| `ongoing` | `finished` | Advance to terminal state |
| `finished` | `finished` | Record confirmation; retain terminal state |
| `finished` | `ongoing` | Reject when chronologically later |

Historical validation:

- Incoming `ongoing` is contradictory when an accepted `finished` event has an
  earlier `occurred_at`.
- Incoming `finished` is contradictory when an accepted `ongoing` event has a later
  `occurred_at`.
- An older `ongoing` event before an already known `finished` event is valid history
  and is recorded without changing current state.
- An older `finished` event before a later accepted `ongoing` event is rejected as a
  temporal conflict.
- At the same timestamp, both statuses may exist; `finished` is the effective state.

The current projection is the accepted event with the greatest
`(occurred_at, status_rank)`.

## Responses

### Applied or Recorded Event

```http
HTTP/1.1 201 Created
```

```json
{
  "ok": true,
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "result": "applied",
  "node_id": "NODE-001",
  "current_status": "ongoing",
  "current_occurred_at": "2026-07-24T14:30:00+08:00"
}
```

### Exact Duplicate

```http
HTTP/1.1 200 OK
```

```json
{
  "ok": true,
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "result": "duplicate",
  "original_result": "applied",
  "node_id": "NODE-001",
  "current_status": "ongoing",
  "current_occurred_at": "2026-07-24T14:30:00+08:00"
}
```

Internal ERP UUIDs are not returned.

### Error

```json
{
  "ok": false,
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "error": {
    "code": "vendor_project_not_linked",
    "message": "The vendor is not linked to the specified project.",
    "retryable": false
  }
}
```

Responses never expose database errors, stack traces, secrets, or internal
credentials.

### HTTP Status Matrix

| HTTP | Codes | Sender action |
|---:|---|---|
| `400` | `invalid_json` | Fix request; do not retry |
| `401` | `unauthorized`, `expired_request_timestamp` | Check secret or clock |
| `409` | `idempotency_conflict`, `node_vendor_conflict`, `status_regression`, `temporal_conflict`, `vendor_project_not_linked` | Manual correction |
| `413` | `payload_too_large` | Reduce body |
| `415` | `unsupported_media_type` | Send JSON |
| `422` | `validation_failed`, `unsupported_schema_version`, `unknown_vendor`, `unknown_project`, `future_occurred_at` | Correct data; use a new event ID |
| `429` | `rate_limited` | Retry using `Retry-After` |
| `500` | `internal_error` | Retry |
| `503` | `temporarily_unavailable` | Retry using `Retry-After` when present |

A `2xx` response means the relevant database transaction committed.

## Sender Delivery Requirements

For each state transition:

1. Generate the event ID once.
2. Capture the actual business time.
3. Build and serialize the JSON once.
4. Persist the pending delivery durably.
5. Sign and send with a five-second timeout.
6. Remove it from the pending outbox only after a final successful response.
7. Retain permanent failures in a failed-event log for manual review.

Retry only network failures, timeouts, `429`, `500`, and `503`.

Suggested retry delays with random jitter:

```text
5 seconds -> 30 seconds -> 2 minutes -> 10 minutes -> 30 minutes
```

Honor `Retry-After` when supplied. After the final retry, retain the event for manual
review.

Every retry:

- reuses the same event ID;
- reuses the same exact JSON body bytes;
- generates a fresh request timestamp;
- recalculates the signature.

A timeout is an unknown outcome. The sender must retry the same event rather than
create a replacement.

Do not automatically retry `400`, `401`, `409`, `413`, `415`, or `422`.

## Performance Boundaries

- One event per HTTP request.
- One database RPC for each authenticated, structurally valid request.
- Expected request body below 1 KiB; enforced maximum 8 KiB.
- No external calls from the receiver.
- No polling, background jobs, queue, callback, realtime subscription, or custom
  connection pool.
- No dashboard invalidation or project-wide aggregation during ingestion.
- Indexed lookup and per-node work keep cost approximately constant per event.
- Target p95 receiver processing time is below 500 ms at representative normal
  traffic, excluding internet latency.

No database-backed rate limiter is included. Platform-level rate limiting may be
added only if measured traffic or abuse requires it.

No batch endpoint is included. Add one only if measured volume shows individual
HTTPS requests are the bottleneck.

## Observability

Each request emits a compact structured application log containing:

- `event_id`, when structurally available;
- result or error code;
- processing duration in milliseconds;
- receipt timestamp.

Invalid authentication is visible only in protected application logs. It must not
create database traffic.

The event ledger supports indexed operational queries for:

- applied events;
- recorded events;
- exact delivery counts;
- rejected events grouped by reason;
- events per project and time window;
- nodes currently `ongoing` or `finished`.

No separate monitoring database or integration dashboard is required for v1.

## Versioning

- The v1 route accepts only schema `"1.0"`.
- Unknown fields are rejected.
- Breaking changes use `/v2/events` and schema `"2.0"`.
- The old version remains available for an agreed migration window.
- Versions are not guessed or silently converted.
- Percentage progress requires a new contract because v1 does not define its units,
  denominator, or relationship to approved ERP completion.

## Verification

### Contract

- Valid `ongoing` and `finished` payloads.
- Direct first event of `finished`.
- Missing and additional fields.
- Unsupported status and schema version.
- Invalid UUID and timestamp.
- Oversized body and wrong content type.

### Authentication

- Correct and incorrect signatures.
- Body modified after signing.
- Expired and future request timestamps.
- Current and previous rotation keys.
- Constant-time signature comparison.
- Missing receiver configuration returns `503` without database work.

### Matching

- Case-insensitive vendor and project lookup.
- Leading and trailing whitespace.
- Significant punctuation.
- Unknown vendor and project.
- Missing vendor-project link.
- Duplicate-name preflight.
- Deleted records excluded.

### Idempotency and Ordering

- Exact retry.
- Same event ID with changed data.
- `ongoing -> finished`.
- Later `finished -> ongoing` rejection.
- Repeated same status.
- Older valid history.
- Contradictory out-of-order history.
- Equal-time status ranking.
- Concurrent first events for one node.
- Same node ID in different projects.
- Attempted vendor reassignment.

### Isolation and Performance

- No update to project lifecycle status.
- No update to completion percentage or certificates.
- One database RPC per authenticated, structurally valid request.
- Representative staging run meets the p95 target.
- Existing project dashboard queries remain unchanged.

## Rollout

1. Report case-insensitive duplicate non-deleted vendor and project names.
2. Resolve duplicates manually.
3. Apply name constraints, integration tables, indexes, RLS, and RPC.
4. Configure staging signing credentials.
5. Test with a dedicated vendor, project, and vendor-project link.
6. Exercise success, duplicate, rejection, ordering, concurrency, and retry cases.
7. Configure separate production credentials.
8. Enable one pilot project.
9. Monitor outcomes and latency for one normal operating cycle.
10. Enable the remaining projects after the pilot is clean.

Staging and production must not share secrets or event IDs.

Emergency shutdown removes or rotates the configured current secret. The endpoint
then returns `503 temporarily_unavailable`, performs no writes, and retains existing
integration data.

## Acceptance Criteria

- Every accepted event is traceable by event ID.
- Exact retries cannot duplicate event or node state.
- Reusing an event ID with different data is rejected.
- Chronological status cannot move backward from `finished` to `ongoing`.
- Unknown names and missing vendor-project links fail explicitly.
- A node cannot silently move to another vendor.
- Normal sender behavior produces at most two small requests per node.
- Receiver processing uses one atomic database call.
- Existing ERP project status, completion, billing, and certificate behavior is
  unchanged.
- Transient delivery failures remain retryable without losing events.
- Permanent failures remain visible for manual correction.

## Deferred Until Measured Need

- Percentage or milestone progress.
- Expected total-node counts.
- Batch ingestion.
- Queue-based processing.
- Integration dashboard.
- Custom rate limiting.
- Event archival.
- Multiple external source systems.
