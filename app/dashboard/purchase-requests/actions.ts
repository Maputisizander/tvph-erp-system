'use server'

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { createNotification } from '@/utils/notifications';
import { recordAuditLog } from '@/utils/audit';
import { requireCapability } from '@/lib/auth/permissions';
import { sendPrPendingApprovalEmail } from '@/lib/email/pr-pending-approval';
import { sendPrApprovedEmail } from '@/lib/email/pr-approved';

type PRLineItem = { item_code?: string; description: string; qty: number; uom?: string; unit_price: number };

interface CreatePRInput {
  project_id?: string;
  line_items: PRLineItem[];
  description?: string;
}

export async function createPurchaseRequestCore(input: CreatePRInput) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('pr.create', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { project_id, line_items, description } = input;

  const totalAmount = line_items.reduce((sum, li) => sum + (Number(li.qty) || 0) * (Number(li.unit_price) || 0), 0);
  if (totalAmount <= 0) return { error: 'Total amount must be greater than zero. Add at least one line item with a price.' };

  const { data: entity } = await supabase.from('internal_entities').select('id').limit(1).single();

  const { data: newPR, error } = await supabase.from('purchase_requests').insert({
    project_id: project_id || null,
    description: description || null,
    amount: totalAmount,
    status: 'draft',
    internal_entity_id: entity?.id || null,
    created_by: user.id,
  }).select('id, pr_number').single();

  if (error) {
    console.error('Error creating PR:', error);
    return { error: error.message };
  }

  if (line_items.length > 0) {
    const { error: liError } = await supabase.from('pr_line_items').insert(
      line_items.map((li, i) => ({
        pr_id: newPR.id,
        line_no: i + 1,
        item_code: li.item_code || '',
        description: li.description || '',
        qty: Number(li.qty) || 1,
        uom: li.uom || 'LOT',
        unit_price: Number(li.unit_price) || 0,
        amount: (Number(li.qty) || 0) * (Number(li.unit_price) || 0),
      }))
    );
    if (liError) console.error('Error inserting PR line items:', liError);
  }

  await recordAuditLog({
    entity_type: 'purchase_request',
    entity_id: newPR.id,
    action: 'CREATE',
    changes: { after: { amount: totalAmount, status: 'draft', line_items_count: line_items.length } },
    performed_by: user.id,
  });

  revalidatePath('/dashboard/purchase-requests');

  return {
    id: newPR.id,
    pr_number: newPR.pr_number,
    url: `/dashboard/purchase-requests/${newPR.id}`,
    message: `Draft PR ${newPR.pr_number} created successfully.`,
  };
}

export async function createPurchaseRequest(prevState: any, formData: FormData) {
  let lineItems: PRLineItem[] = [];

  try {
    const raw = formData.get('line_items') as string;
    if (raw) lineItems = JSON.parse(raw);
  } catch {
    return { error: 'Invalid line items data.' };
  }

  const result = await createPurchaseRequestCore({
    project_id: formData.get('project_id') as string || undefined,
    line_items: lineItems,
    description: formData.get('description') as string || undefined,
  });

  if ('error' in result) return { error: result.error };
  redirect(result.url);
}

export async function updatePurchaseRequestAction(prevState: any, formData: FormData) {
  const prId = formData.get('pr_id') as string;
  if (!prId) return { error: 'Purchase request not found.' };

  const result = await updatePurchaseRequest(prId, formData);
  if ('error' in result) return { error: result.error };
  redirect(`/dashboard/purchase-requests/${prId}`);
}

