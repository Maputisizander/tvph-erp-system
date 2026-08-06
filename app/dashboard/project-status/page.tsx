import { createClient } from "@/utils/supabase/server";
import {
  Activity,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SyncNowButton } from "@/components/dashboard/project-status/sync-now-button";
import { Pagination } from "@/components/ui/pagination";
import { LIST_PAGE_SIZE, parsePage, pageRange } from "@/components/ui/pagination-utils";

export const unstable_instant = {
  prefetch: "static",
  samples: [{ searchParams: { page: null, status: null, project_id: null } }],
};

const STALE_MS = 30 * 60 * 1000;

export default function ProjectStatusPage(props: {
  searchParams?: Promise<{ page?: string; status?: string; project_id?: string }>;
}) {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Project Status
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Work-node status synced from twinbackend, grouped by vendor.
          </p>
        </div>
        <p className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-3 py-2 rounded-xl">
          <RefreshCw className="h-3.5 w-3.5" />
          Auto-syncs every 15 minutes
        </p>
      </div>

      <Suspense fallback={<ProjectStatusSkeleton />}>
        <ProjectStatusContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function ProjectStatusContent({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<{ page?: string; status?: string; project_id?: string }>;
}) {
  const supabase = await createClient();
  const searchParams = await searchParamsPromise;
  const page = parsePage(searchParams?.page);
  const [from, to] = pageRange(page, LIST_PAGE_SIZE);
  const statusFilter = searchParams?.status || null;
  const projectFilter = searchParams?.project_id || null;

  let query = supabase
    .from("node_status")
    .select(
      `id, node_id, site, status, progress_percentage, poles_collected, poles_total, last_synced_at,
      vendors(id, name),
      projects(id, name)`,
      { count: "exact" },
    );
  if (statusFilter) query = query.eq("status", statusFilter);
  if (projectFilter) query = query.eq("project_id", projectFilter);
  query = query.order("last_synced_at", { ascending: false }).range(from, to);

  const [{ data: nodes, count }, { data: projects }, { data: syncStates }] = await Promise.all([
    query,
    supabase
      .from("projects")
      .select("id, name")
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("vendor_sync_state")
      .select("vendor_id, last_status, last_error, last_synced_at, last_ok_at, vendors(id, name)")
      .in("last_status", ["unmatched", "failed"]),
  ]);

  const problemVendors = (syncStates || []) as any[];
  const nodesList = (nodes || []) as any[];
  // eslint-disable-next-line react-hooks/purity -- staleness is inherently relative to wall-clock time; this server component re-renders per request
  const anyStale = nodesList.some((n) => Date.now() - new Date(n.last_synced_at).getTime() > STALE_MS);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
      case "in_progress":
        return "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
    }
  };

  return (
    <>
      {(problemVendors.length > 0 || anyStale) && (
        <div className="space-y-3">
          {anyStale && (
            <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Some nodes may be stale</p>
                <p className="text-amber-700 dark:text-amber-400">
                  Synced data is over 30 minutes old. The next scheduled sync
                  should refresh it.
                </p>
              </div>
            </div>
          )}
          {problemVendors.map((vs) => (
            <div
              key={vs.vendor_id}
              className="flex items-center justify-between gap-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl p-4"
            >
              <div className="flex items-start gap-3 text-sm text-rose-800 dark:text-rose-300">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    {vs.vendors?.name ?? "Vendor"} —{" "}
                    {vs.last_status === "unmatched"
                      ? "name not found on twinbackend"
                      : "sync failed"}
                  </p>
                  {vs.last_error && (
                    <p className="text-rose-700 dark:text-rose-400">{vs.last_error}</p>
                  )}
                </div>
              </div>
              <SyncNowButton vendorId={vs.vendor_id} />
            </div>
          ))}
        </div>
      )}

      <form method="get" className="flex flex-wrap items-end gap-3 bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            Status
          </label>
          <select
            name="status"
            defaultValue={statusFilter ?? ""}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            Project
          </label>
          <select
            name="project_id"
            defaultValue={projectFilter ?? ""}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200"
          >
            <option value="">All projects</option>
            {(projects || []).map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 px-4 py-2 rounded-xl text-sm font-medium"
        >
          Filter
        </button>
      </form>

      {nodesList.length === 0 ? (
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center shadow-sm max-w-2xl mx-auto mt-12">
          <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Activity className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
            No node status yet
          </h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Nodes appear here once vendors linked to projects have been synced
            with twinbackend.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-semibold">Node</th>
                  <th className="px-6 py-4 font-semibold">Vendor</th>
                  <th className="px-6 py-4 font-semibold">Project</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Progress</th>
                  <th className="px-6 py-4 font-semibold">Poles</th>
                  <th className="px-6 py-4 font-semibold">Last Synced</th>
                  <th className="px-6 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {nodesList.map((node) => (
                  <tr key={node.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {node.node_id}
                      </p>
                      {node.site && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {node.site}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {node.vendors?.name ?? "—"}
                    </td>
                    <td className="px-6 py-4">
                      {node.projects?.name ? (
                        <Link
                          href={`/dashboard/projects/${node.projects.id}`}
                          className="text-primary hover:underline"
                        >
                          {node.projects.name}
                        </Link>
                      ) : (
                        <span className="text-xs font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 px-2 py-0.5 rounded-full">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(node.status)}`}
                      >
                        {node.status?.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {node.progress_percentage != null ? `${node.progress_percentage}%` : "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {node.poles_collected}/{node.poles_total}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                      {new Date(node.last_synced_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/project-status/${node.id}`}
                        className="inline-flex items-center gap-1 text-primary text-xs font-medium hover:underline"
                      >
                        Detail <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(count ?? 0) > LIST_PAGE_SIZE && (
        <div className="mt-6 bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <Pagination page={page} totalCount={count ?? 0} pageSize={LIST_PAGE_SIZE} />
        </div>
      )}
    </>
  );
}

function ProjectStatusSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-20 bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
      <div className="h-96 bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
    </div>
  );
}
