import type { HealthCheck } from "@/lib/system/health";

const STATUS_STYLES: Record<HealthCheck["status"], string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  error: "bg-red-500",
};

const STATUS_LABELS: Record<HealthCheck["status"], string> = {
  ok: "OK",
  warn: "Warning",
  error: "Error",
};

export function HealthPanel({ checks }: { checks: HealthCheck[] }) {
  return (
    <section className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
      <h2 className="text-base font-semibold uppercase tracking-wider">Health checks</h2>
      <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {checks.length === 0 && (
          <li className="py-3 text-sm text-red-600 dark:text-red-400">
            Health checks failed to load.
          </li>
        )}
        {checks.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-2.5">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_STYLES[c.status]}`} />
            <span className="text-sm font-medium">{c.label}</span>
            <span className={`text-[10px] uppercase tracking-wider font-semibold ${c.status === "ok" ? "text-emerald-600" : c.status === "warn" ? "text-amber-600" : "text-red-600"}`}>
              {STATUS_LABELS[c.status]}
            </span>
            <span className="ml-auto text-xs text-slate-500 text-right">{c.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}