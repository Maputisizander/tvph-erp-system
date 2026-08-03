# PO Detail Page Declutter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Declutter the PO detail page (`app/dashboard/purchase-orders/[id]/page.tsx`) — sticky section nav, consolidated header actions, merged financial summary, collapsible detail cards — without removing any content.

**Architecture:** Pure presentation refactor of one server-component page plus two small components. Navigation via native HTML anchors (`#id` + `scroll-mt-28`), collapsibles via native `<details>/<summary>` — zero JS for both. One new client component (`PoMoreDropdown`) reuses the existing click-outside pattern from `po-download-dropdown.tsx`. No data queries or calculations change.

**Tech Stack:** Next.js 16 App Router (RSC), Tailwind CSS 4, lucide-react, TypeScript 5 strict.

## Global Constraints

- Follow the existing page's styling conventions: card = `bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm`; muted label = `text-[10px] font-bold text-slate-400 uppercase tracking-widest`.
- No new dependencies. No client JS for anchors or collapsibles (native HTML only).
- Do not change any query, calculation, or server action. All computed values (`poAmount`, `totalPaid`, `billingPct`, `compPct`, `billingVariance`, `remainingBalance`, `overpaidAmount`, `isOverpaid`, `prConsumed`, `prRemaining`, `dpTarget`, `balanceAfterDp`, `billingCeiling`, `availableToBill`, `effectiveBilled`, `canEditAny`, `canEditDraft`, `canSendEmail`, `canCreatePR`, `paymentRequest`) are already defined in the page — reuse as-is.
- No content removed: banners, certificates, invoices table, vendor rail, terms/details/line-items/site-details/history all remain, some behind collapsibles.
- Project convention: no UI snapshot tests. Verification = `npx tsc --noEmit` + `npm run lint` per task, `npm run build` at the end.

---

### Task 1: PoCollapsibleCard component

**Files:**
- Create: `components/dashboard/purchase-orders/po-collapsible-card.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `PoCollapsibleCard({ title, icon, count, defaultOpen, children })` — server component. `title: string`, `icon?: React.ReactNode`, `count?: number`, `defaultOpen?: boolean` (default `false`), `children: React.ReactNode`. Renders a styled `<details>` with a `<summary>` header row and a padded content wrapper.

- [ ] **Step 1: Create the component**

```tsx
import { ChevronDown } from "lucide-react";

