# Signed PO PDF Upload + Requisitioner Approval

Date: 2026-08-09

## Problem

When a PO is sent for e-signature, the vendor can only type their name/title on the portal. There is no way for them to attach the executed/signed PO PDF, and no way for the requisitioner to review and approve that document. Once approved, viewing the PO's PDF should show the signed version, not the generated one.

## Goals

1. Vendor uploads the signed/executed PO PDF as a required part of completing their signature.
2. The requisitioner (PO creator) reviews the uploaded PDF and approves or rejects it.
3. PO status reflects the gate: `pending_signature` (awaiting vendor + review) and `signed` (final, approved).
4. Once approved, every "View PDF" path for the PO shows the uploaded signed file.

## Non-Goals (YAGNI)

- OCR / metadata extraction of the uploaded PDF.
- Document versioning.
- Automatic PDF stamping of the vendor's signature onto a generated PO PDF.
- A separate upload table or a second link/button in the email.
- Multiple approval roles (single requisitioner gate).

## Status Model

Two distinct statuses, replacing the current overloaded `signed` value:

| Value | Label | Meaning |
|---|---|---|
| `pending_signature` | Awaiting Signed PO | Signature requested; vendor signs + uploads; requisitioner reviews. (Renamed from current `signed`.) |
| `signed` | Signed | Final. Requisitioner approved the uploaded executed PDF. |

**Data migration:** existing `purchase_orders.status = 'signed'` rows become `pending_signature`.

## Data Model

Migration `add_signed_po_approval`:

- `po_signatures`
  - add `signed_file_url text`
  - add `signed_file_name text`
- `purchase_orders`
  - add `signed_doc_status text` — `null | 'pending_approval' | 'approved' | 'rejected'`
  - add `signed_doc_approved_by uuid`
  - add `signed_doc_approved_at timestamptz`
  - add `signed_doc_rejection_reason text`

Storage: existing `po-artifacts` bucket (private), path `po/{po_id}/signed-{ts}.pdf`. Reads use signed URLs via the existing `signDocUrls` helper (`utils/storage.ts`).

## Flow

### 1. Signature request (unchanged trigger)
`sendPOForSignature` (`app/dashboard/purchase-orders/actions.ts`) mints the portal magic link, sets `status='pending_signature'` and `sent_at`. (Currently writes `signed`.)

### 2. Vendor sign + upload (portal)
`signPortalPO` (`app/portal/actions.ts`) gains a required `file` param:

1. Reject early if file missing or not a PDF.
2. Upload to `po-artifacts` bucket.
3. Insert `po_signatures` row including `signed_file_url` / `signed_file_name`.
4. Set `signed_doc_status='pending_approval'`. **Stay in `pending_signature`** (currently it flips back to `issued`).

`PoSignForm` (`components/portal/po-sign-form.tsx`) adds a required PDF file input; submit is blocked until a file is chosen and the chosen filename is shown. The "already signed" portal view shows a **Download signed PO** link (signed URL).

### 3. Requisitioner review (dashboard)
New server action `reviewSignedPo(poId, decision, reason?)` (`app/dashboard/purchase-orders/actions.ts`), gated to the requisitioner (PO creator) or any user with `po.write`:

- **Approve** → `status='signed'`, `signed_doc_status='approved'`, `signed_doc_approved_by/at` set.
- **Reject** → stays `pending_signature`, `signed_doc_status='rejected'` + `signed_doc_rejection_reason`. Vendor re-uploads via the same portal link (still valid 7 days).

Dashboard PO detail page (`app/dashboard/purchase-orders/[id]/page.tsx`): when `status='pending_signature'` and `signed_doc_status='pending_approval'`, show a review card (download signed PDF + Approve / Reject-with-reason). Status banner copy updates: `pending_signature` shows "Awaiting Signed PO", `signed` shows the signed/approved banner.

### 4. Approved doc becomes the PO document
`GET /api/purchase-orders/[id]/pdf/route.ts`: if `signed_doc_status='approved'` and `signed_file_url` is set, stream the stored signed file; otherwise call `renderPoDocument(id)` as today. This route backs the dashboard PDF preview, the download dropdown, and "View PDF", so all show the signed version after approval.

### 5. Email
`lib/email/templates/po-for-signature.tsx` — no new button. Copy tweak so vendors know to bring their executed copy ("review, e-sign, and upload your executed copy").

## Status Labels & Badges

- `app/dashboard/purchase-orders/page.tsx` filter: `signed` label → "Awaiting Signed PO" → moved to `pending_signature`; add `signed` → "Signed".
- `purchase-orders-table-body.tsx` badge: `signed` branch → "Awaiting Signed PO" → `pending_signature`; add `signed` → "Signed".
- `app/dashboard/purchase-orders/[id]/page.tsx` banner conditions: `po.status === "signed"` → `"pending_signature"`.
- Status-badge helper `lib/ui/status-badge.ts` (STATUS_BADGE map): `signed` moves from amber to final-state style; `pending_signature` takes the amber awaiting slot.
- `app/portal/po/[token]/page.tsx`: re-sign prompt condition `po.status === "signed"` → `"pending_signature"`.

## Code Touchpoints Summary

- `app/dashboard/purchase-orders/actions.ts` — `sendPOForSignature` writes `pending_signature`; new `reviewSignedPo`.
- `app/portal/actions.ts` — `signPortalPO` file upload + no status flip; `validatePoPortalToken` returns `signed_file_url` (signed URL) for the download link.
- `components/portal/po-sign-form.tsx` — required PDF input.
- `app/dashboard/purchase-orders/[id]/page.tsx` — banner conditions, review card, status label.
- `app/dashboard/purchase-orders/page.tsx` + `purchase-orders-table-body.tsx` — filter/badge labels.
- `app/portal/po/[token]/page.tsx` — re-sign condition.
- `app/api/purchase-orders/[id]/pdf/route.ts` — signed-file branch.
- `lib/email/templates/po-for-signature.tsx` — copy tweak.
- `lib/email/po.ts` — comment updates only.

## Testing

Small unit tests mirroring the existing `__tests__/po-pending-approval-email.test.tsx` pattern (mocked supabase + storage):

1. `signPortalPO` — missing/`non-PDF` file rejected; valid file uploads and keeps status `pending_signature`; sets `signed_doc_status='pending_approval'`.
2. `reviewSignedPo` — approve sets `signed` + `approved` fields; reject keeps `pending_signature` and records the reason.
3. PDF route — serves the signed file when `signed_doc_status='approved'`, else renders via `renderPoDocument`.

## Edge Cases

- **Re-sign / re-upload:** the portal link stays valid for 7 days; re-signing replaces the latest signature (existing idempotent behavior) and resets `signed_doc_status` to `pending_approval`.
- **PO never sent for signature:** stays `issued`; no signed-doc fields set; PDF route falls through to `renderPoDocument`.
- **Vendor email fails after request:** unchanged — existing "resend" banner logic covers it.
