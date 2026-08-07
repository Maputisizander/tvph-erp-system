// Vendor (AP) invoice status vocabulary. Approval was removed, so an invoice moves
// straight from pending_payment -> partially_paid -> paid.

import { statusBadgeClasses } from '@/lib/ui/status-badge';

export const INVOICE_STATUSES = ['pending_payment', 'partially_paid', 'paid'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

const LABELS: Record<string, string> = {
  pending_payment: 'Pending Payment',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
};

export function invoiceStatusLabel(status: string): string {
  return LABELS[status] ?? status.replace(/_/g, ' ');
}

export function invoiceStatusBadgeClasses(status: string): string {
  return statusBadgeClasses(status);
}
