"use client";

import { useActionState, useState, useCallback, useMemo } from "react";
import {
  Save,
  Building2,
  CircleDollarSign,
  FileText,
  FolderGit2,
  MapPin,
  Plus,
  Trash2,
} from "lucide-react";
import { createPurchaseRequest, updatePurchaseRequestAction } from "@/app/dashboard/purchase-requests/actions";
import { Combobox } from "@/components/ui/combobox";

interface LineItem {
  item_code: string;
  description: string;
  qty: number;
  uom: string;
  unit_price: number;
}

interface SiteDetail {
  region: string;
  area_city: string;
  node_id: string;
  phase: string;
  no_of_nodes: number;
  cable_length_km: number;
}

interface PRInitialData {
  id: string;
  pr_number: string;
  description: string | null;
  project_id: string | null;
  vendor_id?: string | null;
  line_items: LineItem[];
  site_details?: SiteDetail[];
  dp_amount?: number;
  dp_percent?: number;
}

const UOM_OPTIONS = ["LOT", "PCS", "SET", "HRS", "DAYS", "MOS", "SQM", "LM", "KG", "KM"];

const DP_PRESETS = [30, 40, 50, 60, 70, 80, 90, 100];

const EMPTY_LINE_ITEM: LineItem = {
  item_code: "",
  description: "",
  qty: 1,
  uom: "LOT",
  unit_price: 0,
};

const EMPTY_SITE: SiteDetail = {
  region: "",
  area_city: "",
  node_id: "",
  phase: "",
  no_of_nodes: 0,
  cable_length_km: 0,
};

