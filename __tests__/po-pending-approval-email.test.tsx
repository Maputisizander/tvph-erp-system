/**
 * Unit tests for the PO pending-approval email downpayment line.
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PoPendingApprovalEmail } from "@/lib/email/templates/po-pending-approval";

const baseProps = {
  poNumber: "PO-1001",
  vendorName: "Acme Supplies",
  amountLabel: "₱500,000.00",
  reviewUrl: "https://erp.telcovantage.com/dashboard/purchase-orders/1",
};

describe("PoPendingApprovalEmail - downpayment line", () => {
  it("renders downpayment line when downpaymentLabel is set", () => {
    const html = renderToStaticMarkup(
      <PoPendingApprovalEmail {...baseProps} downpaymentLabel="₱150,000.00 (30%)" />,
    );
    expect(html).toContain("Downpayment:");
    expect(html).toContain("₱150,000.00 (30%)");
  });

  it("omits downpayment line when downpaymentLabel is null", () => {
    const html = renderToStaticMarkup(
      <PoPendingApprovalEmail {...baseProps} downpaymentLabel={null} />,
    );
    expect(html).not.toContain("Downpayment:");
  });
});
