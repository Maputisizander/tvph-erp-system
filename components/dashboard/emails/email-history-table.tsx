import { Mail, Download, CheckCircle2, XCircle, MailCheck, MailOpen, MailX } from "lucide-react";
import { EMAIL_KIND_LABELS, emailReference } from "@/lib/email/kinds";

export interface EmailLogRow {
  id: string;
  kind: string;
  ref_id: string | null;
  to_addresses: string[] | null;
  cc_addresses: string[] | null;
  subject: string | null;
  status: "sent" | "failed";
  resend_id: string | null;
  error: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  bounced_at: string | null;
}

function fmt(ts: string) {
  return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function StatusBadge({ row }: { row: EmailLogRow }) {
  if (row.bounced_at) return (
    <span title={`Bounced · ${fmt(row.bounced_at)}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400">
      <MailX className="h-3 w-3" /> BOUNCED
    </span>
  );
  if (row.opened_at) return (
    <span title={`Opened · ${fmt(row.opened_at)} · Best-effort: pixel tracking may be inaccurate`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400">
      <MailOpen className="h-3 w-3" /> OPENED~
    </span>
  );
  if (row.delivered_at) return (
    <span title={`Delivered · ${fmt(row.delivered_at)}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400">
      <MailCheck className="h-3 w-3" /> DELIVERED
    </span>
  );
  if (row.status === "sent") return (
    <span title="Handed to mail provider; awaiting delivery confirmation" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400">
      <CheckCircle2 className="h-3 w-3" /> SENT
    </span>
  );
  return (
    <span title={row.error || undefined} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400">
      <XCircle className="h-3 w-3" /> FAILED
    </span>
  );
}

export function EmailHistoryTable({
  rows,
  poNumbers,
  senderNames,
  csvHref,
  title = "Email History",
  subtitle,
  emptyText = "No emails have been sent yet.",
}: {
  rows: EmailLogRow[];
  poNumbers: Map<string, string>;
  senderNames: Map<string, string>;
  csvHref?: string | null;
  title?: string;
  subtitle?: string;
  emptyText?: string;
}) {
  return (
    <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm animate-in fade-in duration-300">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> {title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {subtitle ?? `Record of emails. ${rows.length} entr${rows.length === 1 ? "y" : "ies"}.`}
          </p>
        </div>
        {csvHref && rows.length > 0 && (
          <a
            href={csvHref}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </a>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="px-6 py-12 text-center text-slate-400 italic">{emptyText}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-3 font-semibold">Sent</th>
                <th className="px-6 py-3 font-semibold">Type</th>
                <th className="px-6 py-3 font-semibold">Recipient</th>
                <th className="px-6 py-3 font-semibold">Subject</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Receipt ID</th>
                <th className="px-6 py-3 font-semibold">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors align-top">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                    {new Date(row.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900 dark:text-white">{EMAIL_KIND_LABELS[row.kind] ?? row.kind}</div>
                    <div className="text-xs text-slate-500">{emailReference(row, poNumbers)}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{(row.to_addresses ?? []).join(", ") || "—"}</td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-300 max-w-[260px]">
                    <span className="line-clamp-2">{row.subject || "—"}</span>
                  </td>
                  <td className="px-6 py-4"><StatusBadge row={row} /></td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-400">{row.resend_id || "—"}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{(row.created_by && senderNames.get(row.created_by)) || "System"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
