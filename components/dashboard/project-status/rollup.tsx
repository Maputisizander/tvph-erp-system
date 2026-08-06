import { Activity, CheckCircle2, CircleDashed, Loader2, Users } from "lucide-react";
import type { ReactNode } from "react";

export type ProjectRollup = {
  id: string | null;
  name: string;
  nodes: number;
  collected: number;
  total: number;
};

export type Rollup = {
  collectedPoles: number;
  totalPoles: number;
  statusCounts: Record<string, number>;
  vendorCount: number;
  projects: ProjectRollup[];
};

function pct(collected: number, total: number) {
  return total > 0 ? Math.round((collected / total) * 100) : 0;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
      <div
        className="h-full bg-primary rounded-full transition-all"
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  children,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function ProjectStatusRollup({ rollup }: { rollup: Rollup }) {
  const overall = pct(rollup.collectedPoles, rollup.totalPoles);
  const statusMeta = [
    { key: "pending", label: "Pending", icon: CircleDashed, className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
    { key: "in_progress", label: "In progress", icon: Loader2, className: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" },
    { key: "completed", label: "Completed", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
  ];
  const totalNodes = Object.values(rollup.statusCounts).reduce((a, b) => a + b, 0);

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Activity className="h-4 w-4" />} label="Poles collected" value={`${rollup.collectedPoles} / ${rollup.totalPoles}`}>
          <div className="space-y-2">
            <ProgressBar value={overall} />
            <p className="text-xs text-slate-500 dark:text-slate-400">{overall}% complete</p>
          </div>
        </StatCard>
        <StatCard icon={<Activity className="h-4 w-4" />} label="Nodes" value={`${totalNodes}`}>
          <div className="flex flex-wrap gap-1.5">
            {statusMeta.map((s) => {
              const count = rollup.statusCounts[s.key] || 0;
              if (count === 0) return null;
              const Icon = s.icon;
              return (
                <span
                  key={s.key}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${s.className}`}
                >
                  <Icon className="h-3 w-3" />
                  {s.label} {count}
                </span>
              );
            })}
          </div>
        </StatCard>
        <StatCard icon={<Users className="h-4 w-4" />} label="Vendors" value={`${rollup.vendorCount}`}>
          <p className="text-xs text-slate-500 dark:text-slate-400">with node data on twinbackend</p>
        </StatCard>
        <StatCard icon={<Activity className="h-4 w-4" />} label="Overall completion" value={`${overall}%`}>
          <ProgressBar value={overall} />
        </StatCard>
      </div>

      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">By project</h2>
        {rollup.projects.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No nodes assigned to a project yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rollup.projects.map((p) => (
              <div
                key={p.id ?? "unassigned"}
                className="border border-slate-200 dark:border-slate-800 rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {p.name}
                  </p>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{p.nodes} node{p.nodes === 1 ? "" : "s"}</span>
                </div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">
                  {p.collected}/{p.total}
                </p>
                <div className="mt-2">
                  <ProgressBar value={pct(p.collected, p.total)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
