import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PoForSignatureEmail } from "@/lib/email/templates/po-for-signature";

const baseProps = {
  vendorName: "Acme Supplies",
  poNumber: "PO-2001",
  signUrl: "https://erp.telcovantage.com/portal/po/token",
};

describe("PoForSignatureEmail", () => {
  it("mentions uploading the executed copy", () => {
    const html = renderToStaticMarkup(<PoForSignatureEmail {...baseProps} />);
    expect(html).toContain("executed/signed copy");
  });

  it("links the sign button to signUrl", () => {
    const html = renderToStaticMarkup(<PoForSignatureEmail {...baseProps} />);
    expect(html).toContain("https://erp.telcovantage.com/portal/po/token");
  });
});