import * as React from "react";
import { Link, Text } from "@react-email/components";
import { CenteredLayout, styles } from "./layout-centered";

export interface PoPendingFinanceEmailProps {
  poNumber: string;
  vendorName: string;
  amountLabel?: string | null;
  downpaymentLabel?: string | null;
  submittedByName?: string | null;
  approvedByName?: string | null;
  reviewUrl: string;
}

/**
 * Sent to the finance pool when a PO passes the admin stage and is pending the
 * finance budget check. Centered barebones layout with a summary + CTA link to
 * the PO detail page where finance can Approve/Reject.
 */
export function PoPendingFinanceEmail({
  poNumber,
  vendorName,
  amountLabel,
  downpaymentLabel,
  submittedByName,
  approvedByName,
  reviewUrl,
}: PoPendingFinanceEmailProps) {
  return (
    <CenteredLayout preview={`PO ${poNumber} is pending the finance review`}>
      <Text style={styles.heading}>Purchase Order {poNumber} needs the finance review</Text>
      <Text style={styles.paragraph}>
        Kindly review the purchase request against the available budget and let
        me know if any revisions are required. If everything is in order, I
        would appreciate your approval at your earliest convenience to avoid any
        delay in processing.
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
      {approvedByName ? (
        <Text style={styles.meta}>
          Approved by: <span style={styles.metaValue}>{approvedByName}</span>
        </Text>
      ) : null}
      <Link href={reviewUrl} style={styles.button}>
        Review &amp; approve
      </Link>
      <Text style={styles.finePrint}>
        Open the purchase order to approve and issue it to the vendor, or reject
        it back to the drafter with a reason.
      </Text>
    </CenteredLayout>
  );
}

export default PoPendingFinanceEmail;