export function PoCollapsibleCard({
  title,
  icon,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm [&>summary]:list-none [&>summary::-webkit-details-marker]:hidden"
    >
      <summary className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between cursor-pointer select-none">
        <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          {icon}
          {title}
          {count !== undefined && (
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-bold">
              {count}
            </span>
          )}
        </h2>
        <ChevronDown className="h-4 w-4 text-slate-400 group-open:rotate-180 transition-transform" />
      </summary>
      <div className="p-6">{children}</div>
    </details>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/purchase-orders/po-collapsible-card.tsx
git commit -m "feat: add PoCollapsibleCard native details/summary component"
```

---

### Task 2: PoMoreDropdown component

**Files:**
- Create: `components/dashboard/purchase-orders/po-more-dropdown.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `PoMoreDropdown({ children })` — client component. `children: React.ReactNode` (menu items — links or buttons, styled by caller). Renders a ghost "More" button; clicking anywhere inside the open menu closes it (event delegation on the menu container — no cloneElement needed).

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, ChevronDown } from "lucide-react";

export function PoMoreDropdown({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shrink-0 whitespace-nowrap"
      >
        <MoreHorizontal className="h-4 w-4" />
        More
        <ChevronDown className={`h-3 w-3 opacity-70 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#0a0a0a] rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg py-1 z-[var(--z-dropdown)] animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {children}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/purchase-orders/po-more-dropdown.tsx
git commit -m "feat: add PoMoreDropdown header actions menu"
```

---

### Task 3: Page — sticky section nav + header consolidation

**Files:**
- Modify: `app/dashboard/purchase-orders/[id]/page.tsx`

**Interfaces:**
- Consumes: `PoMoreDropdown` (Task 2), existing `PoIssueButton`, `PODownloadDropdown`, `PoResendButton`, and current page variables.
- Produces: sticky anchor nav bar; consolidated header button row; `id` + `scroll-mt-28` on: financial summary wrapper (`#overview`), certificates wrapper (`#certificates`), invoices wrapper (`#invoices`), details column (`#details`), history wrapper (`#history`), vendor column (`#vendor`).

- [ ] **Step 1: Add imports**

In the existing import block (alphabetical, matching current style), add:

```tsx
import { PoMoreDropdown } from "@/components/dashboard/purchase-orders/po-more-dropdown";
```

- [ ] **Step 2: Consolidate the header action row**

Replace the entire header actions block (currently the `<div className="flex items-center gap-2 md:ml-auto">…</div>` containing `PoIssueButton`, `PoResendButton`, Edit PO link, View PDF link, `PODownloadDropdown`, and the Send Payment Request link) with:

```tsx
        <div className="flex items-center gap-2 md:ml-auto">
          {po.status === "draft" && hasCapability(currentRole, "po.status") && (
            <PoIssueButton poId={po.id} eligibleApprovers={eligibleApprovers} />
          )}
          {!["draft", "pending_approval"].includes(po.status) && (
            <a
              href={`/api/purchase-orders/${po.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-3 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95 shrink-0 whitespace-nowrap"
            >
              <Eye className="h-4 w-4" />
              View PDF
            </a>
          )}
          <PODownloadDropdown poId={po.id} />
          {(canEditAny ||
            (["issued", "paid", "overpaid"].includes(po.status) && canSendEmail) ||
            (canCreatePR &&
              (!paymentRequest ||
                paymentRequest.status === "rejected" ||
                paymentRequest.status === "fully_invoiced")) ||
            ["draft", "pending_approval"].includes(po.status)) && (
            <PoMoreDropdown>
              {["draft", "pending_approval"].includes(po.status) && (
                <a
                  href={`/api/purchase-orders/${po.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Eye className="h-4 w-4" />
                  View PDF
                </a>
              )}
              {canEditAny && (
                <Link
                  href={`/dashboard/purchase-orders/${po.id}/editor`}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                  Edit PO
                </Link>
              )}
              {["issued", "paid", "overpaid"].includes(po.status) && canSendEmail && (
                <PoResendButton poId={po.id} />
              )}
              {canCreatePR &&
                (!paymentRequest ||
                  paymentRequest.status === "rejected" ||
                  paymentRequest.status === "fully_invoiced") && (
                  <Link
                    href={`/dashboard/purchase-orders/${po.id}/payment-request`}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Send className="h-4 w-4" />
                    Send Payment Request
                  </Link>
                )}
            </PoMoreDropdown>
          )}
        </div>
```

Notes:
- `PoResendButton` renders its own outline button + feedback text inside the menu — acceptable as-is, do not modify it.
- The "More" button is shown when any conditional item could exist. `po.status` is `"draft"`/`"pending_approval"` → includes the View PDF item (preserves draft preview access).

- [ ] **Step 3: Insert the sticky section nav**

Immediately after the last banner block (`isWaiverApproved` block) and before the Completion Certificates section, insert:

```tsx
      {/* Section nav */}
      <nav className="sticky top-0 z-30 flex items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#071F15]/90 backdrop-blur px-3 py-2 shadow-sm">
        {[
          { href: "#overview", label: "Overview" },
          { href: "#certificates", label: "Certificates" },
          { href: "#invoices", label: "Invoices" },
          { href: "#details", label: "Details" },
          { href: "#history", label: "History" },
          { href: "#vendor", label: "Vendor" },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="px-3 py-1.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
          >
            {item.label}
          </a>
        ))}
      </nav>
```

- [ ] **Step 4: Add anchor ids to existing wrappers**

Apply these targeted edits (do not restructure JSX yet — ids only, Tasks 4–5 restructure):
- Certificates card wrapper `<div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">` (the one containing "Completion Certificates"): add `id="certificates" className="… scroll-mt-28"` — i.e. `className="scroll-mt-28 bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm"` with `id="certificates"`.
- Linked Invoices card wrapper (the `<div className="bg-white dark:bg-[#071F15] … overflow-hidden shadow-sm">` containing "Linked Invoices"): add `id="invoices"` + `scroll-mt-28` the same way.

(Note: these two cards get moved in Task 5 — the ids move with them.)

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/purchase-orders/\[id\]/page.tsx
git commit -m "feat: PO detail sticky section nav and consolidated header actions"
```

---

### Task 4: Page — merge financial summary

**Files:**
- Modify: `app/dashboard/purchase-orders/[id]/page.tsx`

**Interfaces:**
- Consumes: page variables listed in Global Constraints.
- Produces: single `#overview` financial summary card replacing the ring card + Billing Health grid.

- [ ] **Step 1: Replace the financial grid**

Replace the entire block from `{/* New Intuitive Financial Dashboard */}` through the closing of the Billing Health card (currently `<div className="grid grid-cols-1 md:grid-cols-3 gap-6">…</div>` — the ring card + "Invoicing Progress Card") with:

```tsx
      {/* Financial Summary */}
      <section id="overview" className="scroll-mt-28">
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" /> Financial Summary
            </h2>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
              isOverpaid
                ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50"
                : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50"
            }`}>
              {isOverpaid ? `Overpaid ₱${overpaidAmount.toLocaleString()}` : "On Track"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Hero */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                {isOverpaid ? "Overpaid Balance" : "Remaining to Pay"}
              </label>
              <div className={`text-3xl font-bold ${isOverpaid ? "text-red-600" : "text-slate-900 dark:text-white"}`}>
                ₱{(isOverpaid ? overpaidAmount : remainingBalance).toLocaleString()}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {isOverpaid
                  ? "Total payments exceeded the PO amount."
                  : "Outstanding balance after downpayment and all payments."}
              </p>
            </div>

            {/* Progress bars + variance */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-slate-500 uppercase">Billing % (incl. DP)</span>
                  <span className={effectiveBilled > poAmount ? "text-red-500" : "text-slate-900 dark:text-white"}>
                    {billingPct}%
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${effectiveBilled > poAmount ? "bg-red-500" : "bg-blue-500"}`}
                    style={{ width: `${Math.min(100, billingPct)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-slate-500 uppercase">Completion %</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{compPct}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${Math.min(100, compPct)}%` }}
                  />
                </div>
              </div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                billingVariance > 0
                  ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400"
                  : billingVariance < 0
                    ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400"
                    : "bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 text-slate-500"
              }`}>
                {billingVariance > 0
                  ? `Need to pay ${billingVariance}% more`
                  : billingVariance < 0
                    ? `Overpaid by ${Math.abs(billingVariance)}%`
                    : "On track"}
              </div>
            </div>
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 pt-5 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Original Commitment</label>
              <div className="text-sm font-bold text-slate-900 dark:text-white">₱{poAmount.toLocaleString()}</div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Paid to Date</label>
              <div className={`text-sm font-bold ${isOverpaid ? "text-red-600" : "text-emerald-600 dark:text-emerald-400"}`}>
                ₱{totalPaid.toLocaleString()}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Downpayment</label>
              <div className="text-sm font-bold text-amber-600 dark:text-amber-400">
                {dpTarget > 0 ? `₱${dpTarget.toLocaleString()}` : "—"}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Balance after DP</label>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {dpTarget > 0 ? `₱${balanceAfterDp.toLocaleString()}` : "—"}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Bills Received</label>
              <div className="text-sm font-bold text-slate-900 dark:text-white">₱{totalInvoiced.toLocaleString()}</div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Effective Billed</label>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                ₱{effectiveBilled.toLocaleString()} ({billingPct}%)
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                {billingCeiling !== null ? "Approved Ceiling" : "Unbilled PO Amount"}
              </label>
              <div className={`text-sm font-bold ${billingCeiling !== null ? "text-emerald-700 dark:text-emerald-400" : "text-slate-900 dark:text-white"}`}>
                ₱{(billingCeiling !== null ? billingCeiling : Math.max(0, poAmount - effectiveBilled)).toLocaleString()}
                {billingCeiling !== null && ` (${maxApprovedPercent}%)`}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                {billingCeiling !== null ? "Available to Bill" : "Ceiling"}
              </label>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {billingCeiling !== null
                  ? `₱${availableToBill.toLocaleString()} (${Math.max(0, compPct - billingPct)}%)`
                  : "Full PO amount"}
              </div>
            </div>
          </div>

          {canEditDraft && dpTarget === 0 && (
            <p className="text-xs text-slate-500">No downpayment set. Add one on the Edit PO page while this PO is a draft.</p>
          )}

          {/* Payment Request Consumption */}
          {paymentRequest && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">
                Payment Request: {paymentRequest.request_number}
                {paymentRequest.is_downpayment && (
                  <span className="ml-1.5 inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">
                    DP
                  </span>
                )}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Approved Amount</span>
                  <span className="font-bold text-slate-900 dark:text-white">₱{Number(paymentRequest.amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Invoiced</span>
                  <span className="font-bold text-slate-900 dark:text-white">₱{prConsumed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Remaining / Carry-Forward</span>
                  <span className={`font-bold ${prRemaining > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                    {paymentRequest.status === "fully_invoiced" ? "Fully Invoiced" : `₱${prRemaining.toLocaleString()}`}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Status</span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                    paymentRequest.status === "fully_invoiced"
                      ? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                      : paymentRequest.status === "approved"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400"
                        : paymentRequest.status === "rejected"
                          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400"
                          : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400"
                  }`}>
                    {paymentRequest.status.replace(/_/g, " ").toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
```

Notes:
- The dead "Settings" button and the progress ring are dropped (approved in spec).
- If the JSX-to-be-replaced differs slightly (whitespace), match by the outermost structure `{/* New Intuitive Financial Dashboard */}` … up to and including the closing `</div>` of the Billing Health card. The grid wrapper `grid grid-cols-1 md:grid-cols-3 gap-6` and both cards are removed.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/purchase-orders/\[id\]/page.tsx
git commit -m "feat: merge PO financial ring and billing health into one summary card"
```

---

### Task 5: Page — collapsible details, invoices placement, PR/Notify reorder

**Files:**
- Modify: `app/dashboard/purchase-orders/[id]/page.tsx`

**Interfaces:**
- Consumes: `PoCollapsibleCard` (Task 1), existing `PoTermsCard`, `PODetailsEditor`, `POLineItemsEditor`, `POSiteDetailsEditor`, `POEditHistory`, `POProjectAssigner`, `PaymentRequestButton`, `NotifyFinanceButton`.

- [ ] **Step 1: Add import**

```tsx
import { PoCollapsibleCard } from "@/components/dashboard/purchase-orders/po-collapsible-card";
```

- [ ] **Step 2: Move PR + Notify below the Financial Summary**

Move the two blocks `{/* Payment Request */}` (`<PaymentRequestButton … />`) and `{/* Payment Notification */}` (`<NotifyFinanceButton … />`) so they render immediately after the `</section>` of `#overview` (Financial Summary) and before the Completion Certificates section. JSX content of both components unchanged.

- [ ] **Step 3: Reorder — certificates, then linked invoices, then two-column grid**

- The Completion Certificates card keeps its position (after PR/Notify), now wrapped as `<section id="certificates" className="scroll-mt-28">…existing card…</section>` (id already added in Task 3 — just move the wrapper if needed).
- The Linked Invoices card moves out of the left column to become its own full-width `<section id="invoices" className="scroll-mt-28">…existing card…</section>` after the certificates section.
- The two-column grid `<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">` now contains:
  - Left column `<div id="details" className="lg:col-span-2 space-y-8 scroll-mt-28">`:
    - `PoCollapsibleCard` wrapping `PoTermsCard` (open by default):

```tsx
            <PoCollapsibleCard title="Terms & Conditions" icon={<FileText className="h-5 w-5 text-primary" />} defaultOpen>
              <PoTermsCard
                poId={po.id}
                status={po.status}
                terms={po}
                penalty={penalty}
                canEdit={false}
                canOverride={canOverridePenalty}
              />
            </PoCollapsibleCard>
```
    - `PoCollapsibleCard` wrapping `PODetailsEditor` (collapsed):

```tsx
            <PoCollapsibleCard title="PO Details" icon={<Pencil className="h-5 w-5 text-primary" />}>
              <PODetailsEditor
                poId={po.id}
                description={po.description}
                issuedDate={po.issued_date}
                dueDate={po.due_date}
                draftedBy={draftedByLabel}
                approvedBy={approvedByLabel}
                canEdit={false}
              />
            </PoCollapsibleCard>
```
    - `PoCollapsibleCard` wrapping `POLineItemsEditor`, keeping the original render condition, with `count={lineItems?.length ?? 0}` (collapsed):

```tsx
            {(canEditDraft || (lineItems && lineItems.length > 0)) && (
              <PoCollapsibleCard title="Line Items" icon={<ClipboardList className="h-5 w-5 text-primary" />} count={lineItems?.length ?? 0}>
                <POLineItemsEditor
                  poId={po.id}
                  items={lineItems || []}
                  currencySymbol={currencySymbol}
                  canEdit={false}
                />
              </PoCollapsibleCard>
            )}
```
    - `PoCollapsibleCard` wrapping `POSiteDetailsEditor`, keeping the original render condition, with `count={siteDetails?.length ?? 0}` (collapsed):

```tsx
            {(canEditDraft || (siteDetails && siteDetails.length > 0)) && (
              <PoCollapsibleCard title="Site Details" icon={<MapPin className="h-5 w-5 text-primary" />} count={siteDetails?.length ?? 0}>
                <POSiteDetailsEditor
                  poId={po.id}
                  sites={siteDetails || []}
                  canEdit={false}
                />
              </PoCollapsibleCard>
            )}
```
    - History section:

```tsx
            <section id="history" className="scroll-mt-28">
              <PoCollapsibleCard title="Edit History" icon={<History className="h-5 w-5 text-primary" />}>
                <POEditHistory poId={po.id} />
              </PoCollapsibleCard>
            </section>
```
  - Right column `<div id="vendor" className="space-y-8 scroll-mt-28">` keeps Vendor Information, Associated Project, Internal Note unchanged.
- The original `PODetailsEditor`, `POLineItemsEditor`, `POSiteDetailsEditor`, `POEditHistory`, and Linked Invoices JSX are removed from their old positions (their content now lives in the collapsibles/sections above).

- [ ] **Step 4: Add missing icon imports**

Add `ClipboardList`, `MapPin`, `History` to the lucide-react import block at the top of the file (alphabetical order, matching the block style). `FileText`, `Pencil`, `Eye`, `Send`, `CreditCard` are already imported.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 6: Full build**

Run: `npm run build`
Expected: build succeeds with no type errors. (If env validation fails due to missing vars, report — do not stub.)

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/purchase-orders/\[id\]/page.tsx
git commit -m "feat: collapsible PO detail cards and reordered sections"
```

---

## Self-Review

**Spec coverage:**
- Sticky section nav (1) → Task 3 Step 3 ✓
- Header consolidation: primary per status + Download + More dropdown with Edit/Resend/PR (2) → Task 3 Step 2 ✓
- Financial merge: hero, bars, variance, quiet grid, PR block, ring dropped (3) → Task 4 ✓
- Collapsible detail cards with native details/summary, Terms open (4) → Task 5 Step 3 ✓
- Page order: Header → banners → nav → Financial Summary → PR/Notify → Certs → Invoices → details grid (5) → Tasks 3–5 ✓
- Untouched: banners, vendor rail, actions.ts, editors, list page ✓ (no tasks touch them)

**Placeholder scan:** No TBD/TODO; all code blocks complete; all variables referenced are defined in the page or earlier tasks.

**Type consistency:** `PoCollapsibleCard` props (`title`, `icon`, `count`, `defaultOpen`, `children`) match between Task 1 and Task 5 usage. `PoMoreDropdown({ children })` matches Task 2/3. No renamed functions. All icons exist in lucide-react (`MoreHorizontal`, `ClipboardList`, `MapPin`, `History`).
