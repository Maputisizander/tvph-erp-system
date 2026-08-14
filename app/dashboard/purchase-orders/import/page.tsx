import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { getCurrentProfile } from '@/lib/auth/permissions';
import { hasCapability } from '@/lib/auth/permissions';
import { LegacyPoImportForm } from '@/components/dashboard/purchase-orders/legacy-po-import-form';

function ImportLegacyPODraftSkeleton() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8 animate-pulse">
      <div className="h-8 w-64 bg-muted rounded" />
      <div className="h-4 w-96 bg-muted rounded" />
      <div className="h-96 bg-muted rounded" />
    </div>
  );
}

export default function ImportLegacyPOPage() {
  return (
    <Suspense fallback={<ImportLegacyPODraftSkeleton />}>
      <ImportLegacyPOContent />
    </Suspense>
  );
}

async function ImportLegacyPOContent() {
  const supabase = await createClient();
  const { role } = await getCurrentProfile(supabase);

  if (!hasCapability(role || '', 'po.create')) {
    redirect('/dashboard/purchase-orders');
  }

  const { data: vendors } = await supabase
    .from('vendors')
    .select('id, name, currency')
    .is('deleted_at', null)
    .order('name');

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/purchase-orders"
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
            Import Legacy Purchase Order
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Upload a PO issued before this ERP system. It is recorded as issued and its PDF becomes the PO document
            so an invoice can be linked.
          </p>
        </div>
      </div>

      <LegacyPoImportForm vendors={vendors || []} />
    </div>
  );
}
