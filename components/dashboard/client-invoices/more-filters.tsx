"use client";

import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X, Search } from "lucide-react";

function SearchableSelect({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 500);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    if (!open) setQ(selectedLabel);
  }, [selectedLabel, open]);
  useEffect(() => {
    if (open) setQ(selectedLabel);
  }, [open]); // eslint-disable-line
  const filtered = useMemo(() => {
    if (!debouncedQ) return options;
    const needle = debouncedQ.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(needle));
  }, [options, debouncedQ]);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input
          value={open ? q : selectedLabel}
          placeholder={placeholder}
          onFocus={() => { setOpen(true); setQ(selectedLabel); }}
          onChange={(e) => { setQ(e.target.value); setOpen(true); if (e.target.value === "") onChange(""); }}
          className="w-full pl-8 pr-3 py-2 bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          <button
            onClick={() => { onChange(""); setQ(""); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-sm ${!value ? "bg-primary/10 text-primary font-medium" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
          >
            {placeholder}
          </button>
          {filtered.map((o) => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setQ(o.label); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm ${value === o.value ? "bg-primary/10 text-primary font-medium" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
            >
              {o.label}
            </button>
          ))}
          {filtered.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">No match</p>}
        </div>
      )}
    </div>
  );
}

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
              <SearchableSelect
                value={searchParams.get("client") || ""}
                placeholder="All Clients"
                options={accounts.map(a=>({ value: a.id, label: a.name }))}
                onChange={v=>update("client", v)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Project</label>
              <SearchableSelect
                value={searchParams.get("project") || ""}
                placeholder="All Projects"
                options={projects.map(p=>({ value: p.id, label: p.name }))}
                onChange={v=>update("project", v)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Region</label>
              <SearchableSelect
                value={searchParams.get("region") || ""}
                placeholder="All Regions"
                options={regions.map(r=>({ value: r, label: r }))}
                onChange={v=>update("region", v)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Batch</label>
              <SearchableSelect
                value={searchParams.get("batch") || ""}
                placeholder="All Batches"
                options={batches.map(b=>({ value: b, label: b }))}
                onChange={v=>update("batch", v)}
              />
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
