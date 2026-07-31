"use client";

import { useState } from "react";
import { History, Eye, EyeOff, Loader2, Pencil, Trash2, FilePlus2 } from "lucide-react";

const FIELD_LABELS: Record<string, string> = {
  description: "Description",
  due_date: "Due date",
  amount: "PO total",
  dp_amount: "Downpayment",
  line_items: "Line items",
  site_details: "Sites & details",
  status: "Status",
  vendor_id: "Vendor",
  issued_date: "Issued date",
  net_days: "Net days",
  dp_due_days: "DP due days",
  penalty_rate: "Penalty rate",
  penalty_type: "Penalty type",
  override_amount: "Penalty override",
  approved_by_user_id: "Approver",
  submitted_by: "Submitted by",
  rejection_reason: "Rejection reason",
  requirements_waived: "Waiver",
  waived_requirements: "Waived requirements",
  line_items_count: "Line items",
  sites_count: "Sites & details",
  currency: "Currency",
  project_id: "Project",
};

function prettify(key: string) {
  const label = FIELD_LABELS[key];
  if (label) return label;
  return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function formatValue(key: string, value: any) {
  if (value === null || value === undefined || value === "") return "empty";
  if (key === "amount" || key === "dp_amount" || key === "override_amount") {
    return `₱${Number(value).toLocaleString()}`;
  }
  if (key === "due_date" || key === "issued_date") {
    return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
  }
  if (key === "requirements_waived" || key === "waiver") {
    return value === true ? "Yes" : value === false ? "No" : String(value);
  }
  return String(value);
}

function summarize(log: any): string[] {
  if (log.action === "CREATE") return ["Purchase order drafted"];
  if (log.action === "DELETE") return ["Purchase order deleted"];

  const after = log.changes?.after || {};
  const before = log.changes?.before;
  const ignored = new Set(["updated_at", "created_at", "id", "terms_configured_at"]);
  const lines: string[] = [];

  for (const [key, val] of Object.entries(after)) {
    if (ignored.has(key)) continue;
    const label = prettify(key);
    if (before && before[key] !== undefined && String(before[key]) !== String(val)) {
      lines.push(`${label}: ${formatValue(key, before[key])} → ${formatValue(key, val)}`);
    } else if (key === "dp_amount" && Number(val) > 0) {
      lines.push(`${label} added: ${formatValue(key, val)}`);
    } else {
      lines.push(`${label}: ${formatValue(key, val)}`);
    }
  }

  return lines.length > 0 ? lines : ["Details updated"];
}

export function POEditHistory({ poId }: { poId: string }) {
  const [visible, setVisible] = useState(false);
  const [logs, setLogs] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !visible;
    setVisible(next);
    if (!next) return;
    if (logs !== null) return;
    setLoading(true);
    fetch(`/api/purchase-orders/${poId}/edit-history`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Failed to load edit history (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        setLogs(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || "Failed to load edit history.");
      })
      .finally(() => setLoading(false));
  }

  const ActionIcon = (action: string) =>
    action === "CREATE" ? (
      <FilePlus2 className="h-3.5 w-3.5" />
    ) : action === "DELETE" ? (
      <Trash2 className="h-3.5 w-3.5" />
    ) : (
      <Pencil className="h-3.5 w-3.5" />
    );

  const actionStyles = (action: string) =>
    action === "CREATE"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50"
      : action === "DELETE"
        ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50"
        : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50";

  return (
    <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <History className="h-5 w-5 text-primary" /> Edit History
        </h2>
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-primary bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/60 px-3 py-1.5 rounded-lg transition-all"
        >
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {visible ? "Hide" : "Show"}
        </button>
      </div>

      {visible &&
        (loading ? (
          <div className="flex flex-col items-center justify-center py-8 opacity-40">
            <Loader2 className="h-5 w-5 animate-spin text-primary mb-2" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Loading History...</span>
          </div>
        ) : error ? (
          <p className="px-6 py-8 text-sm text-red-600 italic text-center">{error}</p>
        ) : logs && logs.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-400 italic text-center">No edit history yet.</p>
        ) : (
          <div className="p-6 space-y-5">
            {logs?.map((log) => {
              const summary = summarize(log);
              return (
                <div key={log.id} className="flex gap-3">
                  <span
                    className={`inline-flex items-center justify-center h-6 w-6 rounded-full border shrink-0 mt-0.5 ${actionStyles(log.action)}`}
                  >
                    {ActionIcon(log.action)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {log.profiles?.full_name || "System"}
                        <span className="text-slate-400 font-normal"> · {new Date(log.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                      </p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${actionStyles(log.action)}`}>
                        {log.action}
                      </span>
                    </div>
                    <ul className="mt-1.5 space-y-0.5">
                      {summary.map((line, i) => (
                        <li key={i} className="text-xs text-slate-600 dark:text-slate-400">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}
