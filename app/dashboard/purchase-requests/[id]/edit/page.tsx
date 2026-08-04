import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { ArrowLeft } from 'lucide-react';
import { Suspense } from 'react';
import { redirect, notFound } from 'next/navigation';
import { CreatePRForm } from '@/components/dashboard/purchase-requests/create-pr-form';
import { REGION_NAMES, REGIONS } from '@/lib/constants/philippine-regions';

export const unstable_instant = {
  prefetch: 'static',
  samples: [{ params: { id: 'sample-pr-id' } }],
};

function EditPRSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8 animate-pulse">
      <div className="h-8 w-64 bg-muted rounded" />
      <div className="h-4 w-96 bg-muted rounded" />
      <div className="h-96 bg-muted rounded" />
    </div>
  );
}

export default function EditPurchaseRequestPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<EditPRSkeleton />}>
      <EditPurchaseRequestContent paramsPromise={props.params} />
    </Suspense>
  );
}

async function EditPurchaseRequestContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  const { id } = await paramsPromise;
  const supabase = await createClient();

  const [{ data: pr, error }, { data: projects }, { data: vendors }] = await Promise.all([
    supabase
      .from('purchase_requests')
      .select('id, pr_number, description, project_id, vendor_id, dp_amount, dp_percent, status')
      .eq('id', id)
      .is('deleted_at', null)
      .single(),
    supabase.from('projects').select('id, name').is('deleted_at', null).order('name'),
    supabase.from('vendors').select('id, name').is('deleted_at', null).order('name'),
  ]);

  if (error || !pr) notFound();
  if (pr.status !== 'draft') redirect(`/dashboard/purchase-requests/${id}`);

  const { data: lineItems } = await supabase
    .from('pr_line_items')
    .select('item_code, description, qty, uom, unit_price')
    .eq('pr_id', id)
    .order('line_no');

  const { data: siteDetails } = await supabase
    .from('pr_site_details')
    .select('region, area_city, node_id, phase, no_of_nodes, cable_length_km')
    .eq('pr_id', id)
    .order('sn');

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link
          href={`/dashboard/purchase-requests/${id}`}
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
            Edit {pr.pr_number}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Update the request details. It will need to be submitted for approval again.
          </p>
        </div>
      </div>

      <CreatePRForm
        projects={projects || []}
        vendors={vendors || []}
        regions={REGION_NAMES}
        areaByRegion={REGIONS}
        initialData={{
          id: pr.id,
          pr_number: pr.pr_number,
          description: pr.description,
          project_id: pr.project_id,
          vendor_id: pr.vendor_id,
          dp_amount: Number(pr.dp_amount) || 0,
          dp_percent: Number(pr.dp_percent) || 0,
          line_items: (lineItems || []).map((li: any) => ({
            item_code: li.item_code || '',
            description: li.description || '',
            qty: Number(li.qty) || 1,
            uom: li.uom || 'LOT',
            unit_price: Number(li.unit_price) || 0,
          })),
          site_details: (siteDetails || []).map((s: any) => ({
            region: s.region || '',
            area_city: s.area_city || '',
            node_id: s.node_id || '',
            phase: s.phase || '',
            no_of_nodes: Number(s.no_of_nodes) || 0,
            cable_length_km: Number(s.cable_length_km) || 0,
          })),
        }}
      />
    </div>
  );
}
