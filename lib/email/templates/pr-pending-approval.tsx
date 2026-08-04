import * as React from "react";
import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./layout";

export interface PrPendingApprovalEmailProps {
  prNumber: string;
  amountLabel?: string | null;
  downpaymentLabel?: string | null;
  downpaymentPercent?: number | null;
  submittedByName?: string | null;
  reviewUrl: string;
}

/**
 * Sent to the admins/superadmins the requester selected when a PR is submitted
 * for approval. Summary + link to the PR detail page where the approver can
 * Approve/Reject. The action lives in-app.
 */
export function PrPendingApprovalEmail({
  prNumber,
  amountLabel,
  downpaymentLabel,
  downpaymentPercent,
  submittedByName,
  reviewUrl,
}: PrPendingApprovalEmailProps) {
  return (
    <EmailLayout
      preview={`PR ${prNumber} is pending your approval`}
      footerQuestionText="Questions? Just reply to this email and our team will help."
    >
      <Text style={styles.heading}>Purchase Request {prNumber} needs your approval</Text>
      <Text style={styles.paragraph}>
        A purchase request has been submitted for approval. Once approved,
        procurement will convert it into a purchase order. You were selected as
        an approver.
      </Text>
      <Section style={styles.panel}>
        <Text style={styles.meta}>PR Number: {prNumber}</Text>
        {amountLabel ? <Text style={styles.meta}>Estimated Total: {amountLabel}</Text> : null}
        <Text style={{ ...styles.meta, ...(downpaymentLabel ? { color: "#b45309", fontWeight: 700 } : {}) }}>
          {downpaymentLabel
            ? `Downpayment: ${downpaymentPercent ? `${downpaymentPercent}% — ` : ""}${downpaymentLabel}`
            : "Downpayment: None"}
        </Text>
        {submittedByName ? (
          <Text style={styles.meta}>Submitted by: {submittedByName}</Text>
        ) : null}
      </Section>
      <Section style={{ margin: "8px 0 16px" }}>
        <Link href={reviewUrl} style={styles.button}>
          Review &amp; approve
        </Link>
      </Section>
      <Text style={styles.paragraph}>
        Open the purchase request to approve it, or reject it back to the
        requester with a reason.
      </Text>
    </EmailLayout>
  );
}

export default PrPendingApprovalEmail;
