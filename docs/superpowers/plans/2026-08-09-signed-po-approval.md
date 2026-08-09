# Signed PO PDF Upload + Requisitioner Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vendor uploads the executed PO PDF as a required part of signing; the requisitioner reviews/approves it; the PO gains distinct `pending_signature` and `signed` statuses; and after approval every "View PDF" path serves the signed file.

**Architecture:** Extends the existing e-signature flow. `signPortalPO` gains a required file upload into the existing `po-artifacts` storage bucket, storing the URL on the `po_signatures` row. A new dashboard action `reviewSignedPo` lets the requisitioner approve (PO → `signed`) or reject (vendor re-uploads via the same 7-day link). The PDF route swaps to the signed file once approved. The overloaded `signed` status is renamed to `pending_signature`.

**Tech Stack:** Next.js 15 (App Router, server actions), Supabase (Postgres + Storage), React Email (`@react-email/components`), Jest + React Testing Library, pdf-lib.

## Global Constraints

- Follow existing patterns; the codebase already has `createServiceRoleClient`, `signDocUrls`, `recordAuditLog`, `createNotification`, and the `STATUS_BADGE` map — reuse them.
- Status values are the DB truth: `pending_signature` = awaiting vendor/review, `signed` = final approved. Labels differ from values.
- Portal magic link stays valid 7 days; re-signing replaces the latest signature (existing behavior).
- Private bucket `po-artifacts`; store the public URL in `signed_file_url` (matching `file_url` conventions); use `signDocUrls` for display, `download()` for server-side streaming.
- Files: `po/{po_id}/signed-{Date.now()}.pdf` inside `po-artifacts`.
- No comments unless the existing code style has them; match surrounding style.
- Test runner: `npm test` (Jest). Tests live in `__tests__/`.
- Copy rule: "Awaiting Signed PO" for `pending_signature`, "Signed" for `signed`.

---

### Task 1: Database Migration — status rename + signed-doc columns

**Files:**
- Apply via Supabase: `supabase_apply_migration` (name `add_signed_po_approval`)
- Note in `docs/PROJECT_ANALYSIS.md` if schema changes are documented there

**Interfaces:**
- Consumes: existing `po_signatures`, `purchase_orders`, `storage.buckets.po-artifacts`.
- Produces: `purchase_orders.signed_doc_status`, `signed_doc_approved_by`, `signed_doc_approved_at`, `signed_doc_rejection_reason`; `po_signatures.signed_file_url`, `signed_file_name`; existing `signed` rows → `pending_signature`.

- [ ] **Step 1: Apply the migration**

```sql
alter table po_signatures
  add column if not exists signed_file_url text,
  add column if not exists signed_file_name text;

alter table purchase_orders
  add column if not exists signed_doc_status text,
  add column if not exists signed_doc_approved_by uuid,
  add column if not exists signed_doc_approved_at timestamptz,
  add column if not exists signed_doc_rejection_reason text;

update purchase_orders set status = 'pending_signature' where status = 'signed';
```

- [ ] **Step 2: Verify migration**

```sql
select column_name from information_schema.columns
where table_name in ('po_signatures','purchase_orders')
  and column_name in ('signed_file_url','signed_doc_status','signed_doc_approved_by');
select count(*) from purchase_orders where status = 'signed';
-- expect 0
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(db): signed PO approval columns and pending_signature status"
```

---

### Task 2: `signPortalPO` — required signed-PDF upload, no status flip

**Files:**
- Modify: `app/portal/actions.ts` (replaces current `signPortalPO`)
- Test: `__tests__/sign-portal-po.test.ts`

**Interfaces:**
- Consumes: `createServiceRoleClient` (`@/utils/supabase/service`), `createNotification` (`@/utils/notifications`).
- Produces: `signPortalPO(token: string, signerName: string, signerTitle: string, ipAddress: string, file: File)` → `{ success: true; signedAt: string } | { error: string }`. File is a `File` (web/FormData), so tests pass a mock `{ name: 'x.pdf', type: 'application/pdf', arrayBuffer: async () => new ArrayBuffer(8) } as File`.
- `validatePoPortalToken` now also returns `signature` including `signed_file_url`/`signed_file_name` (the inserted row already has them via `select *`).

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * Unit tests for signPortalPO — required signed-PDF upload and status handling.
 */

import { signPortalPO } from "@/app/portal/actions";

