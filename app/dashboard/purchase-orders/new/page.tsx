import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { CreatePOForm } from '@/components/dashboard/purchase-orders/create-po-form';
import { getCurrentProfile } from '@/lib/auth/permissions';
import { REGION_NAMES, REGIONS } from '@/lib/constants/philippine-regions';

export default async function NewPurchaseOrderPage(props: {
  searchParams?: Promise<{ from_pr?: string }>;
}) {
  const searchParams = await props.searchParams;
  const fromPr = searchParams?.from_pr;

  // POs originate from an approved purchase request. No PR → pick one first.
  if (!fromPr) {
    redirect('/dashboard/purchase-requests?status=approved');
  }

  const supabase = await createClient();

  const { role } = await getCurrentProfile(supabase);

  // Validate the PR is convertible. If not, its detail page explains the status.
  const { data: pr } = await supabase
    .from('purchase_requests')
    .select('id, pr_number, description, project_id, status')
    .eq('id', fromPr)
    .is('deleted_at', null)
    .single();

  if (!pr) {
    redirect('/dashboard/purchase-requests?status=approved');
  }
  if (pr.status !== 'approved') {
    redirect(`/dashboard/purchase-requests/${pr.id}`);
  }

  const { data: prLineItems } = await supabase
    .from('pr_line_items')
    .select('item_code, description, qty, uom, unit_price')
    .eq('pr_id', pr.id)
    .order('line_no');

  // Fetch vendors with their NDA status and currency
  const { data: vendors } = await supabase
    .from('vendors')
    .select('id, name, currency, status, vendor_documents(doc_type, status)')
    .is('deleted_at', null)
    .order('name');

  // Transform to include NDA approval flag
  const vendorsWithNda = (vendors || []).map((v: any) => {
    const ndaDoc = v.vendor_documents?.find((d: any) => d.doc_type === 'signed_nda');
    return {
      id: v.id,
      name: v.name,
      currency: v.currency || 'PHP',
      status: v.status,
      nda_approved: ndaDoc?.status === 'approved',
    };
  });

  // Fetch all projects (no longer filtered by vendor — many-to-many)
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .is('deleted_at', null)
    .order('name');

  const regions = REGION_NAMES;
  const areaByRegion = REGIONS;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/dashboard/purchase-requests/${pr.id}`}
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
            Create Purchase Order
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Convert {pr.pr_number} into a PO for an active vendor.
          </p>
        </div>
      </div>

      <CreatePOForm
        vendors={vendorsWithNda}
        projects={projects || []}
        userRole={role || ''}
        purchaseRequest={{
          id: pr.id,
          pr_number: pr.pr_number,
          description: pr.description,
          project_id: pr.project_id,
          line_items: (prLineItems || []).map((li: any) => ({
            item_code: li.item_code || '',
            description: li.description || '',
            qty: Number(li.qty) || 1,
            uom: li.uom || 'LOT',
            unit_price: Number(li.unit_price) || 0,
          })),
        }}
        regions={regions}
        areaByRegion={areaByRegion}
      />
    </div>
  );
}
