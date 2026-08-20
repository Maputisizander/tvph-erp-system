/**
 * Unit tests for reviewSignedPo — requisitioner approval gate.
 */

import { reviewSignedPo } from "@/app/dashboard/purchase-orders/actions";

jest.mock("@/lib/auth/permissions", () => ({
  requireCapability: jest.fn(async () => ({ user: { id: "user-1" }, error: null })),
}));

const requireCapabilityMock = jest.requireMock("@/lib/auth/permissions").requireCapability as jest.Mock;

jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn(),
}));

const { createClient } = require("@/utils/supabase/server") as { createClient: jest.Mock };

jest.mock("next/cache", () => ({ revalidatePath: jest.fn(), refresh: jest.fn() }));
jest.mock("@/utils/notifications", () => ({ createNotification: jest.fn(async () => {}) }));
jest.mock("@/utils/audit", () => ({ recordAuditLog: jest.fn(async () => {}) }));

function mockClient() {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    single: jest.fn(),
    update: jest.fn(() => chain),
  };
  createClient.mockResolvedValue({ from: jest.fn(() => chain) });
  return chain;
}

describe("reviewSignedPo", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns an error without permission", async () => {
    requireCapabilityMock.mockResolvedValue({ user: null, error: "Forbidden" });
    const res = await reviewSignedPo("po-1", "approve");
    expect(res).toEqual({ error: "Forbidden" });
  });

  it("rejects a non-pending PO", async () => {
    requireCapabilityMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const chain = mockClient();
    chain.single.mockResolvedValue({
      data: { id: "po-1", po_number: "PO-1", status: "issued", signed_doc_status: null, vendors: { name: "Acme" } },
      error: null,
    });

    const res = await reviewSignedPo("po-1", "approve");

    expect(res).toEqual({ error: "This purchase order has no signed document awaiting review." });
  });

  it("accepts a PO in signed_received and approves it", async () => {
    requireCapabilityMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    const chain = mockClient();
    chain.single.mockResolvedValue({
      data: { id: "po-1", po_number: "PO-1", status: "signed_received", signed_doc_status: "pending_approval", vendors: { name: "Acme" } },
      error: null,
    });
    chain.update.mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });

    const res = await reviewSignedPo("po-1", "approve");

    expect(res).toEqual({ success: true });
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "signed", signed_doc_status: "approved" }),
    );
  });
});
