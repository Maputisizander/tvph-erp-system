"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleDollarSign, Pencil, X, Check, Plus, Trash2 } from "lucide-react";
import { updatePOLineItems } from "@/app/dashboard/purchase-orders/actions";

const UOM_OPTIONS = ["LOT", "PCS", "SET", "HRS", "DAYS", "MOS", "SQM", "LM", "KG", "KM"];

interface LineItem {
  id?: string;
  line_no?: number;
  item_code?: string | null;
  description?: string | null;
  qty: number;
  uom?: string | null;
  unit_price: number;
  amount?: number;
}

interface DraftLineItem {
  item_code: string;
  description: string;
  qty: number;
  uom: string;
  unit_price: number;
}

export function POLineItemsEditor({
  poId,
  items,
  currencySymbol,
  canEdit,
  embedded = false,
}: {
  poId: string;
  items: LineItem[];
  currencySymbol: string;
  canEdit: boolean;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<DraftLineItem[]>([]);

  const totalAmount = (items: LineItem[]) =>
    items.reduce((sum, li) => sum + (Number(li.qty) || 0) * (Number(li.unit_price) || 0), 0);

  function startEditing() {
    setDraft(
      items.map((li) => ({
        item_code: li.item_code ?? "",
        description: li.description ?? "",
        qty: Number(li.qty) || 0,
        uom: li.uom || "LOT",
        unit_price: Number(li.unit_price) || 0,
      })),
    );
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  function updateDraft(index: number, field: keyof DraftLineItem, value: string | number) {
    setDraft((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addRow() {
    setDraft((prev) => [...prev, { item_code: "", description: "", qty: 1, uom: "LOT", unit_price: 0 }]);
  }

  function removeRow(index: number) {
    if (draft.length <= 1) return;
    setDraft((prev) => prev.filter((_, i) => i !== index));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result: { error?: string; success?: boolean } = await updatePOLineItems(poId, draft);
      if (result?.error) setError(result.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  const inputClass =
    "w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all";
  const thClass =
    "px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-left";
  const tdClass = "px-3 py-2";

  return (
    <div className={embedded ? "" : "bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm"}>
      {!embedded && (
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Line Items</h2>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-bold">
              {editing ? draft.length : items.length}
            </span>
          </div>
          {canEdit &&
            (editing ? (
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Row
              </button>
            ) : (
              <button
                type="button"
                onClick={startEditing}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            ))}
        </div>
      )}

      {editing ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10">
                  <th className={`${thClass} w-12`}>#</th>
                  <th className={`${thClass} w-24`}>Item Code</th>
                  <th className={`${thClass} min-w-[5rem]`}>Qty</th>
                  <th className={`${thClass} w-24`}>UoM</th>
                  <th className={`${thClass} w-32`}>Unit Price</th>
                  <th className={`${thClass} w-32`}>Amount</th>
                  <th className={`${thClass} w-10`}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {draft.map((li, idx) => {
                  const rowAmount = (Number(li.qty) || 0) * (Number(li.unit_price) || 0);
                  return (
                    <Fragment key={idx}>
                      <tr className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                        <td className={`${tdClass} text-center text-slate-400 font-mono text-xs`}>{idx + 1}</td>
                        <td className={tdClass}>
                          <input
                            type="text"
                            value={li.item_code}
                            onChange={(e) => updateDraft(idx, "item_code", e.target.value)}
                            className={inputClass}
                            placeholder="—"
                          />
                        </td>
                        <td className={tdClass}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={li.qty || ""}
                            onChange={(e) => updateDraft(idx, "qty", parseFloat(e.target.value) || 0)}
                            className={`${inputClass} min-w-[5rem] text-right`}
                            placeholder="1"
                          />
                        </td>
                        <td className={tdClass}>
                          <select
                            value={li.uom}
                            onChange={(e) => updateDraft(idx, "uom", e.target.value)}
                            className={`${inputClass} appearance-none`}
                          >
                            {UOM_OPTIONS.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className={tdClass}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={li.unit_price || ""}
                            onChange={(e) => updateDraft(idx, "unit_price", parseFloat(e.target.value) || 0)}
                            className={`${inputClass} text-right`}
                            placeholder="0.00"
                          />
                        </td>
                        <td className={`${tdClass} text-right font-semibold text-slate-900 dark:text-white pr-4`}>
                          {currencySymbol}
                          {rowAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={tdClass}>
                          <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            disabled={draft.length <= 1}
                            className="p-1 text-slate-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                      <tr className="group">
                        <td colSpan={7} className="px-3 pb-2 pt-0">
                          <label className="block -mx-3 px-3 py-2 bg-slate-50/30 dark:bg-slate-800/10 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Description
                          </label>
                          <textarea
                            value={li.description}
                            onChange={(e) => updateDraft(idx, "description", e.target.value)}
                            className={`${inputClass} resize-none min-h-[2.5rem]`}
                            placeholder="Item description"
                            rows={2}
                          />
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20">
                  <td colSpan={5} className="px-3 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Total
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-lg text-slate-900 dark:text-white pr-4">
                    {currencySymbol}
                    {totalAmount(draft).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {error && <p className="px-6 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800/50">
            <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
            >
              {isPending ? (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save Changes
            </button>
          </div>
        </>
      ) : items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold w-12">#</th>
                <th className="px-4 py-3 font-semibold w-24">Item Code</th>
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 font-semibold w-16 text-right">Qty</th>
                <th className="px-4 py-3 font-semibold w-16">UoM</th>
                <th className="px-4 py-3 font-semibold w-28 text-right">Unit Price</th>
                <th className="px-4 py-3 font-semibold w-28 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((li) => (
                <tr key={li.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{li.line_no}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{li.item_code || "—"}</td>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{li.description}</td>
                  <td className="px-4 py-3 text-right text-slate-900 dark:text-white">{Number(li.qty).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{li.uom}</td>
                  <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                    {currencySymbol}
                    {Number(li.unit_price).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                    {currencySymbol}
                    {Number(li.amount).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20">
                <td colSpan={6} className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                  {currencySymbol}
                  {totalAmount(items).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="px-6 py-8 text-sm text-slate-400 italic text-center">
          No line items yet.
          {canEdit ? " Click Edit to add the first line item." : ""}
        </p>
      )}
    </div>
  );
}