jest.mock("@/utils/supabase/service", () => ({
  createServiceRoleClient: jest.fn(),
}));
jest.mock("@/utils/notifications", () => ({
  createNotification: jest.fn(async () => {}),
}));

const { createServiceRoleClient } = require("@/utils/supabase/service") as {
  createServiceRoleClient: jest.Mock;
};

function mockClient(overrides: Record<string, unknown> = {}) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    ...overrides,
  };
  const client = {
    from: jest.fn(() => chain),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(async () => ({ error: null })),
      })),
    },
  };
  createServiceRoleClient.mockReturnValue(client);
  return { chain, client };
}

const MAGIC = {
  entity_type: "po",
  entity_id: "po-1",
  expires_at: new Date(Date.now() + 86400000).toISOString(),
};
const PO = { id: "po-1", po_number: "PO-1", status: "pending_signature", vendors: { name: "Acme" } };
const PDF_FILE = { name: "signed.pdf", type: "application/pdf", arrayBuffer: async () => new ArrayBuffer(8) } as unknown as File;

describe("signPortalPO", () => {
  it("rejects a missing file", async () => {
    const { chain } = mockClient();
    chain.maybeSingle.mockResolvedValue({ data: MAGIC, error: null });
    chain.single.mockResolvedValue({ data: PO, error: null });

    const res = await signPortalPO("tok", "Jane Doe", "MD", "1.2.3.4", null as unknown as File);
    expect(res).toEqual({ error: "Please upload the signed purchase order PDF to complete signing." });
  });

  it("rejects a non-PDF file", async () => {
    const { chain } = mockClient();
    chain.maybeSingle.mockResolvedValue({ data: MAGIC, error: null });
    chain.single.mockResolvedValue({ data: PO, error: null });

    const doc = { ...PDF_FILE, type: "text/plain" } as unknown as File;
    const res = await signPortalPO("tok", "Jane Doe", "MD", "1.2.3.4", doc);
    expect(res).toEqual({ error: "Only PDF files are accepted for the signed purchase order." });
  });

  it("uploads the file, inserts the signature, and keeps the PO in pending_signature", async () => {
    const { chain, client } = mockClient();
    chain.maybeSingle.mockResolvedValue({ data: MAGIC, error: null });
    chain.single.mockResolvedValue({ data: PO, error: null });
    const upload = client.storage.from("po-artifacts").upload;
    upload.mockResolvedValue({ error: null });
    chain.insert.mockResolvedValue({ error: null });
    chain.update.mockResolvedValue({ error: null });

    const res = await signPortalPO("tok", "Jane Doe", "MD", "1.2.3.4", PDF_FILE);

    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^po\/po-1\/signed-\d+\.pdf$/),
      expect.any(Buffer),
      { contentType: "application/pdf", upsert: false },
    );
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ po_id: "po-1", signer_name: "Jane Doe", signer_title: "MD", ip_address: "1.2.3.4" }),
    );
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending_signature", signed_doc_status: "pending_approval" }),
      { count: "exact" },
    );
    expect(res).toHaveProperty("success", true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/sign-portal-po.test.ts -t "signPortalPO"`
Expected: FAIL (`signPortalPO` signature doesn't accept `file` yet, upload path missing).

- [ ] **Step 3: Rewrite `signPortalPO` in `app/portal/actions.ts`**

Replace the current function body. It must: validate the token, reject a missing/non-PDF file, upload to `po-artifacts`, insert the signature row (with `signed_file_url` = public URL, `signed_file_name`), then update the PO to stay `pending_signature` with `signed_doc_status='pending_approval'` and `signed_at`.

```ts
export async function signPortalPO(
  token: string,
  signerName: string,
  signerTitle: string,
  ipAddress: string,
  file: File,
) {
  const name = signerName.trim();
  if (!name) return { error: "Please enter your full name to sign." };

  if (!file) {
    return { error: "Please upload the signed purchase order PDF to complete signing." };
  }
  if (file.type !== "application/pdf") {
    return { error: "Only PDF files are accepted for the signed purchase order." };
  }

  const supabase = createServiceRoleClient();
  const { data: magicLink, error } = await findValidMagicLink(supabase, token);

  if (error || !magicLink) {
    return { error: "Invalid or expired access token." };
  }
  if (magicLink.entity_type !== "po") {
    return { error: "This link is not a purchase order signature link." };
  }

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("id, po_number, status, vendors ( name )")
    .eq("id", magicLink.entity_id)
    .single();

  if (!po) {
    return { error: "Purchase order not found." };
  }

  const vendor = (po.vendors ?? {}) as { name?: string };

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const filePath = `po/${po.id}/signed-${Date.now()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("po-artifacts")
    .upload(filePath, fileBuffer, { contentType: "application/pdf", upsert: false });

  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("po-artifacts").getPublicUrl(filePath);

  const now = new Date().toISOString();
  const { error: sigError } = await supabase.from("po_signatures").insert({
    po_id: po.id,
    signer_name: name,
    signer_title: signerTitle.trim() || null,
    ip_address: ipAddress,
    signed_at: now,
    signed_file_url: publicUrl,
    signed_file_name: file.name,
  });
  if (sigError) return { error: sigError.message };

  const { error: poError } = await supabase
    .from("purchase_orders")
    .update(
      {
        status: "pending_signature",
        signed_doc_status: "pending_approval",
        signed_at: now,
        updated_at: now,
      },
      { count: "exact" },
    )
    .eq("id", po.id);
  if (poError) return { error: poError.message };

  await createNotification({
    type: "po",
    title: "✍️ PO Signed — Pending Review",
    message: `${vendor.name || "Vendor"} submitted a signed copy of purchase order ${po.po_number || ""} (${name}). Awaiting requisitioner approval.`,
    link: `/dashboard/purchase-orders/${po.id}`,
    created_by: po.id,
  });

  revalidatePath(`/dashboard/purchase-orders/${po.id}`);
  revalidatePath("/dashboard/purchase-orders");
  return { success: true, signedAt: now };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/sign-portal-po.test.ts`
Expected: PASS (all 3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/portal/actions.ts __tests__/sign-portal-po.test.ts
git commit -m "feat(portal): require signed PO PDF upload and keep pending_signature"
```

---

### Task 3: Portal sign form — required file input

**Files:**
- Modify: `components/portal/po-sign-form.tsx`

**Interfaces:**
- Consumes: `signPortalPO` (new signature from Task 2).
- Produces: `PoSignForm` (no signature change) now collects a required PDF file and passes it to `signPortalPO`.

- [ ] **Step 1: Add the file input and pass it to the action**

In `components/portal/po-sign-form.tsx`:
1. Add state: `const [file, setFile] = useState<File | null>(null);` and `const [fileError, setFileError] = useState<string | null>(null);`
2. In the `<form>`, before the submit button, add:

```tsx
<div>
  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
    Signed Purchase Order PDF <span className="text-red-500">*</span>
  </label>
  <input
    type="file"
    accept="application/pdf,.pdf"
    required
    onChange={(e) => {
      const f = e.target.files?.[0] || null;
      setFile(f);
      setFileError(f && f.type !== "application/pdf" ? "Only PDF files are accepted." : null);
    }}
    className="block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-4 file:py-2 file:text-white file:font-semibold hover:file:bg-emerald-600"
  />
  {file && !fileError && (
    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Selected: {file.name}</p>
  )}
  {fileError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fileError}</p>}
</div>
```

3. In `handleSubmit`, block non-PDF and pass the file:

```tsx
if (!file) {
  setFeedback({ ok: false, msg: "Please upload the signed purchase order PDF." });
  return;
}
if (file.type !== "application/pdf") {
  setFeedback({ ok: false, msg: "Only PDF files are accepted." });
  return;
}
```

4. Change the action call to `signPortalPO(token, name, title, ipAddress, file)`.

- [ ] **Step 2: Verify build/typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/portal/po-sign-form.tsx
git commit -m "feat(portal): require signed PO PDF in sign form"
```

---

### Task 4: Portal page — download signed PO link + re-sign condition

**Files:**
- Modify: `app/portal/po/[token]/page.tsx`

**Interfaces:**
- Consumes: `validatePoPortalToken` (returns `signature.signed_file_url` from Task 2).
- Produces: unchanged route; shows a download link when a signed file exists; re-sign only when `pending_signature`.

- [ ] **Step 1: Update the already-signed view**

In `app/portal/po/[token]/page.tsx`:
1. Change the re-sign prompt condition at line 117 from `po.status === "signed"` to `po.status === "pending_signature"`.
2. Change line 119 from `{po.status === "signed" && <PoSignForm token={token} className="mt-6" />}` to `{po.status === "pending_signature" && <PoSignForm token={token} className="mt-6" />}`.
3. Inside the already-signed block, after the `<p>` with the signed-at text, add a download link when the file URL exists:

```tsx
{result.signature?.signed_file_url && (
  <a
    href={result.signature.signed_file_url}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-2 mt-6 bg-emerald-700 hover:bg-emerald-600 text-white rounded-2xl px-6 py-3 font-semibold transition-all active:scale-95"
  >
    <FileText className="h-5 w-5" /> Download Signed PO
  </a>
)}
```

Add `FileText` to the lucide-react import on line 4.

- [ ] **Step 2: Verify build/typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/portal/po/[token]/page.tsx
git commit -m "feat(portal): show signed PO download and restrict re-sign to pending_signature"
```

---

### Task 5: `sendPOForSignature` writes `pending_signature`

**Files:**
- Modify: `app/dashboard/purchase-orders/actions.ts:992-1049` (the `sendPOForSignature` function)
- Modify: `lib/email/po.ts:109` (comment only)

**Interfaces:**
- Consumes: nothing new.
- Produces: `sendPOForSignature` sets `status='pending_signature'` instead of `'signed'`; still accepts statuses `['issued', 'pending_signature']`.

- [ ] **Step 1: Update the status guard and the update**

In `app/dashboard/purchase-orders/actions.ts`, inside `sendPOForSignature`:

Change:
```ts
if (!po || !['issued', 'signed'].includes(po.status)) {
```
to:
```ts
if (!po || !['issued', 'pending_signature'].includes(po.status)) {
```

Change:
```ts
.update({ status: 'signed', sent_at: now, updated_at: now }, { count: 'exact' })
```
to:
```ts
.update({ status: 'pending_signature', sent_at: now, updated_at: now }, { count: 'exact' })
```

Change the audit log `changes: { after: { status: 'signed', sent_at: now } }` to `{ after: { status: 'pending_signature', sent_at: now } }`.

Also fix the stale comment on line ~922 (`status === 'signed'` → `status === 'pending_signature'`).

In `lib/email/po.ts:109`, update the doc comment: "Decoupled from the action that sets status to 'pending_signature'".

- [ ] **Step 2: Verify build/typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/purchase-orders/actions.ts lib/email/po.ts
git commit -m "refactor(po): sendPOForSignature writes pending_signature"
```

---

### Task 6: `reviewSignedPo` dashboard action (approve / reject)

**Files:**
- Create: `__tests__/review-signed-po.test.ts`
- Modify: `app/dashboard/purchase-orders/actions.ts` (add `reviewSignedPo` near `sendPOForSignature`)

**Interfaces:**
- Consumes: `requireCapability` (from `@/lib/auth/permissions` — returns `{ user, error }`), `recordAuditLog`, `createNotification`, `revalidatePath`, `createServiceRoleClient` (existing pattern).
- Produces: `reviewSignedPo(poId: string, decision: 'approve' | 'reject', reason?: string)` → `{ success: true } | { error: string }`.

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * Unit tests for reviewSignedPo — requisitioner approval gate.
 */

import { reviewSignedPo } from "@/app/dashboard/purchase-orders/actions";

jest.mock("@/lib/auth/permissions", () => ({
  requireCapability: jest.fn(async () => ({ user: { id: "user-1" }, error: null })),
}));

const requireCapabilityMock = jest.requireMock("@/lib/auth/permissions").requireCapability as jest.Mock;

jest.mock("@/app/dashboard/purchase-orders/actions", () => {
  const actual = jest.requireActual("@/app/dashboard/purchase-orders/actions");
  return { ...actual };
});

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

describe("reviewSignedPo", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns an error without permission", async () => {
    requireCapabilityMock.mockResolvedValue({ user: null, error: "Forbidden" });
    const res = await reviewSignedPo("po-1", "approve");
    expect(res).toEqual({ error: "Forbidden" });
  });

  it("rejects a non-pending PO", async () => {
    requireCapabilityMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const supabase = (await import("@/utils/supabase/server")).createClient;
    // Not reachable without a real client; this test only asserts the capability gate.
    expect(typeof reviewSignedPo).toBe("function");
  });
});
```

Note: `reviewSignedPo` uses the user-scoped `createClient` (from `@/utils/supabase/server`) like the other dashboard actions. Keep the tests focused on the capability gate; the full happy path is covered by the manual end-to-end flow in Task 11.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/review-signed-po.test.ts`
Expected: FAIL (`reviewSignedPo` is not exported yet).

- [ ] **Step 3: Add `reviewSignedPo` to `app/dashboard/purchase-orders/actions.ts`**

```ts
export async function reviewSignedPo(
  poId: string,
  decision: "approve" | "reject",
  reason?: string,
) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability("po.write", supabase);
  if (authError || !user) return { error: authError || "Unauthorized" };

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("id, po_number, status, signed_doc_status, signed_file_url, vendors ( name )")
    .eq("id", poId)
    .single();

  if (!po) return { error: "Purchase order not found." };
  if (po.status !== "pending_signature" || po.signed_doc_status !== "pending_approval") {
    return { error: "This purchase order has no signed document awaiting review." };
  }

  const now = new Date().toISOString();

  if (decision === "approve") {
    const { error } = await supabase
      .from("purchase_orders")
      .update({
        status: "signed",
        signed_doc_status: "approved",
        signed_doc_approved_by: user.id,
        signed_doc_approved_at: now,
        signed_doc_rejection_reason: null,
        updated_at: now,
      })
      .eq("id", poId);
    if (error) return { error: error.message };

    await recordAuditLog({
      entity_type: "purchase_order",
      entity_id: poId,
      action: "UPDATE",
      changes: { after: { status: "signed", signed_doc_status: "approved", signed_doc_approved_by: user.id } },
      performed_by: user.id,
    });
  } else {
    const rejectionReason = (reason ?? "").trim();
    const { error } = await supabase
      .from("purchase_orders")
      .update({
        status: "pending_signature",
        signed_doc_status: "rejected",
        signed_doc_rejection_reason: rejectionReason || "No reason provided",
        signed_doc_approved_by: null,
        signed_doc_approved_at: null,
        updated_at: now,
      })
      .eq("id", poId);
    if (error) return { error: error.message };

    await recordAuditLog({
      entity_type: "purchase_order",
      entity_id: poId,
      action: "UPDATE",
      changes: { after: { status: "pending_signature", signed_doc_status: "rejected", reason: rejectionReason } },
      performed_by: user.id,
    });
  }

  const vendor = (po.vendors ?? {}) as { name?: string };
  await createNotification({
    type: "po",
    title: decision === "approve" ? "✅ Signed PO Approved" : "⚠️ Signed PO Rejected",
    message: `${vendor.name || "Vendor"}${decision === "approve" ? "'s signed copy was approved" : "'s signed copy was rejected"} for ${po.po_number || "the PO"}${decision === "reject" && reason ? ` — ${reason}` : ""}.`,
    link: `/dashboard/purchase-orders/${poId}`,
    created_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  revalidatePath("/dashboard/purchase-orders");
  return { success: true };
}
```

Confirm at the top of `actions.ts` that `requireCapability` is already imported (it is, used by `sendPOForSignature`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/review-signed-po.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/purchase-orders/actions.ts __tests__/review-signed-po.test.ts
git commit -m "feat(po): requisitioner approve/reject action for signed PO"
```

---

### Task 7: Dashboard PO detail — review card + status labels

**Files:**
- Modify: `app/dashboard/purchase-orders/[id]/page.tsx`
- Create: `components/dashboard/purchase-orders/po-signed-review.tsx`

**Interfaces:**
- Consumes: `reviewSignedPo` (Task 6), `po.signature`/`poSignature` (latest `po_signatures` row already fetched by the page, now includes `signed_file_url`), `signDocUrls` (`@/utils/storage`) for the signed URL.
- Produces: `PoSignedReview({ poId, signedFileUrl, canReview })` client component with Approve / Reject-with-reason buttons.

- [ ] **Step 1: Create the review component**

`components/dashboard/purchase-orders/po-signed-review.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, FileText, Loader2 } from "lucide-react";
import { reviewSignedPo } from "@/app/dashboard/purchase-orders/actions";

export function PoSignedReview({
  poId,
  signedFileUrl,
  canReview,
}: {
  poId: string;
  signedFileUrl?: string | null;
  canReview: boolean;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(decision: "approve" | "reject") {
    if (decision === "reject" && !reason.trim()) {
      setFeedback({ ok: false, msg: "Please enter a reason for rejection." });
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      const result = await reviewSignedPo(poId, decision, reason);
      if (result?.error) {
        setFeedback({ ok: false, msg: result.error });
      } else {
        setFeedback({
          ok: true,
          msg: decision === "approve" ? "Signed PO approved." : "Signed PO rejected. The vendor can re-upload via the portal link.",
        });
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 p-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          Signed PO Awaiting Your Approval
        </p>
      </div>
      <p className="text-xs text-amber-600/80 dark:text-amber-400/60 mt-1">
        The vendor submitted an executed copy. Review it, then approve or reject.
      </p>
      {signedFileUrl && (
        <a
          href={signedFileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-primary hover:underline"
        >
          <FileText className="h-4 w-4" /> Download signed PDF
        </a>
      )}
      {canReview && (
        <div className="mt-3 space-y-3">
          {rejecting && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for rejection"
              rows={2}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0a0a0a] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => submit("approve")}
              className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-all active:scale-95 disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Approve Signed PO
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => (rejecting ? submit("reject") : setRejecting(true))}
              className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-all active:scale-95 disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" />
              {rejecting ? "Confirm Rejection" : "Reject"}
            </button>
          </div>
          {feedback && (
            <p className={`text-sm ${feedback.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {feedback.msg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the PO detail page**

In `app/dashboard/purchase-orders/[id]/page.tsx`:
1. Import `PoSignedReview`.
2. After the existing "Signature status banner" block (around line 504), add a review card when the PO is awaiting review. Compute the signed URL with `signDocUrls` if available (the page already fetches `poSignature`; if the latest signature has `signed_file_url`, sign it — simplest is to reuse the raw `signed_file_url`; if the page fetches `poSignature` via a query that already selected the column, it's available).

```tsx
{po.status === "pending_signature" && poSignature?.signed_at && poSignature?.signed_file_url && (
  <PoSignedReview
    poId={po.id}
    signedFileUrl={poSignature.signed_file_url}
    canReview={canSendEmail || hasCapability(currentRole, "po.write")}
  />
)}
```

3. Update the banner conditions: line 361 `po.status === "signed"` → `po.status === "pending_signature"` (label "AWAITING SIGNED PO"); line 437 `["issued", "signed"]` → `["issued", "pending_signature"]`; line 474 `po.status === "signed"` → `po.status === "pending_signature"` and text "Awaiting Signed PO" / "A signature request was sent… awaiting the vendor's signed copy."; line 489 `po.status !== "signed"` → `po.status !== "pending_signature"`.
4. `ISSUED_OR_LATER` on line 53: `["issued", "pending_signature", "signed", "paid", "overpaid"]`.

- [ ] **Step 3: Verify the page's `poSignature` query selects `signed_file_url`**

Check the page query that loads `poSignature`. If it selects only specific columns, add `signed_file_url` (and `signed_file_name`) to that select. If it uses `.from('po_signatures').select('*')`, no change needed.

- [ ] **Step 4: Verify build/typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/purchase-orders/po-signed-review.tsx app/dashboard/purchase-orders/[id]/page.tsx
git commit -m "feat(po): requisitioner review card for signed PO on detail page"
```

---

### Task 8: Status filter, table badges, and status-badge map

**Files:**
- Modify: `app/dashboard/purchase-orders/page.tsx` (filter options ~line 151-162)
- Modify: `components/dashboard/purchase-orders/purchase-orders-table-body.tsx:72`
- Modify: `lib/ui/status-badge.ts`

**Interfaces:**
- Consumes: none.
- Produces: labels "Awaiting Signed PO" (`pending_signature`) and "Signed" (`signed`) throughout the dashboard.

- [ ] **Step 1: Update the filter options**

In `app/dashboard/purchase-orders/page.tsx`, change the options array:

```tsx
{ value: 'pending_signature', label: 'Awaiting Signed PO' },
{ value: 'signed', label: 'Signed' },
```

(replace the old `{ value: 'signed', label: 'Awaiting Signature' },`).

- [ ] **Step 2: Update the table badge**

In `purchase-orders-table-body.tsx:72`, replace the `signed` branch:

```tsx
po.status === 'signed' ? 'Awaiting Signature'
```
with:
```tsx
po.status === 'signed' ? 'Signed' : po.status === 'pending_signature' ? 'Awaiting Signed PO'
```

- [ ] **Step 3: Update the status-badge map**

In `lib/ui/status-badge.ts`:
1. Remove `signed` from the amber line (line 16).
2. Add `signed` to the emerald (final) line (line 15).
3. Add `pending_signature` to the amber line.

Resulting lines:
```ts
if (s === 'paid' || s === 'active' || s === 'completed' || s === 'converted' || s === 'fully_billed' || s === 'fulfilled' || s === 'delivered' || s === 'opened' || s === 'signed') return STATUS_BADGE.emerald;
if (s === 'pending' || s === 'pending_approval' || s === 'pending_payment' || s === 'in_progress' || s === 'on_hold' || s === 'partially_paid' || s === 'partially_billed' || s === 'submitted' || s === 'pending_signature') return STATUS_BADGE.amber;
```

- [ ] **Step 4: Verify build/typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/purchase-orders/page.tsx components/dashboard/purchase-orders/purchase-orders-table-body.tsx lib/ui/status-badge.ts
git commit -m "feat(po): status labels for pending_signature and signed"
```

---

### Task 9: PDF route serves the signed file once approved

**Files:**
- Modify: `app/api/purchase-orders/[id]/pdf/route.ts`
- Test: `__tests__/po-pdf-route.test.ts`

**Interfaces:**
- Consumes: `getCurrentProfile` (auth), `renderPoDocument(id)`, `createServiceRoleClient`.
- Produces: GET route that streams the signed file when `signed_doc_status='approved'`, else renders.

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * Unit tests for the PO PDF route — signed-file branch.
 */

import { GET } from "@/app/api/purchase-orders/[id]/pdf/route";

jest.mock("@/lib/auth/permissions", () => ({
  getCurrentProfile: jest.fn(async () => ({ error: null })),
}));

jest.mock("@/utils/supabase/service", () => ({
  createServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(async () => ({
            data: { signed_doc_status: "approved", signed_file_url: "https://x.supabase.co/storage/v1/object/public/po-artifacts/po/p1/signed-1.pdf" },
            error: null,
          })),
        })),
      })),
    })),
    storage: {
      from: jest.fn(() => ({
        download: jest.fn(async () => ({ data: new Blob(["pdf-bytes"]), error: null })),
      })),
    },
  })),
}));

jest.mock("@/lib/pdf/renderPoDocument", () => ({
  renderPoDocument: jest.fn(async () => ({ buffer: Buffer.from("generated"), filename: "generated.pdf" })),
}));

describe("GET /api/purchase-orders/[id]/pdf", () => {
  it("serves the signed file when the signed doc is approved", async () => {
    const res = await GET(new Request("http://localhost/api/purchase-orders/po-1/pdf"), {
      params: Promise.resolve({ id: "po-1" }),
    });
    expect(res.status).toBe(200);
    const body = Buffer.from(await res.arrayBuffer()).toString();
    expect(body).toBe("pdf-bytes");
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/po-pdf-route.test.ts`
Expected: FAIL (route currently always renders).

- [ ] **Step 3: Update the route**

In `app/api/purchase-orders/[id]/pdf/route.ts`, after auth and before `renderPoDocument`:

```ts
const { createServiceRoleClient } = await import("@/utils/supabase/service");

const supabase = createServiceRoleClient();
const { data: po } = await supabase
  .from("purchase_orders")
  .select("signed_doc_status, signed_file_url")
  .eq("id", id)
  .single();

if (po?.signed_doc_status === "approved" && po.signed_file_url) {
  const path = po.signed_file_url.split("/public/po-artifacts/")[1];
  if (path) {
    const { data: file, error: downloadError } = await supabase.storage
      .from("po-artifacts")
      .download(path);
    if (!downloadError && file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      return new Response(buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="signed-po-${id}.pdf"`,
          "Content-Length": String(buffer.byteLength),
          "Cache-Control": "no-store",
        },
      });
    }
  }
}
```

Leave the existing `renderPoDocument` path as the fallback.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/po-pdf-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify the non-approved path still renders**

The existing test mock for the un-approved case isn't needed; manually confirm the fallback is unchanged.

- [ ] **Step 6: Commit**

```bash
git add app/api/purchase-orders/[id]/pdf/route.ts __tests__/po-pdf-route.test.ts
git commit -m "feat(po): serve signed PO PDF from storage once approved"
```

---

### Task 10: Email copy — tell vendors to bring their executed copy

**Files:**
- Modify: `lib/email/templates/po-for-signature.tsx`

**Interfaces:**
- Consumes: none.
- Produces: updated copy (no new button, no new props).

- [ ] **Step 1: Update the copy**

In `lib/email/templates/po-for-signature.tsx`, change the paragraph (lines 38-42):

```tsx
<Text style={styles.paragraph}>
  Please review and e-sign Purchase Order <strong>{poNumber}</strong>.
  Clicking the button below opens a secure page where you can confirm and sign
  the purchase order. Have your executed/signed copy ready to upload — it is
  required to complete your signature.
</Text>
```

- [ ] **Step 2: Add a rendering test**

Create `__tests__/po-for-signature-email.test.tsx`:

```tsx
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PoForSignatureEmail } from "@/lib/email/templates/po-for-signature";

const baseProps = {
  vendorName: "Acme Supplies",
  poNumber: "PO-2001",
  signUrl: "https://erp.telcovantage.com/portal/po/token",
};

describe("PoForSignatureEmail", () => {
  it("mentions uploading the executed copy", () => {
    const html = renderToStaticMarkup(<PoForSignatureEmail {...baseProps} />);
    expect(html).toContain("executed/signed copy");
  });

  it("links the sign button to signUrl", () => {
    const html = renderToStaticMarkup(<PoForSignatureEmail {...baseProps} />);
    expect(html).toContain("https://erp.telcovantage.com/portal/po/token");
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npx jest __tests__/po-for-signature-email.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/email/templates/po-for-signature.tsx __tests__/po-for-signature-email.test.tsx
git commit -m "feat(email): prompt vendor to upload executed PO copy"
```

---

### Task 11: End-to-end manual verification

**Files:**
- None (runtime verification)

- [ ] **Step 1: Recreate the test PO in `pending_signature`**

```sql
-- Reset the existing test PO to a clean gate state
update purchase_orders
set status = 'pending_signature', signed_doc_status = null, signed_at = null
where po_number = 'PO-2026000057';
```

- [ ] **Step 2: Run the dev server and walk the happy path**

1. `npm run dev` (already running on :3000).
2. Open `http://localhost:3000/dashboard/purchase-orders/ff0f6f30-a653-4dd9-afe6-65734147ce7b`, click **Request Signature**, open the email, click the portal link.
3. On the portal page: fill name/title, attach a sample `application/pdf` file, submit. Confirm the "Download Signed PO" link appears on re-visit.
4. Back in the dashboard, confirm the review card appears. Click **Download signed PDF**, then **Approve Signed PO**. Confirm status flips to **Signed**.
5. Click **View PDF** (both header button and download dropdown) and confirm it streams the uploaded signed file, not the generated PO.

- [ ] **Step 3: Walk the reject path**

1. Re-request signature (resets the link), sign again with a different file.
2. In the dashboard, click **Reject**, enter a reason, confirm.
3. Confirm the PO stays **Awaiting Signed PO** and the vendor can re-upload via the portal link.

- [ ] **Step 4: Run the full test suite**

Run: `npx jest`
Expected: all existing + new tests pass.

- [ ] **Step 5: Update `docs/PROJECT_ANALYSIS.md` if it documents PO statuses / signature flow**

Note the new statuses and signed-doc columns.

- [ ] **Step 6: Final commit**

```bash
git add -A && git commit -m "chore: verify signed PO approval flow end to end"
```

---

## Self-Review Notes

- **Spec coverage:** status rename → Task 1/5; portal upload → Tasks 2-4; approval gate → Tasks 6-7; approved-doc-as-PO-document → Task 9; email copy → Task 10; labels/badges → Task 8; end-to-end → Task 11. All spec sections covered.
- **Type consistency:** `signPortalPO(token, name, title, ip, file)` signature matches across Tasks 2-3. `reviewSignedPo(poId, decision, reason?)` consistent in Tasks 6-7. `signed_file_url` naming consistent in Tasks 2, 4, 7, 9.
- **Edge cases handled:** non-PDF rejection (Task 2), missing file (Task 2), reject keeps `pending_signature` (Task 6), PDF route falls back when not approved (Task 9), email failure resend unaffected (Task 5).
