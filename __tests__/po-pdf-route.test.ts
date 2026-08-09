/**
 * Unit tests for the PO PDF route — signed-file branch.
 * Runs under the Node test env so native Request/Response/Blob globals exist.
 * @jest-environment node
 */

import { GET } from "@/app/api/purchase-orders/[id]/pdf/route";

type RouteParams = Parameters<typeof GET>[0];

jest.mock("@/lib/auth/permissions", () => ({
  getCurrentProfile: jest.fn(async () => ({ error: null })),
}));

jest.mock("@/utils/supabase/service", () => ({
  createServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/pdf/renderPoDocument", () => ({
  renderPoDocument: jest.fn(async () => ({ buffer: Buffer.from("generated"), filename: "generated.pdf" })),
}));

import { createServiceRoleClient } from "@/utils/supabase/service";

const createServiceRoleClientMock = createServiceRoleClient as jest.Mock;

const SIGNED_URL = "https://x.supabase.co/storage/v1/object/public/po-artifacts/po/p1/signed-1.pdf";

function mockClient({
  poDocStatus = "approved",
  signedFileUrl = SIGNED_URL,
}: { poDocStatus?: string | null; signedFileUrl?: string | null } = {}) {
  const poChain = {
    select: jest.fn(() => poChain),
    eq: jest.fn(() => poChain),
    single: jest.fn(async () => ({ data: { signed_doc_status: poDocStatus }, error: null })),
  };
  const sigChain = {
    select: jest.fn(() => sigChain),
    eq: jest.fn(() => sigChain),
    order: jest.fn(() => sigChain),
    limit: jest.fn(() => sigChain),
    maybeSingle: jest.fn(async () =>
      signedFileUrl ? { data: { signed_file_url: signedFileUrl }, error: null } : { data: null, error: null },
    ),
  };
  const bucket = {
    download: jest.fn(async () => ({ data: new Blob(["pdf-bytes"]), error: null })),
  };
  const client = {
    from: jest.fn((table: string) => (table === "po_signatures" ? sigChain : poChain)),
    storage: { from: jest.fn(() => bucket) },
  };
  createServiceRoleClientMock.mockReturnValue(client);
  return { client, bucket };
}

describe("GET /api/purchase-orders/[id]/pdf", () => {
  it("serves the signed file when the signed doc is approved", async () => {
    mockClient();
    const res = await GET(new Request("http://localhost/api/purchase-orders/po-1/pdf") as unknown as RouteParams, {
      params: Promise.resolve({ id: "po-1" }),
    });
    expect(res.status).toBe(200);
    const body = Buffer.from(await res.arrayBuffer()).toString();
    expect(body).toBe("pdf-bytes");
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("renders the generated PDF when there is no approved signed file", async () => {
    mockClient({ poDocStatus: "pending_approval", signedFileUrl: null });
    const res = await GET(new Request("http://localhost/api/purchase-orders/po-1/pdf") as unknown as RouteParams, {
      params: Promise.resolve({ id: "po-1" }),
    });
    expect(res.status).toBe(200);
    const body = Buffer.from(await res.arrayBuffer()).toString();
    expect(body).toBe("generated");
  });
});