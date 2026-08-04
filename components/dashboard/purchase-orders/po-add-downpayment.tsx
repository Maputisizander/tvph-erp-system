"use client";
//awdawdawdawdawdawdawdawdwaadawaw
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, CheckCircle2, XCircle, Wallet } from "lucide-react";
import { addDownPayment } from "@/app/dashboard/purchase-orders/actions";

export function AddDownpayment({
  poId,
  poAmount,
  currencySymbol,
}: {
  poId: string;
  poAmount: number;
  currencySymbol: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successAmount, setSuccessAmount] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result: { error?: string; success?: boolean } = await addDownPayment(poId, Number(amount));
      if (result?.error) setError(result.error);
      else {
        setOpen(false);
        setSuccessAmount(Number(amount));
        setAmount("");
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-800 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 px-3 py-1.5 rounded-lg transition-all"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Downpayment
      </button>

      {open && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <form
            onSubmit={submit}
            className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
          >
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-[#0a0a0a]/50">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Wallet className="h-5 w-5 text-amber-500" />
                Add Downpayment
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Record a downpayment against this PO. The balance after downpayment will update automatically.
              </p>
              <div>
                <label htmlFor="dp-amount" className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Downpayment Amount
                </label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{currencySymbol}</span>
                  <input
                    id="dp-amount"
                    type="number"
                    min="0.01"
                    max={poAmount}
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full pl-8 pr-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  PO total: {currencySymbol}
                  {poAmount.toLocaleString()}
                </p>
              </div>
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
                  <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
                >
                  {isPending ? (
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Save Downpayment
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {successAmount !== null && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-8 flex flex-col items-center text-center space-y-4">
              <span className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Downpayment Added</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  The downpayment has been recorded against this PO.
                </p>
              </div>
              <div className="w-full p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-center">
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest block mb-1">
                  Downpayment Amount
                </p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                  {currencySymbol}
                  {successAmount.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Balance after downpayment updates automatically.
                </p>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setSuccessAmount(null);
                  setOpen(false);
                  setAmount("");
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
