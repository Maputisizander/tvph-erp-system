"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

type Row = { time: string; message: string };
type Provider = "supabase" | "vercel";

const SOURCES = [
  { id: "postgres_logs", label: "Postgres" },
  { id: "edge_logs", label: "Edge logs" },
  { id: "function_edge_logs", label: "Edge Functions" },
  { id: "auth_logs", label: "Auth" },
  { id: "storage_logs", label: "Storage" },
];
const WINDOWS = ["15m", "1h", "24h"];

export function LogsPanel() {
  const [provider, setProvider] = useState<Provider>("supabase");
  const [source, setSource] = useState("postgres_logs");
  const [window, setWindow] = useState("1h");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ provider });
    if (provider === "supabase") {
      params.set("source", source);
      params.set("window", window);
    }
    try {
      const res = await fetch(`/api/system/logs?${params}`);
      const data = await res.json();
      if (data.error) {
        setRows([]);
        setError(
          data.error === "not_configured"
            ? "Not configured — add the provider API token to your environment."
            : data.error,
        );
      } else {
        setRows(data.rows ?? []);
      }
    } catch (e: any) {
      setRows([]);
      setError(e?.message ?? "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [provider, source, window]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const inputClass =
    "rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#071F15] px-3 py-1.5 text-sm";

  return (
    <section className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold uppercase tracking-wider">Logs</h2>

        <div className="flex rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700">
          {(["supabase", "vercel"] as Provider[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              className={`px-3 py-1.5 text-sm capitalize transition-colors ${
                provider === p
                  ? "bg-emerald-800 text-white"
                  : "bg-white dark:bg-[#071F15] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {provider === "supabase" && (
          <>
            <select value={source} onChange={(e) => setSource(e.target.value)} className={inputClass}>
              {SOURCES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <select value={window} onChange={(e) => setWindow(e.target.value)} className={inputClass}>
              {WINDOWS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </>
        )}

        <button
          type="button"
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1.5 text-sm font-medium transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="mt-3 max-h-96 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/60 text-[10px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-2 text-left whitespace-nowrap w-44">Time</th>
              <th className="px-4 py-2 text-left">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-slate-400 italic">
                  No logs in this window.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-2 whitespace-nowrap text-xs text-slate-500">
                  {r.time ? new Date(r.time).toLocaleString() : ""}
                </td>
                <td className="px-4 py-2 font-mono text-xs whitespace-pre-wrap break-words">
                  {r.message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}