export async function updatePurchaseRequest(prId: string, formData: FormData) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('pr.create', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: pr } = await supabase.from('purchase_requests').select('status').eq('id', prId).single();
  if (pr?.status !== 'draft') return { error: 'Only draft PRs can be edited.' };

  let lineItems: PRLineItem[] = [];
  try {
    const raw = formData.get('line_items') as string;
    if (raw) lineItems = JSON.parse(raw);
  } catch {
    return { error: 'Invalid line items data.' };
  }

  const totalAmount = lineItems.reduce((sum, li) => sum + (Number(li.qty) || 0) * (Number(li.unit_price) || 0), 0);
  if (totalAmount <= 0) return { error: 'Total amount must be greater than zero. Add at least one line item with a price.' };

  const now = new Date().toISOString();
  const { error, count } = await supabase
    .from('purchase_requests')
    .update({
      description: (formData.get('description') as string) || null,
      project_id: (formData.get('project_id') as string) || null,
      amount: totalAmount,
      updated_at: now,
    }, { count: 'exact' })
    .eq('id', prId)
    .eq('status', 'draft');
  if (error) return { error: error.message };
  if (count === 0) return { error: 'Only draft PRs can be edited.' };

  // Replace line items (draft-only, so a wholesale swap is safe)
  await supabase.from('pr_line_items').delete().eq('pr_id', prId);
  const { error: liError } = await supabase.from('pr_line_items').insert(
    lineItems.map((li, i) => ({
      pr_id: prId,
      line_no: i + 1,
      item_code: li.item_code || '',
      description: li.description || '',
      qty: Number(li.qty) || 1,
      uom: li.uom || 'LOT',
      unit_price: Number(li.unit_price) || 0,
      amount: (Number(li.qty) || 0) * (Number(li.unit_price) || 0),
    }))
  );
  if (liError) return { error: liError.message };

  await recordAuditLog({
    entity_type: 'purchase_request',
    entity_id: prId,
    action: 'UPDATE',
    changes: { after: { amount: totalAmount, line_items_count: lineItems.length } },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-requests/${prId}`);
  revalidatePath('/dashboard/purchase-requests');
  return { success: true };
}

export async function submitPRForApproval(prId: string, approverIds: string[] = []) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('pr.status', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: pr } = await supabase
    .from('purchase_requests')
    .select('status')
    .eq('id', prId)
    .single();

  if (pr?.status !== 'draft') {
    return { error: 'Only draft PRs can be submitted for approval.' };
  }

  // Same 4-eyes validation as POs: at least one approver, all admins/superadmins,
  // never the submitter.
  const uniqueApproverIds = [...new Set(approverIds)].filter(Boolean);
  if (uniqueApproverIds.length === 0) {
    return { error: 'Select at least one admin or superadmin to approve this PR.' };
  }
  if (uniqueApproverIds.includes(user.id)) {
    return { error: 'You cannot select yourself as an approver.' };
  }

  const { data: approverProfiles } = await supabase
    .from('profiles')
    .select('id, role')
    .in('id', uniqueApproverIds);

  const validApproverIds = (approverProfiles || [])
    .filter((p) => p.role === 'superadmin' || p.role === 'admin')
    .map((p) => p.id);

  if (validApproverIds.length !== uniqueApproverIds.length) {
    return { error: 'Every selected approver must be an admin or superadmin.' };
  }

  const { error, count } = await supabase
    .from('purchase_requests')
    .update({
      status: 'pending_approval',
      submitted_for_approval_by: user.id,
      submitted_for_approval_at: new Date().toISOString(),
      approval_requested_from: uniqueApproverIds,
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    }, { count: 'exact' })
    .eq('id', prId)
    .eq('status', 'draft');

  if (error) return { error: error.message };
  if (count === 0) return { error: 'Only draft PRs can be submitted for approval.' };

  await recordAuditLog({
    entity_type: 'purchase_request',
    entity_id: prId,
    action: 'UPDATE',
    changes: { after: { status: 'pending_approval', submitted_by: user.id, approval_requested_from: uniqueApproverIds } },
    performed_by: user.id,
  });

  await createNotification({
    type: 'pr',
    title: '📋 PR Awaiting Approval',
    message: 'A purchase request has been submitted and requires approval before it can be converted to a PO.',
    link: `/dashboard/purchase-requests/${prId}`,
    created_by: user.id,
  });

  // Best-effort: a failed send must NOT fail the submit (mirrors submitPOForApproval).
  const emailResult = await sendPrPendingApprovalEmail(prId, { actorId: user.id });
  if (emailResult.status === 'failed') {
    await createNotification({
      type: 'pr',
      title: '⚠️ Approval email not sent',
      message: `A PR was submitted for approval but the notification email to the selected approvers could not be sent. ${emailResult.error ?? ''}`.trim(),
      link: `/dashboard/purchase-requests/${prId}`,
      created_by: user.id,
    });
  }

  revalidatePath(`/dashboard/purchase-requests/${prId}`);
  revalidatePath('/dashboard/purchase-requests');
  return { success: true };
}

export async function approvePR(prId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('pr.approve', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: pr } = await supabase
    .from('purchase_requests')
    .select('status, submitted_for_approval_by')
    .eq('id', prId)
    .single();

  if (pr?.status !== 'pending_approval') {
    return { error: 'This PR is not pending approval.' };
  }

  if (pr.submitted_for_approval_by === user.id) {
    return { error: 'You cannot approve a PR you submitted for approval. Another admin or superadmin must approve it.' };
  }

  const now = new Date().toISOString();
  const { error, count } = await supabase
    .from('purchase_requests')
    .update({ status: 'approved', approved_by_user_id: user.id, approved_at: now, updated_at: now }, { count: 'exact' })
    .eq('id', prId)
    .eq('status', 'pending_approval');

  if (error) return { error: error.message };
  if (count === 0) return { error: 'This PR is not pending approval.' };

  await recordAuditLog({
    entity_type: 'purchase_request',
    entity_id: prId,
    action: 'UPDATE',
    changes: { after: { status: 'approved', approved_by_user_id: user.id } },
    performed_by: user.id,
  });

  await createNotification({
    type: 'pr',
    title: '✅ PR Approved',
    message: 'A purchase request was approved and is ready to be converted into a purchase order.',
    link: `/dashboard/purchase-requests/${prId}`,
    created_by: user.id,
  });

  // Best-effort: notify procurement. A failed send never blocks approval.
  const emailResult = await sendPrApprovedEmail(prId, { actorId: user.id });
  let emailWarning: string | undefined;
  if (emailResult.status === 'failed') {
    emailWarning = emailResult.error || 'The PR was approved but the procurement email could not be sent.';
    await createNotification({
      type: 'pr',
      title: '⚠️ Procurement email not sent',
      message: `${emailWarning} Open the PR to convert it manually.`,
      link: `/dashboard/purchase-requests/${prId}`,
      created_by: user.id,
    });
  }

  revalidatePath(`/dashboard/purchase-requests/${prId}`);
  revalidatePath('/dashboard/purchase-requests');
  return { success: true, emailWarning };
}

export async function rejectPR(prId: string, reason: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('pr.approve', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  if (!reason?.trim()) return { error: 'A rejection reason is required.' };

  const { data: pr } = await supabase
    .from('purchase_requests')
    .select('status')
    .eq('id', prId)
    .single();

  if (pr?.status !== 'pending_approval') {
    return { error: 'This PR is not pending approval.' };
  }

  // Mirrors rejectPO: back to draft so the requester can edit and resubmit.
  const { error, count } = await supabase
    .from('purchase_requests')
    .update({
      status: 'draft',
      rejection_reason: reason.trim(),
      updated_at: new Date().toISOString(),
    }, { count: 'exact' })
    .eq('id', prId)
    .eq('status', 'pending_approval');

  if (error) return { error: error.message };
  if (count === 0) return { error: 'This PR is not pending approval.' };

  await recordAuditLog({
    entity_type: 'purchase_request',
    entity_id: prId,
    action: 'UPDATE',
    changes: { after: { status: 'draft', rejected_by: user.id, rejection_reason: reason.trim() } },
    performed_by: user.id,
  });

  await createNotification({
    type: 'pr',
    title: '❌ PR Approval Rejected',
    message: `The purchase request was sent back to draft. Reason: ${reason.trim()}`,
    link: `/dashboard/purchase-requests/${prId}`,
    created_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-requests/${prId}`);
  revalidatePath('/dashboard/purchase-requests');
  return { success: true };
}

