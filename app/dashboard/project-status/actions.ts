'use server'

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createServiceRoleClient } from '@/utils/supabase/service';
import { recordAuditLog } from '@/utils/audit';
import { requireCapability } from '@/lib/auth/permissions';
import { syncVendor } from '@/lib/node-status/sync';

export async function syncVendorNow(vendorId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('project_status.read', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const outcome = await syncVendor(vendorId, createServiceRoleClient());

  await recordAuditLog({
    entity_type: 'vendor',
    entity_id: vendorId,
    action: 'UPDATE',
    changes: { after: { node_status_sync: { status: outcome.status, nodes_synced: outcome.nodesSynced } } },
    performed_by: user.id,
  });

  revalidatePath('/dashboard/project-status');
  revalidatePath('/dashboard/projects');
  return { success: true, outcome };
}

export async function assignNodeToProject(nodeId: string, projectId: string | null) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('project_status.read', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { error } = await supabase
    .from('node_status')
    .update({ project_id: projectId, updated_at: new Date().toISOString() })
    .eq('id', nodeId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'node_status',
    entity_id: nodeId,
    action: 'UPDATE',
    changes: { after: { project_id: projectId } },
    performed_by: user.id,
  });

  revalidatePath('/dashboard/project-status');
  revalidatePath(`/dashboard/project-status/${nodeId}`);
  return { success: true };
}
