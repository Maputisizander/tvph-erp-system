import * as React from "react";
import {
  Body,
  Column,
  Container,
  Font,
  Head,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

// ---------------------------------------------------------------------------
// Brand + asset configuration
// All links/assets MUST be absolute and on the sending domain to avoid the
// SpamAssassin URI_PHISH penalty (link/domain mismatch). No placeholder
// (example.com) or relative URLs.
// ---------------------------------------------------------------------------
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://erp.telcovantage.com";

export const BRAND = "TVPH";

export const BRAND_FULL = "TelcoVantage Philippines";

const LOGO_URL = `${BASE_URL}/logo.png`;

const COMPANY_ADDRESS = [
  "Unit 1811, North Tower, Park Triangle Corporate Plaza",
  "32nd Street cor. 11th Ave, BGC, Taguig City",
];

const FONT = "Inter, system-ui, Arial, sans-serif";

const page: React.CSSProperties = {
  backgroundColor: "rgb(243,244,246)",
  margin: 0,
  fontFamily: FONT,
};

const card: React.CSSProperties = {
  maxWidth: "640px",
  margin: "2rem auto",
  width: "100%",
  backgroundColor: "#ffffff",
};

const hero: React.CSSProperties = {
  backgroundColor: "rgb(243,244,246)",
  borderRadius: "8px",
  textAlign: "left",
  padding: "32px 24px",
};

const footerSection: React.CSSProperties = {
  backgroundColor: "#ffffff",
  textAlign: "center",
  padding: "40px 24px",
};

/**
 * Centered "barebones" layout used for approval/notification emails: white card
 * on a gray page, logo header, a soft gray hero panel with the message + CTA,
 * and a minimal footer. Mirrors the reference visual.
 */
export function CenteredLayout({
  preview,
  children,
}: {
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <Html dir="ltr" lang="en">
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2",
            format: "woff2",
          }}
          fontWeight={500}
          fontStyle="normal"
        />
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2",
            format: "woff2",
          }}
          fontWeight={600}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={page}>
        <Container style={card}>
          <Section style={{ padding: "16px 24px" }}>
            <Row>
              <Column style={{ width: "50%", verticalAlign: "middle" }}>
                <Img src={LOGO_URL} alt={BRAND} width="23" style={{ display: "block" }} />
              </Column>
              <Column align="right" style={{ width: "50%", verticalAlign: "middle" }}>
                <Text style={styles.headerBrand}>{BRAND_FULL}</Text>
              </Column>
            </Row>
          </Section>

          <Section style={{ padding: "0 24px" }}>
            <Section style={hero}>
              <Img
                src={LOGO_URL}
                alt={BRAND}
                width="48"
                style={{ display: "block", margin: "0 auto 1.25rem" }}
              />
              {children}
            </Section>
          </Section>

          <Section style={footerSection}>
            <Text style={styles.footerSmall}>
              {COMPANY_ADDRESS[0]}
              <br />
              {COMPANY_ADDRESS[1]}
            </Text>
            <Text style={styles.footerSmall}>
              This is an automated message from {BRAND}. Please do not reply to this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Shared inline styles, matching the reference visual.
export const styles = {
  heading: {
    fontSize: "28px",
    fontWeight: 600,
    lineHeight: "1.3",
    color: "rgb(20,23,30)",
    margin: "0 0 16px",
    fontFamily: FONT,
  } as React.CSSProperties,
  paragraph: {
    fontSize: "16px",
    lineHeight: "1.5",
    fontWeight: 420,
    color: "rgb(67,69,75)",
    margin: "0 0 2rem",
    textAlign: "left" as const,
    fontFamily: FONT,
  } as React.CSSProperties,
  meta: {
    fontSize: "14px",
    lineHeight: "1.6",
    fontWeight: 500,
    color: "rgb(67,69,75)",
    margin: "0 0 4px",
    textAlign: "left" as const,
    fontFamily: FONT,
  } as React.CSSProperties,
  metaValue: {
    fontWeight: 700,
    color: "rgb(20,23,30)",
  } as React.CSSProperties,
  button: {
    backgroundColor: "#0a5c3b",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: 500,
    padding: "16px 28px",
    borderRadius: "8px",
    textDecoration: "none",
    display: "inline-block",
    margin: "2rem 0 1.5rem",
    fontFamily: FONT,
  } as React.CSSProperties,
  finePrint: {
    fontSize: "13px",
    lineHeight: "1.5",
    fontWeight: 420,
    color: "rgb(123,125,129)",
    margin: "2rem 0 0",
    textAlign: "left" as const,
    fontFamily: FONT,
  } as React.CSSProperties,
  headerBrand: {
    fontSize: "13px",
    lineHeight: "1.5",
    fontWeight: 420,
    letterSpacing: "-0.039px",
    color: "rgb(123,125,129)",
    margin: 0,
    fontFamily: FONT,
  } as React.CSSProperties,
  footerSmall: {
    fontSize: "11px",
    lineHeight: "1.5",
    fontWeight: 420,
    letterSpacing: "-0.033px",
    color: "rgb(123,125,129)",
    margin: "1rem 0 0",
    textAlign: "center" as const,
    fontFamily: FONT,
  } as React.CSSProperties,
};

export default CenteredLayout;
