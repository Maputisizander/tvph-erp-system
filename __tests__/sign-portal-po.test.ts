/**
 * Unit tests for signPortalPO — required signed-PDF upload and status handling.
 */

import { signPortalPO } from "@/app/portal/actions";

jest.mock("@/utils/supabase/service", () => ({
  createServiceRoleClient: jest.fn(),
}));
jest.mock("@/utils/notifications", () => ({
  createNotification: jest.fn(async () => {}),
}));
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

const { createServiceRoleClient } = require("@/utils/supabase/service") as {
  createServiceRoleClient: jest.Mock;
};

function mockClient(overrides: Record<string, unknown> = {}) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    gt: jest.fn(() => chain),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    order: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    ...overrides,
  };
  const bucket = {
    upload: jest.fn(async () => ({ error: null })),
    getPublicUrl: jest.fn((path: string) => ({
      data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/po-artifacts/${path}` },
    })),
  };
  const client = {
    from: jest.fn(() => chain),
    storage: {
      from: jest.fn(() => bucket),
    },
  };
  createServiceRoleClient.mockReturnValue(client);
  return { chain, client };
}

const MAGIC = {
  entity_type: "po",
  entity_id: "po-1",
  expires_at: new Date(Date.now() + 86400000).toISOString(),
};
const PO = { id: "po-1", po_number: "PO-1", status: "pending_signature", vendors: { name: "Acme" } };
const PDF_FILE = { name: "signed.pdf", type: "application/pdf", arrayBuffer: async () => new ArrayBuffer(8) } as unknown as File;

describe("signPortalPO", () => {
  it("rejects a missing file", async () => {
    const { chain } = mockClient();
    chain.maybeSingle.mockResolvedValue({ data: MAGIC, error: null });
    chain.single.mockResolvedValue({ data: PO, error: null });

    const res = await signPortalPO("tok", "Jane Doe", "MD", "1.2.3.4", null as unknown as File);
    expect(res).toEqual({ error: "Please upload the signed purchase order PDF to complete signing." });
  });

  it("rejects a non-PDF file", async () => {
    const { chain } = mockClient();
    chain.maybeSingle.mockResolvedValue({ data: MAGIC, error: null });
    chain.single.mockResolvedValue({ data: PO, error: null });

    const doc = { ...PDF_FILE, type: "text/plain" } as unknown as File;
    const res = await signPortalPO("tok", "Jane Doe", "MD", "1.2.3.4", doc);
    expect(res).toEqual({ error: "Only PDF files are accepted for the signed purchase order." });
  });

  it("uploads the file, inserts the signature, and keeps the PO in pending_signature", async () => {
    const { chain, client } = mockClient();
    chain.maybeSingle.mockResolvedValue({ data: MAGIC, error: null });
    chain.single.mockResolvedValue({ data: PO, error: null });
    const upload = client.storage.from("po-artifacts").upload;
    upload.mockResolvedValue({ error: null });
    chain.insert.mockResolvedValue({ error: null });
    chain.update.mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });

    const res = await signPortalPO("tok", "Jane Doe", "MD", "1.2.3.4", PDF_FILE);

    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^po\/po-1\/signed-\d+\.pdf$/),
      expect.any(Buffer),
      { contentType: "application/pdf", upsert: false },
    );
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ po_id: "po-1", signer_name: "Jane Doe", signer_title: "MD", ip_address: "1.2.3.4" }),
    );
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending_signature", signed_doc_status: "pending_approval" }),
      { count: "exact" },
    );
    expect(res).toHaveProperty("success", true);
  });
});
