import * as React from "react";
import { Link, Text } from "@react-email/components";
import { CenteredLayout, styles } from "./layout-centered";

export interface PoSignedReceivedEmailProps {
  poNumber: string;
  vendorName: string;
  amountLabel?: string | null;
  reviewUrl: string;
}

/**
 * Sent to the PO requestor (created_by) when the vendor returns a signed copy
 * via the portal. The signed doc is in and awaiting internal review.
 */
export function PoSignedReceivedEmail({
  poNumber,
  vendorName,
  amountLabel,
  reviewUrl,
}: PoSignedReceivedEmailProps) {
  return (
    <CenteredLayout preview={`PO ${poNumber} signed copy received`}>
      <Text style={styles.heading}>Purchase Order {poNumber} — signed copy received</Text>
      <Text style={styles.paragraph}>
        {vendorName} has returned a signed copy of purchase order {poNumber}. The
        signed document has been received and is now awaiting internal review.
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
      <Link href={reviewUrl} style={styles.button}>
        View purchase order
      </Link>
      <Text style={styles.finePrint}>
        Open the purchase order to review the signed copy and acknowledge it.
      </Text>
    </CenteredLayout>
  );
}

export default PoSignedReceivedEmail;