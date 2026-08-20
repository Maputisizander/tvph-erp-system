import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { getCurrentProfile, isSuperadmin } from "@/lib/auth/permissions";
import { fetchStorageUsage, type StorageUsage } from "@/lib/system/storage";
import { getHealthChecks, type HealthCheck } from "@/lib/system/health";
import packageJson from "@/package.json";
import { StoragePanel, type StorageQuota } from "@/components/dashboard/system/storage-panel";
import { VersionPanel } from "@/components/dashboard/system/version-panel";
import { HealthPanel } from "@/components/dashboard/system/health-panel";

export const dynamic = "force-dynamic";

export type SystemVersion = {
  app: string;
  commitSha: string | null;
  ref: string | null;
  environment: string | null;
  deploymentId: string | null;
  commitMessage: string | null;
};

export default async function SystemPage() {
  const supabase = await createClient();
  const context = await getCurrentProfile(supabase);
  if (!isSuperadmin(context.role)) redirect("/dashboard");

  const service = createServiceRoleClient();

  const [storageRes, healthRes, quotaRes] = await Promise.allSettled([
    fetchStorageUsage(service),
    getHealthChecks(service),
    service.from("system_settings").select("storage_quota_bytes").eq("id", 1).maybeSingle(),
  ]);

  const storage: StorageUsage | null = storageRes.status === "fulfilled" ? storageRes.value : null;
  const health: HealthCheck[] = healthRes.status === "fulfilled" ? healthRes.value : [];
  const quota: StorageQuota = {
    bytes: quotaRes.status === "fulfilled" ? quotaRes.value?.data?.storage_quota_bytes ?? null : null,
  };

  const version: SystemVersion = {
    app: packageJson.version,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    environment: process.env.VERCEL_ENV ?? null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System</h1>
        <p className="text-sm text-slate-500 mt-1">
          Superadmin-only: storage usage, deployed version, and service health.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <StoragePanel storage={storage} quota={quota} storageError={storageRes.status === "rejected" ? String(storageRes.reason) : null} />
        <VersionPanel version={version} />
      </div>

      <HealthPanel checks={health} />
    </div>
  );
}