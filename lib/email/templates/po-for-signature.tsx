import * as React from "react";
import { Section, Text, Button, Link } from "@react-email/components";
import { EmailLayout, styles } from "./layout";

export interface PoForSignatureEmailProps {
  vendorName: string;
  vendorContact?: string | null;
  poNumber: string;
  poDate?: string | null;
  amountLabel?: string | null;
  signUrl: string;
  senderName?: string | null;
}

/**
 * Sent to the vendor's contact when procurement requests a PO e-signature.
 * Contains a magic link to the secure signature portal (rendered as both a
 * styled button and a fallback plain-text URL for stricter mail clients).
 */
export function PoForSignatureEmail({
  vendorName,
  vendorContact,
  poNumber,
  poDate,
  amountLabel,
  signUrl,
  senderName,
}: PoForSignatureEmailProps) {
  return (
    <EmailLayout
      preview={`Sign Purchase Order ${poNumber} — TVPH`}
      footerQuestionText="Questions? Just reply to this email and our team will help."
    >
      <Text style={styles.heading}>E-Sign Purchase Order {poNumber}</Text>
      <Text style={styles.paragraph}>
        Dear {vendorContact || vendorName},
      </Text>
      <Text style={styles.paragraph}>
        Please review and e-sign Purchase Order <strong>{poNumber}</strong>.
        Clicking the button below opens a secure page where you can confirm and
        sign the purchase order.
      </Text>
      <Section style={styles.panel}>
        <Text style={styles.meta}>PO Number: {poNumber}</Text>
        {poDate ? <Text style={styles.meta}>Date Issued: {poDate}</Text> : null}
        {amountLabel ? (
          <Text style={styles.meta}>Total Amount: {amountLabel}</Text>
        ) : null}
      </Section>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <Button style={styles.button} href={signUrl}>
          Review &amp; Sign Purchase Order
        </Button>
      </Section>
      <Text style={styles.paragraph}>
        If the button does not work, copy and paste this link into your browser:
      </Text>
      <Text style={styles.paragraph}>
        <Link href={signUrl} style={{ color: "#0a5c3b", wordBreak: "break-all" }}>
          {signUrl}
        </Link>
      </Text>
      <Text style={styles.paragraph}>
        Best regards,
        <br />
        {senderName || "TVPH Procurement"}
      </Text>
    </EmailLayout>
  );
}

export default PoForSignatureEmail;
