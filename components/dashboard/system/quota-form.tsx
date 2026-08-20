"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { saveStorageQuota } from "@/app/dashboard/system/actions";

export function QuotaForm({ initialGb }: { initialGb?: number }) {
  const [value, setValue] = useState(initialGb ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const formData = new FormData();
    formData.set("quotaGb", String(value));
    startTransition(async () => {
      const res = await saveStorageQuota(formData);
      setMessage(res.error ? res.error : "Quota saved.");
    });
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
      <div>
        <label htmlFor="quotaGb" className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
          Plan quota (GB)
        </label>
        <input
          id="quotaGb"
          type="number"
          min="0"
          step="0.1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 25"
          className="w-32 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#071F15] px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-2 text-sm font-medium transition-colors"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save
      </button>
      <div className="flex-1">
        {message && <p className="text-xs text-slate-500">{message}</p>}
      </div>
    </form>
  );
}