export function CreatePRForm({
  projects,
  vendors,
  regions,
  areaByRegion,
  initialData,
}: {
  projects: { id: string; name: string }[];
  vendors?: { id: string; name: string }[];
  regions: string[];
  areaByRegion: Record<string, string[]>;
  initialData?: PRInitialData | null;
}) {
  const isEditing = !!initialData;
  const [state, formAction, isPending] = useActionState(
    isEditing ? updatePurchaseRequestAction : createPurchaseRequest,
    null
  );
  const [lineItems, setLineItems] = useState<LineItem[]>(
    initialData?.line_items?.length
      ? initialData.line_items
      : [{ ...EMPTY_LINE_ITEM }]
  );
  const [siteDetails, setSiteDetails] = useState<SiteDetail[]>(
    initialData?.site_details?.length
      ? initialData.site_details
      : [{ ...EMPTY_SITE }]
  );
  const initialDpPercent = useMemo(() => {
    const dp = Number(initialData?.dp_amount || 0);
    const p = Number(initialData?.dp_percent || 0);
    if (p > 0) return Math.round(p * 100) / 100;
    if (dp > 0) {
      const t = (initialData?.line_items || []).reduce(
        (s, li) => s + (Number(li.qty) || 0) * (Number(li.unit_price) || 0),
        0
      );
      if (t > 0) return Math.round((dp / t) * 10000) / 100;
    }
    return 0;
  }, [initialData]);

  const [hasDp, setHasDp] = useState<boolean>(initialDpPercent > 0);
  const [dpPercent, setDpPercent] = useState<number>(initialDpPercent > 0 ? initialDpPercent : 30);

  // ── Line item helpers ──
  const updateLineItem = useCallback(
    (index: number, field: keyof LineItem, value: string | number) => {
      setLineItems((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

  const addLineItem = useCallback(() => {
    setLineItems((prev) => [...prev, { ...EMPTY_LINE_ITEM }]);
  }, []);

  const removeLineItem = useCallback(
    (index: number) => {
      if (lineItems.length <= 1) return;
      setLineItems((prev) => prev.filter((_, i) => i !== index));
    },
    [lineItems.length]
  );

  // ── Site detail helpers ──
  const updateSite = useCallback(
    (index: number, field: keyof SiteDetail, value: string | number) => {
      setSiteDetails((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

  const addSite = useCallback(() => {
    setSiteDetails((prev) => [...prev, { ...EMPTY_SITE }]);
  }, []);

  const removeSite = useCallback(
    (index: number) => {
      if (siteDetails.length <= 1) return;
      setSiteDetails((prev) => prev.filter((_, i) => i !== index));
    },
    [siteDetails.length]
  );

  const totalAmount = lineItems.reduce(
    (sum, li) => sum + (Number(li.qty) || 0) * (Number(li.unit_price) || 0),
    0
  );
  const totalNodes = siteDetails.reduce((sum, s) => sum + (Number(s.no_of_nodes) || 0), 0);
  const totalCable = siteDetails.reduce((sum, s) => sum + (Number(s.cable_length_km) || 0), 0);

  const dpAmount = hasDp ? Math.round(totalAmount * dpPercent) / 100 : 0;

  const inputClass =
    "w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all";
  const thClass =
    "px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-left";
  const tdClass = "px-3 py-2";

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="line_items" value={JSON.stringify(lineItems)} />
      <input type="hidden" name="site_details" value={JSON.stringify(siteDetails)} />
      <input type="hidden" name="dp_amount" value={dpAmount.toString()} />
      <input type="hidden" name="dp_percent" value={(hasDp ? dpPercent : 0).toString()} />
      {initialData && <input type="hidden" name="pr_id" value={initialData.id} />}

      {state?.error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium">
          {state.error}
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          SECTION 1: Request Details
         ════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-slate-900 dark:text-white">Request Details</h2>
        </div>

        <div className="p-6 grid grid-cols-1 gap-6">
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              What do you need? <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={3}
              defaultValue={initialData?.description || ""}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-y"
              placeholder="Describe what you need freely — e.g. 50km fiber optic cable for Cebu expansion, including any specifications or notes"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="project_id" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Project <span className="text-slate-400 font-normal ml-1">(Optional)</span>
            </label>
            <div className="relative">
              <FolderGit2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                id="project_id"
                name="project_id"
                defaultValue={initialData?.project_id || ""}
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
              >
                <option value="">
                  {projects.length > 0 ? "Select a project" : "No projects available"}
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="vendor_id" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Preferred Vendor <span className="text-slate-400 font-normal ml-1">(Optional)</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                id="vendor_id"
                name="vendor_id"
                defaultValue={initialData?.vendor_id || ""}
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
              >
                <option value="">
                  {vendors && vendors.length > 0 ? "Select a vendor" : "No vendors available"}
                </option>
                {(vendors || []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500">
              Nominate the vendor you intend to award. When this request is approved, it will be pre-filled on the purchase order.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="has_dp" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Downpayment <span className="text-slate-400 font-normal ml-1">(Optional)</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  id="has_dp"
                  type="checkbox"
                  checked={hasDp}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setHasDp(next);
                    if (next && dpPercent <= 0) setDpPercent(30);
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {hasDp ? "No downpayment" : "Has downpayment"}
                </span>
              </label>
            </div>

            {hasDp && (
              <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/70 dark:border-amber-800/40 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_11rem] gap-3">
                  <div>
                    <label htmlFor="dp_percent" className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                      Percent of Total (%)
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <input
                          id="dp_percent"
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          value={dpPercent || ""}
                          onChange={(e) => setDpPercent(parseFloat(e.target.value) || 0)}
                          className="w-full pl-8 pr-3 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                          placeholder="30"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="dp_preset" className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                      Quick Select
                    </label>
                    <select
                      id="dp_preset"
                      value={DP_PRESETS.includes(dpPercent) ? dpPercent : ""}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!Number.isNaN(val)) setDpPercent(val);
                      }}
                      className="w-full px-3 py-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
                    >
                      <option value="" disabled>
                        Custom…
                      </option>
                      {DP_PRESETS.map((p) => (
                        <option key={p} value={p}>
                          {p}%
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">
                    DOWNPAYMENT {dpPercent || 0}%
                  </span>
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                    ₱{dpAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-500">
                    Balance: ₱{Math.max(0, totalAmount - dpAmount).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  Enter a percent or pick a preset — the peso amount is computed automatically and carried to the PO on approval.
                </p>
              </div>
            )}

            {!hasDp && (
              <p className="text-xs text-slate-500">
                No upfront payment required. Toggle on to set a downpayment (defaults to 30%).
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════
          SECTION 2: Line Items Table (estimated prices)
         ════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CircleDollarSign className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Estimated Line Items</h2>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-bold">
              {lineItems.length}
            </span>
          </div>
          <button
            type="button"
            onClick={addLineItem}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Row
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10">
                <th className={`${thClass} w-12`}>#</th>
                <th className={`${thClass} w-24`}>Item Code</th>
                <th className={thClass}>Description</th>
                <th className={`${thClass} w-20`}>Qty</th>
                <th className={`${thClass} w-24`}>UoM</th>
                <th className={`${thClass} w-32`}>Est. Unit Price</th>
                <th className={`${thClass} w-32`}>Amount</th>
                <th className={`${thClass} w-10`}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {lineItems.map((li, idx) => {
                const rowAmount = (Number(li.qty) || 0) * (Number(li.unit_price) || 0);
                return (
                  <tr key={idx} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className={`${tdClass} text-center text-slate-400 font-mono text-xs`}>
                      {idx + 1}
                    </td>
                    <td className={tdClass}>
                      <input
                        type="text"
                        value={li.item_code}
                        onChange={(e) => updateLineItem(idx, "item_code", e.target.value)}
                        className={inputClass}
                        placeholder="—"
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        type="text"
                        value={li.description}
                        onChange={(e) => updateLineItem(idx, "description", e.target.value)}
                        className={inputClass}
                        placeholder="Item description"
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={li.qty || ""}
                        onChange={(e) => updateLineItem(idx, "qty", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} text-right`}
                        placeholder="1"
                      />
                    </td>
                    <td className={tdClass}>
                      <select
                        value={li.uom}
                        onChange={(e) => updateLineItem(idx, "uom", e.target.value)}
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
                        step="any"
                        value={li.unit_price || ""}
                        onChange={(e) => updateLineItem(idx, "unit_price", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} text-right`}
                        placeholder="0.00"
                      />
                    </td>
                    <td className={`${tdClass} text-right font-semibold text-slate-900 dark:text-white pr-4`}>
                      ₱{rowAmount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className={tdClass}>
                      <button
                        type="button"
                        onClick={() => removeLineItem(idx)}
                        disabled={lineItems.length <= 1}
                        className="p-1 text-slate-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20">
                <td colSpan={6} className="px-3 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Estimated Total
                </td>
                <td className="px-3 py-3 text-right font-bold text-lg text-slate-900 dark:text-white pr-4">
                  ₱{totalAmount.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="px-6 py-3 text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800/50">
          Prices are estimates. Actual vendor prices are confirmed when this request is converted into a purchase order.
        </p>
      </div>

      {/* ════════════════════════════════════════════════════
          SECTION 3: Sites & Details (inherited by the PO at conversion)
         ════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Sites &amp; Details</h2>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-bold">
              {siteDetails.length}
            </span>
          </div>
          <button
            type="button"
            onClick={addSite}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Site
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10">
                <th className={`${thClass} w-12`}>S/N</th>
                <th className={thClass}>Region</th>
                <th className={thClass}>Area / City</th>
                <th className={`${thClass} w-28`}>Node ID</th>
                <th className={`${thClass} w-24`}>Phase</th>
                <th className={`${thClass} w-28`}>No. of Nodes</th>
                <th className={`${thClass} w-36`}>Cable Length (KM)</th>
                <th className={`${thClass} w-10`}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {siteDetails.map((site, idx) => (
                <tr key={idx} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                  <td className={`${tdClass} text-center text-slate-400 font-mono text-xs`}>
                    {idx + 1}
                  </td>
                  <td className={tdClass}>
                    <Combobox
                      options={regions}
                      value={site.region}
                      onChange={(val) => {
                        updateSite(idx, "region", val);
                        const allowedAreas = areaByRegion[val] || [];
                        if (!allowedAreas.includes(site.area_city)) {
                          updateSite(idx, "area_city", "");
                        }
                      }}
                      placeholder="Region"
                    />
                  </td>
                  <td className={tdClass}>
                    <Combobox
                      options={areaByRegion[site.region] || []}
                      value={site.area_city}
                      onChange={(val) => updateSite(idx, "area_city", val)}
                      placeholder="Area / City"
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      type="text"
                      value={site.node_id}
                      onChange={(e) => updateSite(idx, "node_id", e.target.value)}
                      className={inputClass}
                      placeholder="e.g. MN113"
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      type="text"
                      value={site.phase}
                      onChange={(e) => updateSite(idx, "phase", e.target.value)}
                      className={inputClass}
                      placeholder="Phase"
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      type="number"
                      min="0"
                      value={site.no_of_nodes || ""}
                      onChange={(e) => updateSite(idx, "no_of_nodes", parseInt(e.target.value) || 0)}
                      className={`${inputClass} text-right`}
                      placeholder="0"
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={site.cable_length_km || ""}
                      onChange={(e) => updateSite(idx, "cable_length_km", parseFloat(e.target.value) || 0)}
                      className={`${inputClass} text-right`}
                      placeholder="0.00"
                    />
                  </td>
                  <td className={tdClass}>
                    <button
                      type="button"
                      onClick={() => removeSite(idx)}
                      disabled={siteDetails.length <= 1}
                      className="p-1 text-slate-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20">
                <td colSpan={5} className="px-3 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total
                </td>
                <td className="px-3 py-3 text-right font-bold text-slate-900 dark:text-white">
                  {totalNodes.toLocaleString()}
                </td>
                <td className="px-3 py-3 text-right font-bold text-slate-900 dark:text-white">
                  {totalCable.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="px-6 py-3 text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800/50">
          Site scope captured here is carried into the purchase order when this request is converted.
        </p>
      </div>

      {/* ── Submit ── */}
      <div className="flex items-center justify-end gap-4">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-6 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95"
        >
          {isPending ? (
            <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="h-5 w-5" />
          )}
          {isEditing ? "Save Changes" : "Create Request"}
        </button>
      </div>
    </form>
  );
}
