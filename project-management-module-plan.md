# Project Management Module — Spec + Discovery Docs

> Status: draft. Written at planning stage; expected to change.

## Context

You want a Monday.com-style project management module to handle new, existing, and potential projects. Recon changed the shape of that request in two ways worth stating up front:

**Your "potential projects" feature already exists.** `crm_opportunities` (`supabase/migrations/20260519_crm_module.sql`) is a real pipeline — stages `prospect → site_visit → quoted → approved → ongoing → completed → lost_cancelled`, an owner, an estimated contract value, expected dates, and site/permit/safety requirement fields. The UI already calls it **"Customer Project"** (`app/dashboard/crm/projects/[id]/page.tsx`). What it lacks is a board view; stage changes go through a plain `<select>`.

**Your `projects` table is a cost shell, not a project.** It has `name`, `description`, free-text `status` (no CHECK constraint — any string is accepted), `account_id`, and `completion_pct`. It has no dates of any kind, no tasks, no milestones, and no assignees. `project_manager_id` exists in the schema and is read by zero lines of application code.

So the system already has two things named "project" and this module would be a third. The decision below is to **unify them into one lifecycle** rather than add a layer.

This work produces **two documents, no code**. The spec is explicitly a living draft; the discovery doc is the instrument to take to the team to find out what actually goes in it.

## Decisions locked

| Decision | Choice |
|---|---|
| Relationship to existing modules | **One unified lifecycle.** `crm_opportunities` merges into `projects`. One record spans potential → won → delivered → closed. |
| Stage model | **Extend the CRM list.** Keep the seven stages the team already knows so existing rows migrate 1:1 and sales retrains on nothing. |
| Merge rule for already-converted pairs | **The `projects` row survives**, sales fields fold onto it, the opportunity is retired. The project id must not change — POs, invoices, and payments point at it. |
| Dead leads in the projects list | **One table, filtered by default.** Delivery views show won-and-later stages; pipeline appears behind a toggle. Existing screens keep their meaning. |
| Task flexibility | **Fixed core columns + admin-defined custom fields per job type.** Core fields are real SQL columns so reports stay simple; extras live in `jsonb`. |
| Assignees | **`profiles.id` only.** Office staff, everyone has a login. No non-user resource model. |
| Project P&L | **Yes — revenue link required.** Client billing must become attributable to a project. |

## What gets written

### 1. `docs/superpowers/specs/2026-07-16-project-management-module-design.md`

Follows the house spec format (prose sections, matching `2026-07-14-payment-reminder-engine-design.md`). Sections:

**Goal / Scope** — one unified project record; what is explicitly out (no client portal, no non-user assignees, no Gantt in v1).

**Data model.** `projects` absorbs the opportunity fields: `job_type`, `estimated_contract_value`, `estimated_copper_volume`, `expected_start_date`, `expected_close_date`, `next_follow_up_date`, `access_requirements`, `safety_requirements`, `permit_requirements`, `source`, `lost_reason`, `owner_id`. It gains a constrained `stage` (the CRM seven, 1:1 migration) and keeps `status` (`open|won|lost`) as the outcome axis. Free-text `status` on the current table is a landmine — it becomes a CHECK-constrained column.

