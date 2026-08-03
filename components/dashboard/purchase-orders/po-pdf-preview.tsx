"use client";

import { useState } from "react";
import { FileText } from "lucide-react";

export function PoPdfPreview({ poId, refreshKey }: { poId: string; refreshKey: string }) {
  const [page, setPage] = useState<string>("");

  // ponytail: remounting on refreshKey (composite of PDF-relevant PO fields
  // that changes after any save + router.refresh) reloads the PDF without
  // plumbing onSaved callbacks through every editor section.
  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      <div className="flex items-center gap-2 shrink-0">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <FileText className="h-3.5 w-3.5" /> PDF preview — refreshes after each save
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setPage(page === "#page=2" ? "" : "#page=2")}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            page === "#page=2"
              ? "bg-primary text-white border-primary"
              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          }`}
        >
          Jump to T&amp;C (page 2)
        </button>
      </div>
      <iframe
        key={refreshKey}
        src={`/api/purchase-orders/${poId}/pdf${page}`}
        className="flex-1 w-full min-h-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white"
        title="PO PDF preview"
      />
    </div>
  );
}
