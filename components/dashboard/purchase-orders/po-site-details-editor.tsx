"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, X, Check, Plus, Trash2 } from "lucide-react";
import { updatePOSiteDetails } from "@/app/dashboard/purchase-orders/actions";
import { REGIONS, REGION_NAMES } from "@/lib/constants/philippine-regions";
import { Combobox } from "@/components/ui/combobox";

interface SiteDetail {
  id?: string;
  sn?: number;
  region?: string | null;
  area_city?: string | null;
  node_id?: string | null;
  phase?: string | null;
  no_of_nodes: number;
  cable_length_km: number;
}

interface DraftSiteDetail {
  region: string;
  area_city: string;
  node_id: string;
  phase: string;
  no_of_nodes: number;
  cable_length_km: number;
}

export function POSiteDetailsEditor({
  poId,
  sites,
  canEdit,
}: {
  poId: string;
  sites: SiteDetail[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<DraftSiteDetail[]>([]);

  function startEditing() {
    setDraft(
      sites.map((s) => ({
        region: s.region ?? "",
        area_city: s.area_city ?? "",
        node_id: s.node_id ?? "",
        phase: s.phase ?? "",
        no_of_nodes: Number(s.no_of_nodes) || 0,
        cable_length_km: Number(s.cable_length_km) || 0,
      })),
    );
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  function updateDraft(index: number, field: keyof DraftSiteDetail, value: string | number) {
    setDraft((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addSite() {
    setDraft((prev) => [
      ...prev,
      { region: "", area_city: "", node_id: "", phase: "", no_of_nodes: 0, cable_length_km: 0 },
    ]);
  }

  function removeSite(index: number) {
    if (draft.length <= 1) return;
    setDraft((prev) => prev.filter((_, i) => i !== index));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result: { error?: string; success?: boolean } = await updatePOSiteDetails(poId, draft);
      if (result?.error) setError(result.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  const totalNodes = (sites: SiteDetail[]) =>
    sites.reduce((sum, s) => sum + (Number(s.no_of_nodes) || 0), 0);
  const totalCable = (sites: SiteDetail[]) =>
    sites.reduce((sum, s) => sum + (Number(s.cable_length_km) || 0), 0);

  const inputClass =
    "w-full px-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all";
  const thClass =
    "px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-left";
  const tdClass = "px-3 py-2";

  return (
    <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-slate-900 dark:text-white">Sites &amp; Details</h2>
          <span className="text-xs text-slate-400 font-normal">(Optional)</span>
        </div>
        {canEdit &&
          (editing ? (
            <button
              type="button"
              onClick={addSite}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Site
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

      {editing ? (
        <>
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
                {draft.map((site, idx) => (
                  <tr key={idx} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className={`${tdClass} text-center text-slate-400 font-mono text-xs`}>{idx + 1}</td>
                    <td className={tdClass}>
                      <Combobox
                        options={REGION_NAMES}
                        value={site.region ?? ""}
                        onChange={(val) => {
                          updateDraft(idx, "region", val);
                          const allowedAreas = REGIONS[val] || [];
                          if (!allowedAreas.includes(site.area_city ?? "")) {
                            updateDraft(idx, "area_city", "");
                          }
                        }}
                        placeholder="Region"
                      />
                    </td>
                    <td className={tdClass}>
                      <Combobox
                        options={REGIONS[site.region ?? ""] || []}
                        value={site.area_city ?? ""}
                        onChange={(val) => updateDraft(idx, "area_city", val)}
                        placeholder="Area / City"
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        type="text"
                        value={site.node_id ?? ""}
                        onChange={(e) => updateDraft(idx, "node_id", e.target.value)}
                        className={inputClass}
                        placeholder="e.g. MN113"
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        type="text"
                        value={site.phase ?? ""}
                        onChange={(e) => updateDraft(idx, "phase", e.target.value)}
                        className={inputClass}
                        placeholder="Phase"
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        type="number"
                        min="0"
                        value={site.no_of_nodes || ""}
                        onChange={(e) => updateDraft(idx, "no_of_nodes", parseInt(e.target.value) || 0)}
                        className={`${inputClass} text-right`}
                        placeholder="0"
                      />
                    </td>
                    <td className={tdClass}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={site.cable_length_km || ""}
                        onChange={(e) => updateDraft(idx, "cable_length_km", parseFloat(e.target.value) || 0)}
                        className={`${inputClass} text-right`}
                        placeholder="0.00"
                      />
                    </td>
                    <td className={tdClass}>
                      <button
                        type="button"
                        onClick={() => removeSite(idx)}
                        disabled={draft.length <= 1}
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
                    {totalNodes(draft).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-slate-900 dark:text-white">
                    {totalCable(draft).toLocaleString("en-US", {
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
      ) : sites.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-slate-500 uppercase bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold w-12">S/N</th>
                <th className="px-4 py-3 font-semibold">Region</th>
                <th className="px-4 py-3 font-semibold">Area / City</th>
                <th className="px-4 py-3 font-semibold w-24">Node ID</th>
                <th className="px-4 py-3 font-semibold w-20">Phase</th>
                <th className="px-4 py-3 font-semibold w-28 text-right">No. of Nodes</th>
                <th className="px-4 py-3 font-semibold w-36 text-right">Cable Length (KM)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sites.map((site) => (
                <tr key={site.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{site.sn}</td>
                  <td className="px-4 py-3 text-slate-900 dark:text-white">{site.region}</td>
                  <td className="px-4 py-3 text-slate-900 dark:text-white">{site.area_city}</td>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-mono">{site.node_id || "—"}</td>
                  <td className="px-4 py-3 text-slate-900 dark:text-white">{site.phase || "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                    {Number(site.no_of_nodes).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                    {Number(site.cable_length_km).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20">
                <td colSpan={5} className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                  {totalNodes(sites).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                  {totalCable(sites).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="px-6 py-8 text-sm text-slate-400 italic text-center">
          No site details yet.
          {canEdit ? " Click Edit to add site details." : ""}
        </p>
      )}
    </div>
  );
}
