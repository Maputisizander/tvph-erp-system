import * as React from "react";
import { Link, Text } from "@react-email/components";
import { CenteredLayout, styles } from "./layout-centered";

export interface PoPendingApprovalEmailProps {
  poNumber: string;
  vendorName: string;
  amountLabel?: string | null;
  downpaymentLabel?: string | null;
  submittedByName?: string | null;
  reviewUrl: string;
}

/**
 * Sent to the admins/superadmins the creator selected when a PO is submitted
 * for approval. Centered barebones layout with a summary + CTA link to the PO
 * detail page where the approver can Approve/Reject.
 */
export function PoPendingApprovalEmail({
  poNumber,
  vendorName,
  amountLabel,
  downpaymentLabel,
  submittedByName,
  reviewUrl,
}: PoPendingApprovalEmailProps) {
  return (
    <CenteredLayout preview={`PO ${poNumber} is pending your approval`}>
      <Text style={styles.heading}>Purchase Order {poNumber} needs your approval</Text>
      <Text style={styles.paragraph}>
        Kindly review the purchase request and let me know if any revisions are
        required. If everything is in order, I would appreciate your approval at
        your earliest convenience to avoid any delay in processing.
      </Text>
      <Text style={styles.meta}>
        PO Number: <span style={styles.metaValue}>{poNumber}</span>
      </Text>
      <Text style={styles.meta}>
        Vendor: <span style={styles.metaValue}>{vendorName}</span>
      </Text>
      {amountLabel ? (
        <Text style={styles.meta}>
          Total Amount: <span style={styles.metaValue}>{amountLabel}</span>
        </Text>
      ) : null}
      {downpaymentLabel ? (
        <Text style={styles.meta}>
          Downpayment: <span style={styles.metaValue}>{downpaymentLabel}</span>
        </Text>
      ) : null}
      {submittedByName ? (
        <Text style={styles.meta}>
          Submitted by: <span style={styles.metaValue}>{submittedByName}</span>
        </Text>
      ) : null}
      <Link href={reviewUrl} style={styles.button}>
        Review &amp; approve
      </Link>
      <Text style={styles.finePrint}>
        Open the purchase order to approve and issue it, or reject it back to
        the drafter with a reason.
      </Text>
    </CenteredLayout>
  );
}

export default PoPendingApprovalEmail;
