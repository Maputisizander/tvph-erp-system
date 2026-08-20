import { formatBytes } from "@/lib/system/format";
import type { StorageUsage } from "@/lib/system/storage";
import { QuotaForm } from "./quota-form";

export type StorageQuota = { bytes: number | null };

export function StoragePanel({
  storage,
  quota,
  storageError,
}: {
  storage: StorageUsage | null;
  quota: StorageQuota;
  storageError: string | null;
}) {
  const pct =
    storage && quota.bytes
      ? Math.min(100, Math.round((storage.totalBytes / quota.bytes) * 100))
      : null;

  return (
    <section className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
      <h2 className="text-base font-semibold uppercase tracking-wider">Storage (Supabase)</h2>

      {storageError ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          Failed to load storage usage: {storageError}
        </p>
      ) : storage ? (
        <div className="mt-4 space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-2xl font-bold">{formatBytes(storage.totalBytes)}</p>
              <p className="text-xs text-slate-500">
                {storage.totalFiles} files across {storage.buckets.length} buckets
              </p>
            </div>
            {quota.bytes ? (
              <p className="text-sm text-slate-500">
                of <span className="font-semibold text-slate-700 dark:text-slate-200">{formatBytes(quota.bytes)}</span> quota
                <span className="ml-1 font-semibold text-slate-700 dark:text-slate-200">({pct}%)</span>
              </p>
            ) : (
              <p className="text-xs text-slate-400">no quota configured</p>
            )}
          </div>

          {quota.bytes && (
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${pct! >= 90 ? "bg-red-500" : pct! >= 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="pb-2">Bucket</th>
                <th className="pb-2 text-right">Files</th>
                <th className="pb-2 text-right">Used</th>
              </tr>
            </thead>
            <tbody>
              {storage.buckets.map((b) => (
                <tr key={b.bucket_id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2 font-medium">{b.bucket_id}</td>
                  <td className="py-2 text-right text-slate-500">{b.files}</td>
                  <td className="py-2 text-right text-slate-500">{formatBytes(b.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <QuotaForm initialGb={quota.bytes ? Math.round(quota.bytes / 1024 ** 3) : undefined} />
        </div>
      ) : null}
    </section>
  );
}