/**
 * Unit tests for the sendPOForSignature server action.
 *
 * sendPOForSignature moves an issued PO into the transient 'pending_signature'
 * (out for signature) state, stamps sent_at, mints a portal magic link, and
 * emails the vendor. It must reject non-issued POs and never fire when the
 * caller lacks the email.send capability.
 */

import { sendPOForSignature } from '@/app/dashboard/purchase-orders/actions';

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/auth/permissions', () => ({
  requireCapability: jest.fn(),
}));

jest.mock('@/utils/audit', () => ({
  recordAuditLog: jest.fn(),
}));

jest.mock('@/utils/notifications', () => ({
  createNotification: jest.fn(),
}));

jest.mock('@/lib/email/po', () => ({
  sendPoForSignatureEmail: jest.fn(),
}));

jest.mock('@/lib/portal/links', () => ({
  createPortalLink: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

import { createClient } from '@/utils/supabase/server';
import { requireCapability } from '@/lib/auth/permissions';
import { recordAuditLog } from '@/utils/audit';
import { createNotification } from '@/utils/notifications';
import { sendPoForSignatureEmail } from '@/lib/email/po';
import { createPortalLink } from '@/lib/portal/links';
import { revalidatePath } from 'next/cache';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockRequireCapability = requireCapability as jest.MockedFunction<typeof requireCapability>;
const mockRecordAuditLog = recordAuditLog as jest.MockedFunction<typeof recordAuditLog>;
const mockCreateNotification = createNotification as jest.MockedFunction<typeof createNotification>;
const mockSendPoForSignatureEmail = sendPoForSignatureEmail as jest.MockedFunction<typeof sendPoForSignatureEmail>;
const mockCreatePortalLink = createPortalLink as jest.MockedFunction<typeof createPortalLink>;
const mockRevalidatePath = revalidatePath as jest.MockedFunction<typeof revalidatePath>;

describe('sendPOForSignature', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { status: 'issued' }, error: null }) }),
        }),
        update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null, count: 1 }) }),
      }),
    };

    mockCreateClient.mockResolvedValue(mockSupabase);
    mockRequireCapability.mockResolvedValue({
      user: { id: 'user-123' },
      role: 'admin',
      error: null,
    });
    mockRecordAuditLog.mockResolvedValue(undefined);
    mockCreateNotification.mockResolvedValue(undefined);
    mockSendPoForSignatureEmail.mockResolvedValue({ status: 'sent' });
    mockCreatePortalLink.mockResolvedValue({
      portalUrl: 'https://erp.telcovantage.com/portal/po/tok123',
      token: 'tok123',
      expiresAt: '2026-08-16T00:00:00.000Z',
    });
    mockRevalidatePath.mockReturnValue(undefined);
  });

  it('rejects when the caller lacks email.send', async () => {
    mockRequireCapability.mockResolvedValue({ user: null, role: null, error: 'Unauthorized' });

    const result = await sendPOForSignature('po-123');

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(mockCreatePortalLink).not.toHaveBeenCalled();
  });

  it('rejects when the PO is not issued or pending_signature', async () => {
    mockSupabase.from().select().eq().single.mockResolvedValue({
      data: { status: 'draft' },
      error: null,
    });

    const result = await sendPOForSignature('po-123');

    expect(result).toEqual({
      error: 'Signature requests can only be sent for issued purchase orders.',
    });
    expect(mockCreatePortalLink).not.toHaveBeenCalled();
  });

  it('moves an issued PO to pending_signature, mints the link, and emails the vendor', async () => {
    const result = await sendPOForSignature('po-123');

    const updateCall = mockSupabase.from().update.mock.calls[0];
    expect(updateCall[0].status).toBe('pending_signature');
    expect(typeof updateCall[0].sent_at).toBe('string');

    expect(mockCreatePortalLink).toHaveBeenCalledWith('po', 'po-123', 7, 'po');
    expect(mockSendPoForSignatureEmail).toHaveBeenCalledWith(
      'po-123',
      expect.objectContaining({ signUrl: 'https://erp.telcovantage.com/portal/po/tok123' }),
    );
    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'purchase_order',
        entity_id: 'po-123',
        action: 'UPDATE',
      }),
    );
    expect(mockRevalidatePath).toHaveBeenCalled();
    expect(result).toEqual({ success: true, emailWarning: undefined });
  });

  it('allows re-sign (status already pending_signature)', async () => {
    mockSupabase.from().select().eq().single.mockResolvedValue({
      data: { status: 'pending_signature' },
      error: null,
    });

    const result = await sendPOForSignature('po-123');

    expect(result.success).toBe(true);
    expect(mockCreatePortalLink).toHaveBeenCalledTimes(1);
  });

  it('flags a warning when the email fails but still records the signature request', async () => {
    mockSendPoForSignatureEmail.mockResolvedValue({ status: 'failed', error: 'SMTP down' });

    const result = await sendPOForSignature('po-123');

    expect(result.success).toBe(true);
    expect(result.emailWarning).toBeTruthy();
    expect(mockCreateNotification).toHaveBeenCalled();
  });
});
