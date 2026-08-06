import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { syncProjectLinkedVendors } from "@/lib/node-status/sync";

export const maxDuration = 300;

/**
 * Scheduled job (invoked every 15 min by pg_cron via pg_net). Polls twinbackend
 * for every project-linked vendor's node status and upserts the latest snapshot
 * into node_status / vendor_sync_state.
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const summary = await syncProjectLinkedVendors(supabase);

  return Response.json(summary);
}
