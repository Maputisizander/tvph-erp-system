"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";

export function MoreFilters({
  accounts,
  projects,
  regions,
  batches,
}: {
  accounts: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  regions: string[];
  batches: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const hasActive = ["client","project","region","batch","amountMin","amountMax","issuedFrom","issuedTo","dueFrom","dueTo","estFrom","estTo","collectedFrom","collectedTo","endorsedFrom","endorsedTo"].some(k=>searchParams.get(k));
  const activeCount = ["client","project","region","batch","amountMin","amountMax","issuedFrom","issuedTo","dueFrom","dueTo","estFrom","estTo","collectedFrom","collectedTo","endorsedFrom","endorsedTo"].filter(k=>searchParams.get(k)).length;

  const update = (key: string, value: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const clearAll = () => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      ["client","project","region","batch","amountMin","amountMax","issuedFrom","issuedTo","dueFrom","dueTo","estFrom","estTo","collectedFrom","collectedTo","endorsedFrom","endorsedTo"].forEach(k=>params.delete(k));
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const sel = "w-full px-3 py-2 bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary";
  const inp = "w-full px-3 py-2 bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary";

  return (
    <>
      <div className="inline-flex items-center gap-2 shrink-0">
        <button
          onClick={() => setOpen(!open)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${hasActive ? "bg-primary text-white border-primary" : "bg-white dark:bg-[#071F15] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50"}`}
        >
          <SlidersHorizontal className="h-4 w-4" /> Filters {activeCount > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${hasActive ? "bg-white text-primary" : "bg-primary text-white"}`}>{activeCount}</span>}
        </button>

        {hasActive && (
          <button onClick={clearAll} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {open && (
        <div className="basis-full w-full mt-3 p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 animate-in fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Client</label>
              <select value={searchParams.get("client") || "all"} onChange={e=>update("client", e.target.value==="all"?"":e.target.value)} className={sel}>
                <option value="all">All Clients</option>
                {accounts.map(a=> <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Project</label>
              <select value={searchParams.get("project") || "all"} onChange={e=>update("project", e.target.value==="all"?"":e.target.value)} className={sel}>
                <option value="all">All Projects</option>
                {projects.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Region</label>
              <select value={searchParams.get("region") || "all"} onChange={e=>update("region", e.target.value==="all"?"":e.target.value)} className={sel}>
                <option value="all">All Regions</option>
                {regions.map(r=> <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Batch</label>
              <select value={searchParams.get("batch") || "all"} onChange={e=>update("batch", e.target.value==="all"?"":e.target.value)} className={sel}>
                <option value="all">All Batches</option>
                {batches.map(b=> <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Amount VAT-inc</label>
              <div className="flex gap-2">
                <input type="number" placeholder="Min" defaultValue={searchParams.get("amountMin")||""} onBlur={e=>update("amountMin", e.target.value)} onKeyDown={e=>{ if(e.key==="Enter") update("amountMin", (e.target as HTMLInputElement).value)}} className={inp} />
                <input type="number" placeholder="Max" defaultValue={searchParams.get("amountMax")||""} onBlur={e=>update("amountMax", e.target.value)} onKeyDown={e=>{ if(e.key==="Enter") update("amountMax", (e.target as HTMLInputElement).value)}} className={inp} />
              </div>
            </div>
            <div className="flex items-end">
              <p className="text-xs text-slate-400">Leave blank for no limit. Press Enter or blur to apply.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Issued Date</label>
              <div className="flex gap-2">
                <input type="date" value={searchParams.get("issuedFrom")||""} onChange={e=>update("issuedFrom", e.target.value)} className={inp} />
                <input type="date" value={searchParams.get("issuedTo")||""} onChange={e=>update("issuedTo", e.target.value)} className={inp} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Due Date</label>
              <div className="flex gap-2">
                <input type="date" value={searchParams.get("dueFrom")||""} onChange={e=>update("dueFrom", e.target.value)} className={inp} />
                <input type="date" value={searchParams.get("dueTo")||""} onChange={e=>update("dueTo", e.target.value)} className={inp} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Est. Payment</label>
              <div className="flex gap-2">
                <input type="date" value={searchParams.get("estFrom")||""} onChange={e=>update("estFrom", e.target.value)} className={inp} />
                <input type="date" value={searchParams.get("estTo")||""} onChange={e=>update("estTo", e.target.value)} className={inp} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Collected (actual)</label>
              <div className="flex gap-2">
                <input type="date" value={searchParams.get("collectedFrom")||""} onChange={e=>update("collectedFrom", e.target.value)} className={inp} />
                <input type="date" value={searchParams.get("collectedTo")||""} onChange={e=>update("collectedTo", e.target.value)} className={inp} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Endorsed</label>
              <div className="flex gap-2">
                <input type="date" value={searchParams.get("endorsedFrom")||""} onChange={e=>update("endorsedFrom", e.target.value)} className={inp} />
                <input type="date" value={searchParams.get("endorsedTo")||""} onChange={e=>update("endorsedTo", e.target.value)} className={inp} />
              </div>
            </div>
          </div>
          {isPending && <p className="text-xs text-slate-400">Applying…</p>}
        </div>
      )}
    </>
  );
}
