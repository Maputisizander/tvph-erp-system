import { fetchVendorNodes } from "@/lib/node-status/client";
import type { NodeStatusResult, NodeSummary, VendorNodesResponse } from "@/lib/node-status/client";
import { syncVendor, syncProjectLinkedVendors } from "@/lib/node-status/sync";

jest.mock("@/lib/node-status/client", () => ({
  fetchVendorNodes: jest.fn(),
}));

const mockFetchVendorNodes = fetchVendorNodes as jest.MockedFunction<typeof fetchVendorNodes>;

type Row = Record<string, unknown>;

function createMockSupabase(overrides: {
  vendors?: { data: Row | null; error?: { message: string } | null };
  projectVendors?: { data: Row[] };
  upsertErrors?: Record<string, { message: string }>;
  updateErrors?: Record<string, { message: string }>;
} = {}) {
  const calls: {
    upsert: { table: string; rows: Row[]; opts: unknown }[];
    update: { table: string; fields: Row }[];
    updateConditions: { col: string; val: unknown }[];
    deleted: { notIn?: unknown[] }[];
  } = { upsert: [], update: [], updateConditions: [], deleted: [] };

  const supabase = {
    calls,
    from: (table: string) => {
      if (table === "vendors") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue(
            overrides.vendors ?? { data: null, error: null },
          ),
        };
      }
      if (table === "project_vendors") {
        type Chain = {
          select: jest.Mock;
          eq: jest.Mock;
          then: (resolve: (value: { data: Record<string, unknown>[] }) => void) => void;
        };
        const chain: Chain = {
          select: jest.fn(),
          eq: jest.fn(),
          then: (resolve) => resolve(overrides.projectVendors ?? { data: [] }),
        };
        chain.select.mockReturnValue(chain);
        chain.eq.mockReturnValue(chain);
        return chain;
      }
      if (table === "node_status") {
        const chain: {
          eq: jest.Mock;
          not: jest.Mock;
          then: (resolve: (v: { error: { message: string } | null }) => void) => void;
        } = {
          eq: jest.fn(),
          not: jest.fn(),
          then: () => undefined,
        };
        chain.eq.mockReturnValue(chain);
        chain.then = (resolve) => {
          calls.deleted.push({ notIn: undefined });
          resolve({ error: null });
        };
        chain.not.mockImplementation((_col: string, _op: string, vals: unknown[]) => {
          calls.deleted.push({ notIn: vals });
          return Promise.resolve({ error: null });
        });
        return {
          upsert: (rows: Row[], opts: unknown) => {
            calls.upsert.push({ table: "node_status", rows, opts });
            return Promise.resolve({
              error: overrides.upsertErrors?.node_status ?? null,
            });
          },
          update: (fields: Row) => {
            calls.update.push({ table: "node_status", fields });
            return {
              eq: jest.fn().mockReturnThis(),
              is: jest.fn((col: string, val: unknown) => {
                calls.updateConditions.push({ col, val });
                return Promise.resolve({
                  error: overrides.updateErrors?.node_status ?? null,
                });
              }),
            };
          },
          delete: () => chain,
        };
      }
      if (table === "vendor_sync_state") {
        return {
          upsert: (rows: Row | Row[], opts: unknown) => {
            calls.upsert.push({
              table: "vendor_sync_state",
              rows: Array.isArray(rows) ? rows : [rows],
              opts,
            });
            return Promise.resolve({
              error: overrides.upsertErrors?.vendor_sync_state ?? null,
            });
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return supabase;
}

function okNodes(nodes: NodeSummary[]): NodeStatusResult<VendorNodesResponse> {
  return { ok: true, data: { vendor_subcon: "Innoverge, Inc.", nodes } };
}

const NODE_A: NodeSummary = {
  node_id: "MR1034",
  site: "Bicol Region",
  status: "in_progress",
  date_start: "2026-08-06T10:00:00+00:00",
  due_date: null,
  date_finished: null,
  progress_percentage: 43.75,
  poles_collected: 7,
  poles_total: 16,
};

describe("syncVendor", () => {
  beforeEach(() => {
    mockFetchVendorNodes.mockReset();
  });

  it("upserts node snapshots (without project_id) and marks sync ok", async () => {
    mockFetchVendorNodes.mockResolvedValue(okNodes([NODE_A]));
    const supabase = createMockSupabase({
      vendors: { data: { id: "v1", name: "Innoverge, Inc." }, error: null },
      projectVendors: { data: [] },
    });

    const outcome = await syncVendor("v1", supabase as any);

    expect(outcome.status).toBe("ok");
    expect(outcome.nodesSynced).toBe(1);

    const nodeUpsert = supabase.calls.upsert.find((c) => c.table === "node_status");
    expect(nodeUpsert).toBeDefined();
    expect(nodeUpsert!.rows[0]).toMatchObject({
      vendor_id: "v1",
      node_id: "MR1034",
      status: "in_progress",
    });
    expect(nodeUpsert!.rows[0]).not.toHaveProperty("project_id");

    const stateUpsert = supabase.calls.upsert.find((c) => c.table === "vendor_sync_state");
    expect(stateUpsert!.rows[0]).toMatchObject({
      vendor_id: "v1",
      last_status: "ok",
    });
  });

  it("auto-assigns project_id only when the vendor has exactly one project link", async () => {
    mockFetchVendorNodes.mockResolvedValue(okNodes([NODE_A]));
    const supabase = createMockSupabase({
      vendors: { data: { id: "v1", name: "Innoverge, Inc." }, error: null },
      projectVendors: { data: [{ project_id: "p1" }] },
    });

    await syncVendor("v1", supabase as any);

    const update = supabase.calls.update.find((c) => c.table === "node_status");
    expect(update).toBeDefined();
    expect(update!.fields).toMatchObject({ project_id: "p1" });
    expect(supabase.calls.updateConditions).toContainEqual({ col: "project_id", val: null });
  });

  it.each([
    ["zero project links", []],
    ["two project links", [{ project_id: "p1" }, { project_id: "p2" }]],
  ])("leaves project_id unassigned when the vendor has %s", async (_label, links) => {
    mockFetchVendorNodes.mockResolvedValue(okNodes([NODE_A]));
    const supabase = createMockSupabase({
      vendors: { data: { id: "v1", name: "Innoverge, Inc." }, error: null },
      projectVendors: { data: links as Row[] },
    });

    await syncVendor("v1", supabase as any);

    expect(supabase.calls.update.filter((c) => c.table === "node_status")).toHaveLength(0);
  });

  it("preserves manual project overrides by only filling NULL project_id", async () => {
    mockFetchVendorNodes.mockResolvedValue(okNodes([NODE_A]));
    const supabase = createMockSupabase({
      vendors: { data: { id: "v1", name: "Innoverge, Inc." }, error: null },
      projectVendors: { data: [{ project_id: "p1" }] },
    });

    await syncVendor("v1", supabase as any);

    // The auto-fill must be scoped to unassigned rows only.
    expect(supabase.calls.updateConditions).toContainEqual({ col: "project_id", val: null });
  });

  it("treats a 404 as unmatched and drops the vendor's local snapshot", async () => {
    mockFetchVendorNodes.mockResolvedValue({
      ok: false,
      error: { kind: "not_found" },
    });
    const supabase = createMockSupabase({
      vendors: { data: { id: "v1", name: "Ghost Vendor" }, error: null },
    });

    const outcome = await syncVendor("v1", supabase as any);

    expect(outcome.status).toBe("unmatched");
    expect(outcome.nodesSynced).toBe(0);
    expect(supabase.calls.upsert.filter((c) => c.table === "node_status")).toHaveLength(0);
    // Vendor gone upstream -> every local row for it is deleted.
    expect(supabase.calls.deleted).toEqual([{ notIn: undefined }]);
    const state = supabase.calls.upsert.find((c) => c.table === "vendor_sync_state");
    expect(state!.rows[0]).toMatchObject({ last_status: "unmatched" });
  });

  it("marks failed on network/5xx errors", async () => {
    mockFetchVendorNodes.mockResolvedValue({
      ok: false,
      error: { kind: "network", message: "ECONNRESET" },
    });
    const supabase = createMockSupabase({
      vendors: { data: { id: "v1", name: "Innoverge, Inc." }, error: null },
    });

    const outcome = await syncVendor("v1", supabase as any);

    expect(outcome.status).toBe("failed");
    expect(outcome.error).toBe("ECONNRESET");
    const state = supabase.calls.upsert.find((c) => c.table === "vendor_sync_state");
    expect(state!.rows[0]).toMatchObject({ last_status: "failed" });
  });

  it("does not call twinbackend when the vendor is missing", async () => {
    const supabase = createMockSupabase({
      vendors: { data: null, error: null },
    });

    const outcome = await syncVendor("v1", supabase as any);

    expect(outcome.status).toBe("failed");
    expect(mockFetchVendorNodes).not.toHaveBeenCalled();
  });

  it("handles an empty nodes array as a clean sync", async () => {
    mockFetchVendorNodes.mockResolvedValue(okNodes([]));
    const supabase = createMockSupabase({
      vendors: { data: { id: "v1", name: "Innoverge, Inc." }, error: null },
    });

    const outcome = await syncVendor("v1", supabase as any);

    expect(outcome.status).toBe("ok");
    expect(outcome.nodesSynced).toBe(0);
    expect(supabase.calls.upsert.filter((c) => c.table === "node_status")).toHaveLength(0);
    // Empty upstream list -> all local rows for the vendor are dropped.
    expect(supabase.calls.deleted).toEqual([{ notIn: undefined }]);
  });

  it("deletes local rows whose node_id no longer returned upstream", async () => {
    mockFetchVendorNodes.mockResolvedValue(okNodes([NODE_A]));
    const supabase = createMockSupabase({
      vendors: { data: { id: "v1", name: "Innoverge, Inc." }, error: null },
    });

    await syncVendor("v1", supabase as any);

    // Only row kept is the one returned; anything else for v1 is removed.
    expect(supabase.calls.deleted).toEqual([{ notIn: ["MR1034"] }]);
  });

  it("records a failed sync when the upsert errors", async () => {
    mockFetchVendorNodes.mockResolvedValue(okNodes([NODE_A]));
    const supabase = createMockSupabase({
      vendors: { data: { id: "v1", name: "Innoverge, Inc." }, error: null },
      upsertErrors: { node_status: { message: "constraint violated" } },
    });

    const outcome = await syncVendor("v1", supabase as any);

    expect(outcome.status).toBe("failed");
    expect(outcome.error).toBe("constraint violated");
    const state = supabase.calls.upsert.find((c) => c.table === "vendor_sync_state");
    expect(state!.rows[0]).toMatchObject({ last_status: "failed" });
  });
});

describe("syncProjectLinkedVendors", () => {
  beforeEach(() => {
    mockFetchVendorNodes.mockReset();
  });

  it("syncs each distinct project-linked vendor once and aggregates", async () => {
    mockFetchVendorNodes.mockResolvedValue(okNodes([NODE_A]));
    const supabase = createMockSupabase({
      vendors: { data: { id: "v1", name: "Innoverge, Inc." }, error: null },
      projectVendors: {
        data: [{ vendor_id: "v1" }, { vendor_id: "v1" }, { vendor_id: "v2" }],
      },
    });

    const summary = await syncProjectLinkedVendors(supabase as any);

    expect(mockFetchVendorNodes).toHaveBeenCalledTimes(2);
    expect(summary).toMatchObject({ synced: 2, unmatched: 0, failed: 0 });
    expect(summary.outcomes.map((o) => o.vendorId).sort()).toEqual(["v1", "v2"]);
  });
});
