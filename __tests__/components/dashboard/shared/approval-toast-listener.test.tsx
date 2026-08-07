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
});
