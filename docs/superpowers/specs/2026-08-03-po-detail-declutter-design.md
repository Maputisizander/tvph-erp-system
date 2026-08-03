# PO Detail Page Declutter — Design

Date: 2026-08-03
Status: Approved (user confirmed, incl. ring drop and More-dropdown decisions)

## Problem

`app/dashboard/purchase-orders/[id]/page.tsx` (1,109 lines) is cluttered: a
6-button header wall, ~15 stacked sections in one endless scroll with no
navigation, and two financial cards cramming ~14 numbers with competing
emphasis. Content itself is all wanted — the problem is presentation.

User annoyances (ranked): long scroll with no nav, actions buried, button
wall, number overload. Banners are acceptable as-is. All sections are kept;
nothing is deleted.

## Approach (Plan B): sticky section nav + collapsible detail cards

No new dependencies. Native HTML `<details>/<summary>` for collapsibles, pure
anchor links for navigation — both work in the server component.

## Changes

### 1. Sticky section nav
- Slim sticky chip bar under the header: `Overview · Certificates · Invoices
  · Details · History · Vendor` (`sticky top-0`, backdrop blur).
- Pure anchor links (`#overview`, ...) — zero JS, server-component safe.
- Each section gets an `id` plus `scroll-mt-28` so the sticky bar never
  covers the anchor target.
- No active-state highlighting (would require scrollspy JS — skipped).

### 2. Header consolidation
- One context-aware primary button:
  - `draft` → `Submit for Approval` (existing `PoIssueButton`)
  - `pending_approval` → none (banner handles approval)
  - otherwise → `View PDF`
- `Download` dropdown always visible (existing `PODownloadDropdown`).
- New `PoMoreDropdown` (client, reuses click-outside pattern from
  `po-download-dropdown`): `Edit PO`, `Resend to Vendor`, `Send Payment
  Request` — only options the current user can perform.

### 3. Financial summary merge
Replace the ring card + Billing Health grid with one card:
- Hero: **Remaining to Pay** (red "Overpaid" variant when applicable).
- Two progress bars (Billing % incl. DP / Completion %) + variance chip.
- Quiet secondary grid (tiny uppercase labels, muted values): Original
  Commitment, Total Paid to Date, Downpayment, Balance after DP, Bills
  Received, Effective Billed, Approved Ceiling, Available to Bill.
- PR consumption block stays inside this card.
- **Progress ring is dropped** (decorative; duplicates bars + hero) —
  explicitly approved.

### 4. Collapsible detail cards
Small server component `CollapsibleCard` (title, icon, optional count,
`defaultOpen`, children) wrapping native `<details>/<summary>`:
- Terms & Conditions — open by default
- PO Details, Line Items, Site Details, Edit History — collapsed

### 5. Page order
Header → banners → section nav → Financial Summary (PR + Notify buttons sit
directly under it) → Completion Certificates → Linked Invoices → two-column
grid (collapsible details | vendor rail + project assigner + internal note).

Untouched: banners, certificates card, linked invoices table, right rail,
list page, editors, actions.

## Out of scope
- PO list page, editors, payment-request page, actions.ts logic, PDFs.
- Deleting any data or sections.

## Verification
- `npm run build` (or `npx tsc --noEmit` + lint) passes.
- Manual: detail page renders in light/dark/midnight themes; anchors jump
  with bar offset; collapsibles open/close; button sets correct per status.
