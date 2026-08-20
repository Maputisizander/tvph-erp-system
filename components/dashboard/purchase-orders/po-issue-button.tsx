"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Check, X } from "lucide-react";
import { submitPOForApproval } from "@/app/dashboard/purchase-orders/actions";

interface EligibleApprover {
  id: string;
  full_name: string;
  email: string;
}

export function PoIssueButton({
  poId,
  eligibleApprovers,
  eligibleFinanceApprovers,
}: {
  poId: string;
  eligibleApprovers: EligibleApprover[];
  eligibleFinanceApprovers: EligibleApprover[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedFinance, setSelectedFinance] = useState<string[]>([]);
  const router = useRouter();

  const noApprovers = eligibleApprovers.length === 0;
  const noFinanceApprovers = eligibleFinanceApprovers.length === 0;

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleFinance(id: string) {
    setSelectedFinance((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitPOForApproval(poId, selected, selectedFinance);
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  // No other admin/superadmin exists to approve — submission is impossible.
  if (noApprovers || noFinanceApprovers) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          disabled
          title={
            noApprovers
              ? "No other admin or superadmin is available to approve this PO."
              : "No finance or superadmin user is available to do the budget check."
          }
          className="inline-flex items-center gap-2 bg-primary/60 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm cursor-not-allowed opacity-60"
        >
          <Clock className="h-4 w-4" />
          Submit for Approval
        </button>
        <span className="text-xs text-amber-600 dark:text-amber-400">
          {noApprovers
            ? "No eligible approver — another admin must exist to approve this PO."
            : "No eligible finance approver — a finance or superadmin must exist to do the budget check."}
        </span>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm active:scale-95 disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Clock className="h-4 w-4" />
        )}
        {isPending ? "Submitting…" : "Submit for Approval"}
      </button>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400 max-w-xs text-right">
          {error}
        </span>
      )}

      {open && (
        <>
          {/* Click-outside backdrop */}
          <button
            type="button"
            aria-label="Close approver picker"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#071F15] shadow-lg p-4 text-left">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                Choose approver(s)
              </h4>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 -mr-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
              Choose the admin(s) who will approve this PO.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Selected admins will be emailed that this PO is pending their approval.
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1 -mx-1 px-1">
              {eligibleApprovers.map((a) => {
                const checked = selected.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                        checked
                          ? "bg-primary border-primary text-white"
                          : "border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {checked && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggle(a.id)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900 dark:text-white truncate">
                        {a.full_name}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                        {a.email}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-4 mb-1">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                Choose finance approver(s)
              </h4>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Required</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Pick who will do the budget check once the admin approves. They will be emailed when the admin approval passes.
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1 -mx-1 px-1">
              {eligibleFinanceApprovers.map((a) => {
                const checked = selectedFinance.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                        checked
                          ? "bg-primary border-primary text-white"
                          : "border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {checked && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggleFinance(a.id)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900 dark:text-white truncate">
                        {a.full_name}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                        {a.email}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || selected.length === 0 || selectedFinance.length === 0}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
              Submit for Approval
              {selected.length > 0 && ` (${selected.length} admin${selected.length > 1 ? "s" : ""}${selectedFinance.length > 0 ? ` · ${selectedFinance.length} finance` : ""})`}
            </button>
            {selected.length === 0 || selectedFinance.length === 0 ? (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 text-center">
                Select at least one admin and one finance approver to submit.
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
