import { createClient } from "@/utils/supabase/server";
import { EmailHistoryTable, type EmailLogRow } from "@/components/dashboard/emails/email-history-table";

/**
 * Per-vendor "Email History" — vendor-facing emails (PO issued, e-sign requests,
 * payment notifications, doc reminders/requests) dispatched to this vendor.
 * Read-only; backed by email_log (RLS restricts reads to staff).
 */
export async function VendorEmailHistory({ vendorId }: { vendorId: string }) {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("email_log")
    .select(
      "id, kind, ref_id, to_addresses, cc_addresses, subject, status, resend_id, error, meta, created_at, created_by, delivered_at, opened_at, bounced_at",
    )
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });

  const logs = (rows ?? []) as EmailLogRow[];

  // Resolve PO numbers for any PO-related email (po_issued, po_for_signature, payment_request_notification, etc.)
  const poKinds = new Set([
    "po_issued",
    "po_for_signature",
    "po_pending_approval",
    "po_pending_finance",
    "po_signed_acknowledged",
    "payment_request_notification",
  ]);
  const poIds = logs.filter((r) => poKinds.has(r.kind) && r.ref_id).map((r) => r.ref_id as string);
  const senderIds = Array.from(new Set(logs.map((r) => r.created_by).filter(Boolean))) as string[];

  const [{ data: poRows }, { data: senders }] = await Promise.all([
    poIds.length
      ? supabase.from("purchase_orders").select("id, po_number").in("id", poIds)
      : Promise.resolve({ data: [] as { id: string; po_number: string }[] }),
    senderIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", senderIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const poNumbers = new Map((poRows ?? []).map((p) => [p.id, p.po_number]));
  const senderNames = new Map((senders ?? []).map((p) => [p.id, p.full_name]));

  return (
    <EmailHistoryTable
      rows={logs}
      poNumbers={poNumbers}
      senderNames={senderNames}
      csvHref={`/api/vendors/${vendorId}/email-log?format=csv`}
      subtitle={`Record of emails sent to this vendor\u2019s contact. ${logs.length} entr${logs.length === 1 ? "y" : "ies"}.`}
      emptyText="No emails have been sent to this vendor yet."
    />
  );
}
