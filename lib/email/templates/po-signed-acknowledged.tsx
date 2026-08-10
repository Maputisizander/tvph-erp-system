import * as React from "react";
import { Link, Text } from "@react-email/components";
import { CenteredLayout, styles } from "./layout-centered";

export interface PoSignedAcknowledgedEmailProps {
  poNumber: string;
  vendorName: string;
  amountLabel?: string | null;
  downpaymentLabel?: string | null;
  acknowledgedByName?: string | null;
  reviewUrl: string;
}

/**
 * Sent internally (operations/admin/finance) when the originator approves the
 * vendor-signed copy of a PO. Informs the team that the signed copy was
 * acknowledged and the deployment may begin.
 */
export function PoSignedAcknowledgedEmail({
  poNumber,
  vendorName,
  amountLabel,
  downpaymentLabel,
  acknowledgedByName,
  reviewUrl,
}: PoSignedAcknowledgedEmailProps) {
  return (
    <CenteredLayout preview={`PO ${poNumber} signed copy acknowledged`}>
      <Text style={styles.heading}>Purchase Order {poNumber} signed copy acknowledged</Text>
      <Text style={styles.paragraph}>
        The originator has acknowledged the vendor&apos;s signed copy of this
        purchase order. The PO is now finalized and the deployment may begin.
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
      {acknowledgedByName ? (
        <Text style={styles.meta}>
          Acknowledged by: <span style={styles.metaValue}>{acknowledgedByName}</span>
        </Text>
      ) : null}
      <Link href={reviewUrl} style={styles.button}>
        View purchase order
      </Link>
      <Text style={styles.finePrint}>
        Open the purchase order to see the signed copy and proceed with the deployment.
      </Text>
    </CenteredLayout>
  );
}

export default PoSignedAcknowledgedEmail;
