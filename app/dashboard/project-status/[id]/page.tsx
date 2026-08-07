import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Flag,
  MapPin,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { fetchNodeDetail } from "@/lib/node-status/client";
import { NodeAssign } from "@/components/dashboard/project-status/node-assign";
import { statusBadgeClasses } from "@/lib/ui/status-badge";

export const unstable_instant = {
  prefetch: "static",
  samples: [{ params: { id: "sample-node-id" } }],
};

export default function NodeDetailPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<NodeDetailSkeleton />}>
      <NodeDetailLoader paramsPromise={props.params} />
    </Suspense>
  );
}

async function NodeDetailLoader({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const supabase = await createClient();

  const [{ data: node }, { data: projects }] = await Promise.all([
    supabase
      .from("node_status")
      .select("*, vendors(id, name), projects(id, name)")
      .eq("id", params.id)
      .single(),
    supabase
      .from("projects")
      .select("id, name")
      .is("deleted_at", null)
      .order("name"),
  ]);

  if (!node) notFound();

  const vendorName = (node as any).vendors?.name ?? "";

  // Live drill-down: pull pole-by-pole detail from twinbackend. On failure the
  // cached summary still renders with a stale banner.
  let live: Awaited<ReturnType<typeof fetchNodeDetail>> | null = null;
  if (vendorName) {
    live = await fetchNodeDetail((node as any).node_id, vendorName);
  }

  const getStatusColor = (status: string) => {
    return statusBadgeClasses(status);
  };

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString() : "—";

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              {node.node_id}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(node.status)}`}
            >
              {node.status?.replace("_", " ")}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> {vendorName || "No vendor"}
            {node.site && (
              <span className="inline-flex items-center gap-1">
                · <MapPin className="h-3.5 w-3.5" /> {node.site}
              </span>
            )}
          </p>
        </div>
        <Link
          href="/dashboard/project-status"
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-primary"
        >
          ← Back to Project Status
        </Link>
      </div>

      {live && !live.ok && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Live detail unavailable</p>
            <p className="text-amber-700 dark:text-amber-400">
              Showing the last synced summary instead.{" "}
              {live.error.kind === "unauthorized"
                ? "The twinbackend API key needs attention."
                : `twinbackend returned: ${live.error.kind}.`}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Progress"
          value={node.progress_percentage != null ? `${node.progress_percentage}%` : "—"}
        />
        <SummaryCard label="Poles" value={`${node.poles_collected}/${node.poles_total}`} />
        <SummaryCard label="Started" value={fmtDate(node.date_start)} icon={<Flag className="h-4 w-4" />} />
        <SummaryCard label="Due" value={fmtDate(node.due_date)} icon={<CalendarDays className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">Pole-by-pole</h2>
            {live?.ok && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <RefreshCw className="h-3 w-3" /> Live from twinbackend
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3 font-semibold">Pole</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Cleared</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {live?.ok && live.data.poles.list.length > 0 ? (
                  live.data.poles.list.map((pole) => (
                    <tr key={pole.pole_code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">
                        {pole.pole_code}
                      </td>
                      <td className="px-6 py-3 text-slate-700 dark:text-slate-300">{pole.status}</td>
                      <td className="px-6 py-3 text-xs text-slate-500 dark:text-slate-400">
                        {pole.cleared_at ? new Date(pole.cleared_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                      {live?.ok ? (
                        <>
                          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                          No poles recorded for this node.
                        </>
                      ) : (
                        "Pole detail requires a successful live fetch."
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Assignment</h2>
            <NodeAssign
              nodeId={node.id}
              currentProjectId={(node as any).projects?.id ?? null}
              currentProjectName={(node as any).projects?.name ?? null}
              projects={projects || []}
            />
          </div>

          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Collectables</h2>
            {live?.ok && Object.keys(live.data.collectables).length > 0 ? (
              <ul className="space-y-2 text-sm">
                {Object.entries(live.data.collectables).map(([name, c]) => (
                  <li key={name} className="flex justify-between text-slate-700 dark:text-slate-300">
                    <span className="capitalize">{name.replace(/_/g, " ")}</span>
                    <span className="font-medium">
                      {c.actual}/{c.expected}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {live?.ok
                  ? "No collectables recorded."
                  : "Collectables require a successful live fetch."}
              </p>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Last synced {new Date(node.last_synced_at).toLocaleString()}.{" "}
            {node.date_finished ? `Finished ${fmtDate(node.date_finished)}.` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
        {icon} {label}
      </p>
      <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
    </div>
  );
}

function NodeDetailSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="h-10 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
        ))}
      </div>
      <div className="h-96 bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
    </div>
  );
}
