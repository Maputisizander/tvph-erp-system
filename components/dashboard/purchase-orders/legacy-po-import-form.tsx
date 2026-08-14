"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2, Calendar, CircleDollarSign, FileUp, FolderGit2, Hash, Loader2 } from "lucide-react";
import { importLegacyPurchaseOrder } from "@/app/dashboard/purchase-orders/actions";

const inputClass =
  "w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all";

interface LegacyPoImportFormProps {
  vendors: { id: string; name: string; currency: string }[];
  projects: { id: string; name: string }[];
}

export function LegacyPoImportForm({ vendors, projects }: LegacyPoImportFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, dispatch, isPending] = useActionState(importLegacyPurchaseOrder, null);

  useEffect(() => {
    if (state?.success) router.push(`/dashboard/purchase-orders/${state.id}`);
  }, [state, router]);

  return (
    <form ref={formRef} action={dispatch} className="space-y-6">
      {state?.error && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{state.error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm divide-y divide-slate-200 dark:divide-slate-800">
        <div className="p-6">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            <Building2 className="h-4 w-4 inline -mt-0.5 mr-1.5" />
            Vendor
          </label>
          <select name="vendor_id" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Select the vendor on the PO
            </option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <Hash className="h-4 w-4 inline -mt-0.5 mr-1.5" />
              PO Number
            </label>
            <input name="po_number" required placeholder="PO-2026000027" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <Calendar className="h-4 w-4 inline -mt-0.5 mr-1.5" />
              Issued Date
            </label>
            <input name="issued_date" type="date" required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <CircleDollarSign className="h-4 w-4 inline -mt-0.5 mr-1.5" />
              Total Amount
            </label>
            <input name="amount" type="number" required min="0" step="0.01" className={inputClass} />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Copy from the PDF — it caps what can be invoiced against this PO.
            </p>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Currency</label>
            <select name="currency" className={inputClass} defaultValue="PHP">
              <option value="PHP">PHP</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <FolderGit2 className="h-4 w-4 inline -mt-0.5 mr-1.5" />
              Project <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <select name="project_id" className={inputClass} defaultValue="">
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-6">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            <FileUp className="h-4 w-4 inline -mt-0.5 mr-1.5" />
            PO Document (PDF)
          </label>
          <input
            name="file"
            type="file"
            accept="application/pdf,.pdf"
            required
            className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-white file:font-medium file:cursor-pointer hover:file:bg-primary/90"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            The uploaded PDF becomes the PO&apos;s document — it should look like the PDF this system generates.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/dashboard/purchase-orders")}
          className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-medium transition-all active:scale-95"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Import as Issued
        </button>
      </div>
    </form>
  );
}
