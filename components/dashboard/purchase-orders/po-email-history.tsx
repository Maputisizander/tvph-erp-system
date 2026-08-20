import { createClient } from "@/utils/supabase/server";
import { EmailHistoryTable, type EmailLogRow } from "@/components/dashboard/emails/email-history-table";

/**
 * Per-PO "Email History" — every email that references this PO (issued,
 * e-sign link, approval/finance pings, signed-ack, payment-request notification).
 */
export async function PoEmailHistory({ poId, poNumber }: { poId: string; poNumber: string }) {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("email_log")
    .select(
      "id, kind, ref_id, to_addresses, cc_addresses, subject, status, resend_id, error, meta, created_at, created_by, delivered_at, opened_at, bounced_at",
    )
    .eq("ref_id", poId)
    .order("created_at", { ascending: false });

  const logs = (rows ?? []) as EmailLogRow[];

  const senderIds = Array.from(new Set(logs.map((r) => r.created_by).filter(Boolean))) as string[];
  const { data: senders } = senderIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", senderIds)
    : { data: [] as { id: string; full_name: string }[] };

  const poNumbers = new Map([[poId, poNumber]]);
  const senderNames = new Map((senders ?? []).map((p) => [p.id, p.full_name]));

  return (
    <EmailHistoryTable
      rows={logs}
      poNumbers={poNumbers}
      senderNames={senderNames}
      csvHref={`/api/purchase-orders/${poId}/email-log?format=csv`}
      subtitle={`Record of emails sent about this PO. ${logs.length} entr${logs.length === 1 ? "y" : "ies"}.`}
      emptyText="No emails have been sent for this PO yet."
    />
  );
}