New `project_tasks`: `project_id` (cascade), `parent_task_id` self-FK for subtasks (copy the `erp_document_comments` pattern from `20260528111111_create_erp_documents.sql`), `title`, `description`, `assignee_id → profiles`, `status`, `priority`, `start_date`, `due_date`, `completed_at`, `position` (fractional index so drag-reorder doesn't renumber the table), `custom jsonb`, plus the standard `created_by/created_at/updated_at/deleted_at`.

New `task_field_defs`: `job_type` (null = applies to all), `key`, `label`, `field_type`, `options jsonb`, `position`, `is_required`. Unique on `(job_type, key)`.

An immutable `project_is_delivery(stage)` SQL function holds the default-filter predicate in **one** place, so the list page, the dashboard, and exports can't drift apart on what counts as a real project.

**Revenue link.** Only `client_purchase_orders` needs `project_id` — `client_invoices.client_po_id` is `NOT NULL`, so project attribution flows through the PO for free. Flagged open question: can one client PO span multiple projects? If yes this becomes a join table and the design changes.

**Migration strategy.** Backfill unconverted opportunities as pipeline-stage projects; collapse converted pairs onto the surviving project row; repoint `crm_activities.opportunity_id → project_id`. `convertOpportunityToProject()` (`app/dashboard/crm/actions.ts:547`) becomes a stage transition instead of an insert.

**Authorization.** Add `project.read`, `project.delete`, `task.write`, and `project.field.admin` to **both** the `Capability` union and `CAPABILITY_ROLES` in `lib/auth/roles.ts`. `project.delete` is superadmin-only, matching `po.delete`/`vendor.delete`.

**Architecture / house rules.** Mutations in `app/dashboard/projects/actions.ts` following the five-step spine (`requireCapability` → business rules → mutate → `recordAuditLog` → `createNotification` → `revalidatePath`). Note `requireCapability` returns `{error}` and does **not** throw. Board drag-drop is the repo's first drag-drop dependency and a live board would be the first Realtime subscription on a business table (today only `notification-bell.tsx` uses Realtime) — both are called out as new dependencies to approve, not assumed.

**Phasing.** Phase 0 (prerequisites, ships alone) → 1 unify → 2 tasks/board → 3 custom fields → 4 P&L.

**Verification.** Per house rules: `npm run lint`, `npm run test`, `npm run build`; actions-first Jest tests under `__tests__/app/dashboard/projects/`.

### 2. `docs/superpowers/specs/2026-07-16-project-management-discovery-questions.md`

Non-technical interview script for the people who will use the module. Every question carries a **why we ask**, a **what a good answer sounds like** example, and an **if you're stuck, answer this instead** fallback — because the stated problem is that users often don't know what they need.

Twelve series: the work itself (walk a job start to finish) · vocabulary (what do *you* call each phase) · how work becomes real · who does what · time and deadlines · what "done" means · what stalls · **the spreadsheets** (what lives outside the ERP today — the stated pain, and the highest-yield section) · money · Monday-morning reporting · what you scribble in the margins (this is what determines the custom fields) · anti-questions (what would make this worse than the spreadsheet).

## Landmines found — these go in the spec's prerequisites, and they are the reason Phase 0 exists

1. **Schema drift, and it's load-bearing.** `account_id`, `contract_file_url`, and `contract_file_name` are written by `app/dashboard/projects/actions.ts` and selected by `page.tsx`, but **no migration creates them**. They exist in production only. Rebuild from migrations and the projects module breaks. The repo has already hit this class of bug once (`20260714_dashboard_bottlenecks.sql:3` acknowledges the same drift on client billing). This must be reconciled before any migration touches `projects`.
2. **The RLS on `projects` is open.** `20260603_rbac_and_magic_links.sql` replaced the read and update policies but **never dropped the initial insert/delete policies**, which are still `with check (true)` / `using (true)`. Any authenticated user — including `viewer` — can insert or delete project rows directly through PostgREST. The only thing stopping them is the app-layer `requireCapability`, which CLAUDE.md explicitly says is not the enforcement boundary. `project_vendors` still has a blanket `"Allow authenticated full access"` policy too.
3. **Project completion is computed wrong.** Both `get_dashboard_project_progress()` (`20260714_dashboard_bottlenecks.sql:279`) and the detail page (`app/dashboard/projects/[id]/page.tsx:141`) **sum** per-PO completion percentages and cap at 100. Three POs at 40% each report the project as 100% complete. This feeds the "Overbilled / Need to Pay" variance indicator the UI shows prominently.
4. **Two competing completion sources.** `projects.completion_pct` is written only by `saveCompletionPct`, which **has no caller anywhere** — yet the column is read by the PO overbilling guard (`app/dashboard/purchase-orders/[id]/page.tsx:231`). Meanwhile the UI derives completion from certificates instead. One of these is wrong and money decisions depend on it.
5. **The projects list filter is broken.** `app/dashboard/projects/page.tsx:78-86` applies the `account_id` filter client-side **after** `.range(from, to)`, so filtering by customer only filters the current page, and `count` stays unfiltered — the pagination controls lie.
6. **`convertOpportunityToProject` doesn't set `account_id`.** Projects created from a client's opportunity arrive with no client link and someone fixes it by hand. Unification deletes this bug by construction.
7. **App and DB disagree about `finance`.** `finance` passes `is_staff` (so RLS grants read/update on projects) but holds neither `project.write` nor `export.project`.
8. **No delete path exists.** `deleted_at` is filtered by every query but no action ever sets it. Projects can be created and never removed.

Items 1 and 2 are blocking. Items 3 and 4 need a decision once the real numbers are visible — they're wrong today, and unification is the moment to fix them.

## Open questions carried into the spec (not blocking these docs)

- Does `ongoing` split into mobilizing / in_progress / demobilizing? Deferred to discovery.
- Can one client PO span multiple projects? Changes the revenue link from a column to a join table.
- Do milestones need to be first-class, or is a task flag enough? Note the interaction with `po_completion_certificates`, which is already a working per-PO `submitted → approved | rejected` workflow and the closest thing to a milestone in the system today.
- Live-updating board (Realtime) or refresh-on-navigate?

## Verification

These are documents, so verification is review, not tests:

1. Read the spec against the decision table above — every locked decision should appear, and no unlocked decision should be silently assumed.
2. Confirm the eight landmines are each either scheduled in Phase 0 or explicitly deferred with a reason.
3. Take the discovery doc to one real user and run the first three series. If they answer in existing vocabulary without translation, the questions work. If a question needs explaining, that question is broken — fix it before the other interviews.
4. No lint/test/build run applies; nothing executable changes.
