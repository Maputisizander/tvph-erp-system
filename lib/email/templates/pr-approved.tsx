import * as React from "react";
import { Link, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./layout";

export interface PrApprovedEmailProps {
  prNumber: string;
  amountLabel?: string | null;
  downpaymentLabel?: string | null;
  downpaymentPercent?: number | null;
  approvedByName?: string | null;
  convertUrl: string;
}

/**
 * Sent to procurement (po.create capability holders) when a PR is approved and
 * ready to be converted into a purchase order.
 */
export function PrApprovedEmail({
  prNumber,
  amountLabel,
  downpaymentLabel,
  downpaymentPercent,
  approvedByName,
  convertUrl,
}: PrApprovedEmailProps) {
  return (
    <EmailLayout
      preview={`PR ${prNumber} approved — ready to convert`}
      footerQuestionText="Questions? Just reply to this email and our team will help."
    >
      <Text style={styles.heading}>Purchase Request {prNumber} was approved</Text>
      <Text style={styles.paragraph}>
        A purchase request has been approved and is ready to be converted into a
        purchase order. Open it to choose a vendor and confirm actual prices.
      </Text>
      <Section style={styles.panel}>
        <Text style={styles.meta}>PR Number: {prNumber}</Text>
        {amountLabel ? <Text style={styles.meta}>Estimated Total: {amountLabel}</Text> : null}
        <Text style={{ ...styles.meta, ...(downpaymentLabel ? { color: "#b45309", fontWeight: 700 } : {}) }}>
          {downpaymentLabel
            ? `Downpayment: ${downpaymentPercent ? `${downpaymentPercent}% — ` : ""}${downpaymentLabel}`
            : "Downpayment: None"}
        </Text>
        {approvedByName ? (
          <Text style={styles.meta}>Approved by: {approvedByName}</Text>
        ) : null}
      </Section>
      <Section style={{ margin: "8px 0 16px" }}>
        <Link href={convertUrl} style={styles.button}>
          Convert to PO
        </Link>
      </Section>
    </EmailLayout>
  );
}

export default PrApprovedEmail;
