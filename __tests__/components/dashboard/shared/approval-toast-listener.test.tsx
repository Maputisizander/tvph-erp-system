/**
 * Unit tests for the approval-toast audience gate
 * Verifies who may see a "submitted for approval" toast for a PO/PR row.
 */

import { shouldShowApprovalToast } from '@/components/dashboard/shared/approval-toast-listener';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('sonner', () => ({ toast: { info: jest.fn() } }));
jest.mock('@/utils/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: jest.fn() }, from: jest.fn() }),
}));

const row = {
  submitted_for_approval_by: 'user-submitter',
  approval_requested_from: ['user-approver-a', 'user-approver-b'],
};

describe('shouldShowApprovalToast', () => {
  it('shows to the submitter', () => {
    expect(shouldShowApprovalToast('user-submitter', 'user', row)).toBe(true);
  });

  it('shows to a requested approver', () => {
    expect(shouldShowApprovalToast('user-approver-b', 'user', row)).toBe(true);
  });

  it('shows to every superadmin', () => {
    expect(shouldShowApprovalToast('someone-unrelated', 'superadmin', row)).toBe(true);
  });

  it('hides from unrelated regular users', () => {
    expect(shouldShowApprovalToast('someone-unrelated', 'user', row)).toBe(false);
  });

  it('handles a row without requested approvers', () => {
    expect(shouldShowApprovalToast('someone-unrelated', 'user', { submitted_for_approval_by: 'user-submitter', approval_requested_from: null })).toBe(false);
    expect(shouldShowApprovalToast('user-submitter', 'user', { submitted_for_approval_by: 'user-submitter', approval_requested_from: null })).toBe(true);
  });

  it('shows pending_finance to a finance-role user', () => {
    expect(shouldShowApprovalToast('someone-unrelated', 'finance', row, 'pending_finance')).toBe(true);
  });

  it('shows pending_finance to an explicitly requested finance approver', () => {
    const prRow = { ...row, finance_approval_requested_from: ['user-finance-a'] };
    expect(shouldShowApprovalToast('user-finance-a', 'user', prRow, 'pending_finance')).toBe(true);
  });

  it('hides pending_finance from unrelated non-finance users', () => {
    expect(shouldShowApprovalToast('someone-unrelated', 'user', { ...row, finance_approval_requested_from: ['user-finance-a'] }, 'pending_finance')).toBe(false);
  });

  it('hides terminal statuses from approvers who are not the submitter', () => {
    expect(shouldShowApprovalToast('user-approver-b', 'user', row, 'issued')).toBe(false);
    expect(shouldShowApprovalToast('user-finance-a', 'user', row, 'approved')).toBe(false);
  });

  it('still shows terminal statuses to the submitter', () => {
    expect(shouldShowApprovalToast('user-submitter', 'user', row, 'issued')).toBe(true);
    expect(shouldShowApprovalToast('user-submitter', 'user', row, 'approved')).toBe(true);
  });
});
