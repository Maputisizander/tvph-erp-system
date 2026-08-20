import "server-only";

import { createServiceRoleClient } from "@/utils/supabase/service";
import { sendEmail, type SendEmailResult } from "./send";
import { PoSignedReceivedEmail } from "./templates/po-signed-received";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://erp.telcovantage.com";

function formatAmount(amount: number | null | undefined, currency: string) {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "PHP",
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

/**
 * Emails the PO requestor (created_by) that the vendor has returned a signed
 * copy, so they know the PO moved from "awaiting signature" to review. Fired
 * from signPortalPO; always resolves to a result so a failed send never
 * breaks the vendor's portal upload.
 */
export async function sendPoSignedReceivedEmail(
  poId: string,
  opts: { actorId?: string | null } = {},
): Promise<SendEmailResult> {
  const supabase = createServiceRoleClient();

  const { data: po, error } = await supabase
    .from("purchase_orders")
    .select("po_number, amount, currency, vendor_id, creator:profiles!created_by ( full_name, email ), vendors ( name )")
    .eq("id", poId)
    .single();

  if (error || !po) {
    return { status: "failed", error: error?.message || "Purchase order not found." };
  }

  const creator = (po.creator ?? {}) as { full_name?: string | null; email?: string | null };
  const to = creator.email ? [creator.email] : [];
  if (to.length === 0) {
    return { status: "failed", error: "PO requestor has no email address." };
  }

  const vendor = (po.vendors ?? {}) as { name?: string };
  const currency = (po.currency as string) || "PHP";

  return sendEmail({
    kind: "po_signed_received",
    refId: poId,
    to,
    subject: `PO ${po.po_number} — signed copy received, pending review`,
    react: PoSignedReceivedEmail({
      poNumber: po.po_number as string,
      vendorName: vendor.name || "Vendor",
      amountLabel: formatAmount(po.amount as number, currency),
      reviewUrl: `${BASE_URL}/dashboard/purchase-orders/${poId}`,
    }),
    createdBy: opts.actorId ?? null,
    vendorId: (po.vendor_id as string | null) ?? null,
  });
}