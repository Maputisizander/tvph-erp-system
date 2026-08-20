import type { SystemVersion } from "@/app/dashboard/system/page";

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-sm font-medium text-right break-all">{value ?? "—"}</span>
    </div>
  );
}

export function VersionPanel({ version }: { version: SystemVersion }) {
  const onVercel = !!version.commitSha;
  return (
    <section className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
      <h2 className="text-base font-semibold uppercase tracking-wider">Version</h2>
      {onVercel ? (
        <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          <Row label="App version" value={`v${version.app}`} />
          <Row label="Commit" value={version.commitSha!.slice(0, 7)} />
          <Row label="Branch" value={version.ref} />
          <Row label="Environment" value={version.environment} />
          <Row label="Deployment" value={version.deploymentId} />
          <Row label="Commit message" value={version.commitMessage} />
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          v{version.app} — not deployed on Vercel (env vars absent).
        </p>
      )}
    </section>
  );
}