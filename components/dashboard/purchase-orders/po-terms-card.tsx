"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { overridePurchaseOrderPenalty, updatePurchaseOrderTerms } from "@/app/dashboard/purchase-orders/actions";
import { PoTcEditor } from "@/components/dashboard/purchase-orders/po-tc-editor";
import { defaultTc, parseTc, type PoTc } from "@/lib/pdf/terms";

type Terms = {
  net_days?: number | null;
  dp_due_days?: number | null;
  dp_amount?: number | null;
  penalty_rate?: number | null;
  penalty_type?: "monthly" | "fixed" | null;
  terms_and_conditions?: string | null;
};

type Penalty = {
  calculated_amount?: number | null;
  override_amount?: number | null;
  override_reason?: string | null;
} | null;

// section="payment" / section="tc" split the card across two editor steps;
// "all" keeps the original combined view (read-only detail page).
export function PoTermsCard({ poId, status, terms, penalty, canEdit, canOverride, defaultTcValue, section = "all", embedded = false }: {
  poId: string;
  status: string;
  terms: Terms;
  penalty: Penalty;
  canEdit: boolean;
  canOverride: boolean;
  defaultTcValue?: PoTc;
  section?: "all" | "payment" | "tc";
  embedded?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const penaltyAmount = penalty?.override_amount ?? penalty?.calculated_amount;

  function submit(action: (data: FormData) => Promise<{ error?: string }>) {
    return (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      startTransition(async () => {
        const result = await action(new FormData(event.currentTarget));
        if (result?.error) setError(result.error);
        else router.refresh();
      });
    };
  }

  const showPayment = section !== "tc";
  const showTc = section !== "payment";

  return (
    <div className={embedded ? "space-y-4" : "bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4"}>
      {showPayment && (
        <div>
          <h2 className={embedded ? "text-[10px] font-bold text-slate-400 uppercase tracking-widest" : "font-semibold text-slate-900 dark:text-white"}>Payment Terms</h2>
          <p className="text-sm text-slate-500 mt-1">Net {terms.net_days ?? 30} days{terms.dp_due_days != null ? ` · DP due in ${terms.dp_due_days} days` : ""}</p>
          {Number(terms.dp_amount) > 0 && (
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400 mt-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 px-2.5 py-1 rounded-lg">
              Downpayment: ₱{Number(terms.dp_amount).toLocaleString()}
            </p>
          )}
          <p className="text-sm text-slate-500">{terms.penalty_rate == null ? "No penalty rate configured" : `${Number(terms.penalty_rate) * 100}% ${terms.penalty_type === "fixed" ? "fixed (once)" : "monthly (daily-prorated)"}`}</p>
          {penaltyAmount != null && <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-2">Current penalty: ₱{Number(penaltyAmount).toLocaleString()}</p>}
        </div>
      )}

      {showPayment && canEdit && status === "draft" && (
        <form onSubmit={submit((data) => updatePurchaseOrderTerms(poId, data))} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <label htmlFor="terms-net-days" className="sr-only">Net days</label><input id="terms-net-days" name="net_days" type="number" min="1" step="1" required defaultValue={terms.net_days ?? 30} className="border rounded-lg px-3 py-2 text-sm dark:bg-[#0a0a0a]" />
          <label htmlFor="terms-dp-due-days" className="sr-only">DP due days</label><input id="terms-dp-due-days" name="dp_due_days" type="number" min="0" step="1" placeholder="DP due days" defaultValue={terms.dp_due_days ?? ""} className="border rounded-lg px-3 py-2 text-sm dark:bg-[#0a0a0a]" />
          <label htmlFor="terms-penalty-rate" className="sr-only">Penalty rate</label><input id="terms-penalty-rate" name="penalty_rate" type="number" min="0" max="1" step="0.0001" placeholder="0.1" defaultValue={terms.penalty_rate ?? ""} className="border rounded-lg px-3 py-2 text-sm dark:bg-[#0a0a0a]" />
          <label htmlFor="terms-penalty-type" className="sr-only">Penalty type</label><select id="terms-penalty-type" name="penalty_type" defaultValue={terms.penalty_type ?? "monthly"} className="border rounded-lg px-3 py-2 text-sm dark:bg-[#0a0a0a]"><option value="monthly">Monthly (daily-prorated)</option><option value="fixed">Fixed (once)</option></select>
          <button disabled={isPending} className="justify-self-start bg-primary text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">Save terms</button>
        </form>
      )}

      {showTc && canEdit && status === "draft" && (
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Terms and Conditions</h3>
          </div>
          <PoTcEditor
            poId={poId}
            tcValue={parseTc(terms.terms_and_conditions)}
            defaultTcValue={defaultTcValue ?? defaultTc()}
          />
        </div>
      )}

      {showPayment && canOverride && (
        <form onSubmit={submit((data) => overridePurchaseOrderPenalty(poId, data))} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <label htmlFor="penalty-override-amount" className="sr-only">Manual penalty amount</label><input id="penalty-override-amount" name="override_amount" type="number" min="0" step="any" placeholder="Manual penalty amount" defaultValue={penalty?.override_amount ?? ""} className="border rounded-lg px-3 py-2 text-sm dark:bg-[#0a0a0a]" />
          <label htmlFor="penalty-override-reason" className="sr-only">Reason for override</label><input id="penalty-override-reason" name="override_reason" placeholder="Reason for override" defaultValue={penalty?.override_reason ?? ""} className="border rounded-lg px-3 py-2 text-sm dark:bg-[#0a0a0a]" />
          <button disabled={isPending} className="justify-self-start border border-primary text-primary rounded-lg px-4 py-2 text-sm disabled:opacity-60">Override penalty</button>
        </form>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
