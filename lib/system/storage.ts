import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BucketUsage = { bucket_id: string; files: number; bytes: number };

export type StorageUsage = {
  buckets: BucketUsage[];
  totalBytes: number;
  totalFiles: number;
};

/** Per-bucket used bytes + file counts via the storage_usage() RPC. */
export async function fetchStorageUsage(
  supabase: SupabaseClient,
): Promise<StorageUsage> {
  const { data, error } = await supabase.rpc("storage_usage");
  if (error) throw new Error(error.message);
  const buckets = (data || []) as BucketUsage[];
  return {
    buckets,
    totalBytes: buckets.reduce((sum, b) => sum + (b.bytes || 0), 0),
    totalFiles: buckets.reduce((sum, b) => sum + (b.files || 0), 0),
  };
}