"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePOTermsAndConditions } from "@/app/dashboard/purchase-orders/actions";
import { tcEquals, type PoTc } from "@/lib/pdf/terms";

// Structured T&C editor: each item / sub / continuation / instruction / page-3
// lead is its own labeled field, so wording can be edited without touching the
// golden layout (numbering, sub-letters, hanging indents, page-3 split are all
// applied by the renderer). Saving the default verbatim stores NULL, keeping
// the golden template render; any real edit stores the structured object.
const SUB = "abcdefghijklmnopqrstuvwxyz";

export function PoTcEditor({ poId, tcValue, defaultTcValue }: {
  poId: string;
  tcValue: PoTc | null;
  defaultTcValue: PoTc;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const tc = tcValue ?? defaultTcValue;
  const isCustom = tcValue != null;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const form = new FormData(event.currentTarget);
      const built: PoTc = {
        items: tc.items.map((it, i) => ({
          text: String(form.get(`item.${i}.text`) ?? "").trim(),
          subs: it.subs.map((_, j) => String(form.get(`item.${i}.sub.${j}`) ?? "").trim()),
          conts: it.conts.map((_, k) => String(form.get(`item.${i}.cont.${k}`) ?? "").trim()),
        })),
        instructions: tc.instructions.map((ins, i) => ({
          text: String(form.get(`ins.${i}.text`) ?? "").trim(),
          conts: ins.conts.map((_, k) => String(form.get(`ins.${i}.cont.${k}`) ?? "").trim()),
        })),
        sitesLead: tc.sitesLead.map((_, i) => String(form.get(`lead.${i}`) ?? "").trim()),
      };
      const payload = tcEquals(built, defaultTcValue) ? "" : JSON.stringify(built);
      const fd = new FormData();
      fd.set("terms_and_conditions", payload);
      const result = await updatePOTermsAndConditions(poId, fd);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  const field = (name: string, value: string, rows = 2) => (
    <textarea
      name={name}
      defaultValue={value}
      rows={rows}
      className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:bg-[#0a0a0a] resize-y"
    />
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="text-xs text-slate-500">
        {isCustom
          ? "Custom T&amp;C — edit any wording; the layout (numbering, sub-letters, indents, page-3 split) is preserved."
          : "Editing a copy of the standard template. Saving it unchanged keeps the standard template; edit any wording and the layout stays the same."}
      </p>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Terms and Conditions</h3>
        {tc.items.map((it, i) => (
          <div key={`item-${i}`} className="space-y-1.5 pl-0 sm:pl-3 border-l-2 border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Item {i + 1}</label>
            {field(`item.${i}.text`, it.text, 2)}
            {it.subs.map((s, j) => (
              <div key={`sub-${i}-${j}`} className="pl-4 space-y-1">
                <label className="block text-xs text-slate-500">{SUB[j]}.</label>
                {field(`item.${i}.sub.${j}`, s, 2)}
              </div>
            ))}
            {it.conts.map((c, k) => (
              <div key={`cont-${i}-${k}`} className="pl-8 space-y-1">
                <label className="block text-xs text-slate-500">…</label>
                {field(`item.${i}.cont.${k}`, c, 2)}
              </div>
            ))}
          </div>
        ))}
      </section>

      <section className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">A. Instructions to Vendor</h3>
        {tc.instructions.map((ins, i) => (
          <div key={`ins-${i}`} className="space-y-1.5 pl-0 sm:pl-3 border-l-2 border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Instruction {i + 1}</label>
            {field(`ins.${i}.text`, ins.text, 2)}
            {ins.conts.map((c, k) => (
              <div key={`icont-${i}-${k}`} className="pl-8 space-y-1">
                <label className="block text-xs text-slate-500">…</label>
                {field(`ins.${i}.cont.${k}`, c, 2)}
              </div>
            ))}
          </div>
        ))}
      </section>

      <section className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Page 3 — leads (Items 9 / 10)</h3>
        {tc.sitesLead.map((t, i) => (
          <div key={`lead-${i}`} className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Item {i + 9}</label>
            {field(`lead.${i}`, t, 3)}
          </div>
        ))}
      </section>

      <div className="flex items-center gap-3 pt-2">
        <button disabled={isPending} className="justify-self-start bg-primary text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          Save terms and conditions
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </form>
  );
}