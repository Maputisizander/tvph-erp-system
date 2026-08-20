import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { formatDuration } from "./format";

export type CheckStatus = "ok" | "warn" | "error";

export type HealthCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
};

/** Cron staleness: <=30min ok, <=2h warn, older error. Null = never synced. */
export function classifyNodeSync(minutesAgo: number | null): CheckStatus {
  if (minutesAgo === null) return "error";
  if (minutesAgo <= 30) return "ok";
  if (minutesAgo <= 120) return "warn";
  return "error";
}

/** Email health: unconfigured = error; configured with send <=24h ago = ok. */
export function classifyEmail({
  configured,
  minutesSinceLastSend,
}: {
  configured: boolean;
  minutesSinceLastSend: number | null;
}): CheckStatus {
  if (!configured) return "error";
  if (minutesSinceLastSend === null) return "ok";
  return minutesSinceLastSend <= 24 * 60 ? "ok" : "warn";
}

function minutesAgo(ts: string | null): number | null {
  if (!ts) return null;
  const ms = Date.now() - new Date(ts).getTime();
  return Math.max(0, Math.floor(ms / 60000));
}

export async function getHealthChecks(
  supabase: SupabaseClient,
): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  try {
    const start = Date.now();
    await supabase.from("system_settings").select("id").limit(1);
    checks.push({
      id: "postgres",
      label: "Postgres / Supabase",
      status: "ok",
      detail: `Connected in ${Date.now() - start}ms`,
    });
  } catch (e: any) {
    checks.push({
      id: "postgres",
      label: "Postgres / Supabase",
      status: "error",
      detail: e?.message || "Query failed",
    });
  }

  const configured = !!(env.RESEND_API_KEY && env.EMAIL_FROM);
  let minutesSinceLastSend: number | null = null;
  try {
    const { data } = await supabase
      .from("email_log")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    minutesSinceLastSend = minutesAgo(data?.[0]?.created_at ?? null);
  } catch {}

  checks.push({
    id: "email",
    label: "Email (Resend)",
    status: classifyEmail({ configured, minutesSinceLastSend }),
    detail: configured
      ? minutesSinceLastSend === null
        ? "Configured — no emails sent yet"
        : `Configured — last send ${formatDuration(minutesSinceLastSend)} ago`
      : "RESEND_API_KEY / EMAIL_FROM not configured",
  });

  try {
    const { data } = await supabase
      .from("vendor_sync_state")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1);
    const mins = minutesAgo(data?.[0]?.updated_at ?? null);
    checks.push({
      id: "node-status",
      label: "Node-status sync (cron)",
      status: classifyNodeSync(mins),
      detail:
        mins === null ? "No sync recorded yet" : `Last sync ${formatDuration(mins)} ago`,
    });
  } catch (e: any) {
    checks.push({
      id: "node-status",
      label: "Node-status sync (cron)",
      status: "error",
      detail: e?.message || "Query failed",
    });
  }

  return checks;
}