export async function cancelPurchaseRequest(prId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('pr.create', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized' };

  const { data: pr } = await supabase
    .from('purchase_requests')
    .select('status, created_by')
    .eq('id', prId)
    .single();

  if (!pr) return { error: 'Purchase request not found.' };
  if (pr.status === 'converted') return { error: 'A converted PR cannot be cancelled.' };
  if (pr.status === 'cancelled') return { success: true }; // idempotent double-click
  if (pr.created_by !== user.id) return { error: 'Only the requester can cancel this PR.' };

  const { error, count } = await supabase
    .from('purchase_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', prId)
    .in('status', ['draft', 'pending_approval', 'approved']);

  if (error) return { error: error.message };
  if (count === 0) return { error: 'A converted PR cannot be cancelled.' };

  await recordAuditLog({
    entity_type: 'purchase_request',
    entity_id: prId,
    action: 'UPDATE',
    changes: { after: { status: 'cancelled' } },
    performed_by: user.id,
  });

  revalidatePath(`/dashboard/purchase-requests/${prId}`);
  revalidatePath('/dashboard/purchase-requests');
  return { success: true };
}

export async function deletePurchaseRequest(prId: string) {
  const supabase = await createClient();
  const { user, error: authError } = await requireCapability('pr.delete', supabase);
  if (authError || !user) return { error: authError || 'Unauthorized.' };

  const { data: pr } = await supabase
    .from('purchase_requests')
    .select('status')
    .eq('id', prId)
    .single();

  if (pr?.status !== 'draft') return { error: 'Only draft PRs can be deleted.' };

  const { error } = await supabase
    .from('purchase_requests')
    .delete()
    .eq('id', prId);

  if (error) return { error: error.message };

  await recordAuditLog({
    entity_type: 'purchase_request',
    entity_id: prId,
    action: 'DELETE',
    performed_by: user.id
  });

  revalidatePath('/dashboard/purchase-requests');
  return { success: true };
}
