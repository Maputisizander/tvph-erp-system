import "server-only";

import { createServiceRoleClient } from "@/utils/supabase/service";
import { sendEmail, type SendEmailResult } from "./send";
import { PrPendingApprovalEmail } from "./templates/pr-pending-approval";

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
 * Emails the admins/superadmins recorded in `approval_requested_from` that a PR
 * is pending their approval. Decoupled from the submit action — always resolves
 * to a result so a failed send never blocks submission.
 */
export async function sendPrPendingApprovalEmail(
  prId: string,
  opts: { actorId?: string | null } = {},
): Promise<SendEmailResult> {
  const supabase = createServiceRoleClient();

  const { data: pr, error } = await supabase
    .from("purchase_requests")
    .select(
      `pr_number, amount, currency, approval_requested_from, submitted_for_approval_by`,
    )
    .eq("id", prId)
    .single();

  if (error || !pr) {
    return { status: "failed", error: error?.message || "Purchase request not found." };
  }

  const approverIds = (pr.approval_requested_from as string[] | null) || [];
  if (approverIds.length === 0) {
    return { status: "failed", error: "No approvers were selected for this PR." };
  }

  const { data: approvers } = await supabase
    .from("profiles")
    .select("email")
    .in("id", approverIds);

  const to = (approvers || [])
    .map((a) => a.email as string | null)
    .filter((e): e is string => !!e);

  if (to.length === 0) {
    return { status: "failed", error: "No approver email addresses found." };
  }

  const submitterId = opts.actorId ?? (pr.submitted_for_approval_by as string | null);
  let submittedByName: string | null = null;
  if (submitterId) {
    const { data: submitter } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", submitterId)
      .single();
    submittedByName = (submitter?.full_name as string | null) ?? null;
  }

  const currency = (pr.currency as string) || "PHP";

  return sendEmail({
    kind: "pr_pending_approval",
    refId: prId,
    to,
    subject: `PR ${pr.pr_number} is pending your approval`,
    react: PrPendingApprovalEmail({
      prNumber: pr.pr_number as string,
      amountLabel: formatAmount(pr.amount as number, currency),
      submittedByName,
      reviewUrl: `${BASE_URL}/dashboard/purchase-requests/${prId}`,
    }),
    createdBy: opts.actorId ?? null,
  });
}
