"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile, isSuperadmin } from "@/lib/auth/permissions";

/** Set (or clear) the storage plan quota, in GB. Superadmin only. */
export async function saveStorageQuota(formData: FormData) {
  const supabase = await createClient();
  const context = await getCurrentProfile(supabase);
  if (!context.user || !isSuperadmin(context.role)) {
    return { error: "You do not have permission to perform this action." };
  }

  const raw = formData.get("quotaGb");
  const gb = Number(raw);
  const quota = Number.isFinite(gb) && gb > 0 ? Math.round(gb * 1024 ** 3) : null;

  const { error } = await supabase
    .from("system_settings")
    .update({
      storage_quota_bytes: quota,
      updated_at: new Date().toISOString(),
      updated_by: context.user.id,
    })
    .eq("id", 1);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/system");
  return { success: true };
}