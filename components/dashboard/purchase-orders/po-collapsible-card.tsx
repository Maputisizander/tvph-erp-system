import { ChevronDown } from "lucide-react";

export function PoCollapsibleCard({
  title,
  icon,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm [&>summary]:list-none [&>summary::-webkit-details-marker]:hidden"
    >
      <summary className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between cursor-pointer select-none">
        <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          {icon}
          {title}
          {count !== undefined && (
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-bold">
              {count}
            </span>
          )}
        </h2>
        <ChevronDown className="h-4 w-4 text-slate-400 group-open:rotate-180 transition-transform" />
      </summary>
      <div className="p-6">{children}</div>
    </details>
  );
}
