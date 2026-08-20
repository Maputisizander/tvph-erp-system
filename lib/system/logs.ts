import "server-only";
import { env } from "@/lib/env";

export type LogRow = { time: string; message: string };
export type ProviderLogResult = { rows: LogRow[] } | { error: string };

const SUPABASE_LOG_SOURCES = [
  "postgres_logs",
  "edge_logs",
  "function_edge_logs",
  "auth_logs",
  "storage_logs",
] as const;
export type SupabaseLogSource = (typeof SUPABASE_LOG_SOURCES)[number];

const LOG_WINDOW_MINUTES: Record<string, number> = { "15m": 15, "1h": 60, "24h": 1440 };

export function windowToMinutes(window: string): number {
  return LOG_WINDOW_MINUTES[window] ?? 60;
}

/** Fetch recent logs from the Supabase Analytics Logs API (management token). */
export async function fetchSupabaseLogs(
  source: string,
  windowMinutes: number,
): Promise<ProviderLogResult> {
  if (!env.SUPABASE_ACCESS_TOKEN || !env.SUPABASE_PROJECT_REF) {
    return { error: "not_configured" };
  }
  if (!SUPABASE_LOG_SOURCES.includes(source as SupabaseLogSource)) {
    return { error: `Unknown log source: ${source}` };
  }

  const start = new Date(Date.now() - windowMinutes * 60_000);
  const params = new URLSearchParams({
    sql: `select timestamp, event_message from ${source} order by timestamp desc limit 50`,
    iso_timestamp_start: start.toISOString(),
    iso_timestamp_end: new Date().toISOString(),
  });

  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/analytics/endpoints/logs.all?${params}`,
      {
        headers: {
          Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
          apikey: env.SUPABASE_ACCESS_TOKEN,
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      return { error: `Supabase API ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
    const data = await res.json();
    const rows: LogRow[] = (data?.result ?? []).map((r: any) => ({
      time: r.timestamp ?? "",
      message: r.event_message ?? "",
    }));
    return { rows };
  } catch (e: any) {
    return { error: e?.message || "Request failed" };
  }
}

/** Fetch runtime logs for the current deployment from Vercel's Logs API. */
export async function fetchVercelLogs(): Promise<ProviderLogResult> {
  const projectId = process.env.VERCEL_PROJECT_ID;
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID;
  if (!env.VERCEL_TOKEN || !projectId || !deploymentId) {
    return { error: "not_configured" };
  }

  try {
    const res = await fetch(
      `https://api.vercel.com/v1/projects/${projectId}/deployments/${deploymentId}/runtime-logs`,
      {
        headers: {
          Authorization: `Bearer ${env.VERCEL_TOKEN}`,
          Accept: "application/stream+json",
        },
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!res.ok) {
      return { error: `Vercel API ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
    const text = await res.text();
    const rows: LogRow[] = text
      .split("\n")
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .map((r: any) => ({
        time:
          typeof r.timestamp === "number"
            ? new Date(r.timestamp).toISOString()
            : (r.timestamp ?? ""),
        message: r.message ?? r.entry ?? "",
      }))
      .slice(-50);
    return { rows };
  } catch (e: any) {
    return { error: e?.message || "Request failed" };
  }
}