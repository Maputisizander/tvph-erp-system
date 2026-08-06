"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { syncVendorNow } from "@/app/dashboard/project-status/actions";

export function SyncNowButton({ vendorId }: { vendorId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() =>
          startTransition(async () => {
            const result = await syncVendorNow(vendorId);
            setMessage(result?.success ? null : (result?.error ?? "Sync failed"));
          })
        }
        disabled={isPending}
        className="inline-flex shrink-0 items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 px-3 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Syncing..." : "Sync now"}
      </button>
      {message && <span className="text-xs text-rose-600 dark:text-rose-400">{message}</span>}
    </div>
  );
}
