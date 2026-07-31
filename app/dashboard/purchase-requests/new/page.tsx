import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { ArrowLeft } from 'lucide-react';
import { CreatePRForm } from '@/components/dashboard/purchase-requests/create-pr-form';
import { REGION_NAMES, REGIONS } from '@/lib/constants/philippine-regions';

export default async function NewPurchaseRequestPage() {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .is('deleted_at', null)
    .order('name');

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/purchase-requests"
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">
            New Purchase Request
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Describe what you need with estimated prices. Once approved, procurement converts it into a PO.
          </p>
        </div>
      </div>

      <CreatePRForm projects={projects || []} regions={REGION_NAMES} areaByRegion={REGIONS} />
    </div>
  );
}
