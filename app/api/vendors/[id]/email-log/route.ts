import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateExportBuffer } from "@/utils/import-export";
import { requireCapability } from "@/lib/auth/permissions";
import { EMAIL_KIND_LABELS, emailReference } from "@/lib/email/kinds";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: vendorId } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  const supabase = await createClient();
  const { error: authError } = await requireCapability("export.vendor", supabase);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: authError === "Unauthorized" ? 401 : 403 });
  }

  const [{ data: vendor }, { data: rows, error }] = await Promise.all([
    supabase.from("vendors").select("name").eq("id", vendorId).maybeSingle(),
    supabase
      .from("email_log")
      .select("kind, ref_id, to_addresses, cc_addresses, subject, status, resend_id, error, meta, created_at, created_by")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false }),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const logs = rows ?? [];
  const poKinds = new Set(["po_issued", "po_for_signature", "po_pending_approval", "po_pending_finance", "po_signed_acknowledged", "payment_request_notification"]);
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

  const data = logs.map((r) => ({
    "Date Sent": new Date(r.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" }),
    Type: EMAIL_KIND_LABELS[r.kind] ?? r.kind,
    Reference: emailReference(r as { kind: string; ref_id: string | null; meta: Record<string, unknown> | null }, poNumbers),
    To: (r.to_addresses ?? []).join("; "),
    Cc: (r.cc_addresses ?? []).join("; "),
    Subject: r.subject ?? "",
    Status: r.status,
    "Message ID": r.resend_id ?? "",
    "Sent By": (r.created_by && senderNames.get(r.created_by)) || "System",
    Error: r.error ?? "",
  }));

  // Ensure a header row exists even when there are no emails yet.
  const exportRows = data.length
    ? data
    : [
        {
          "Date Sent": "",
          Type: "",
          Reference: "",
          To: "",
          Cc: "",
          Subject: "",
          Status: "",
          "Message ID": "",
          "Sent By": "",
          Error: "",
        },
      ];

  const blob = generateExportBuffer(exportRows, format);
  const safeName = (vendor?.name || "vendor").replace(/[^a-zA-Z0-9-]/g, "_");
  const filename = `vendor-emails_${safeName}_${new Date().toISOString().split("T")[0]}.${format}`;

  return new NextResponse(blob, {
    headers: {
      "Content-Type": blob.type,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
