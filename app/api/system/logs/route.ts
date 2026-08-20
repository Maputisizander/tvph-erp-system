import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile, isSuperadmin } from "@/lib/auth/permissions";
import { fetchSupabaseLogs, fetchVercelLogs, windowToMinutes } from "@/lib/system/logs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const context = await getCurrentProfile(supabase);
  if (!isSuperadmin(context.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider") ?? "supabase";

  if (provider === "vercel") {
    return NextResponse.json(await fetchVercelLogs());
  }

  const source = searchParams.get("source") ?? "postgres_logs";
  const windowMinutes = windowToMinutes(searchParams.get("window") ?? "1h");
  return NextResponse.json(await fetchSupabaseLogs(source, windowMinutes));
}