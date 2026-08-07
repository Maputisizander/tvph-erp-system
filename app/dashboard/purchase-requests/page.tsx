import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { Plus, FileText, Clock, CheckCircle2, XCircle, RefreshCw, Wallet, type LucideIcon } from 'lucide-react';
import { Suspense } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { StatusSelect } from '@/components/ui/status-select';
import { Pagination } from '@/components/ui/pagination';
import { parsePage, pageRange } from '@/components/ui/pagination-utils';
import { ExportDropdown } from '@/components/dashboard/export-dropdown';

const PR_PAGE_SIZE = 8;
import { LiveListRefresh } from '@/components/dashboard/shared/live-list-refresh';
import { PrTableRow } from '@/components/dashboard/purchase-requests/pr-table-row';
import { PrDeleteRowButton } from '@/components/dashboard/purchase-requests/pr-cancel-button';
import { getCurrentProfile, hasCapability } from '@/lib/auth/permissions';

export const unstable_instant = {
  prefetch: 'static',
  samples: [{ searchParams: { q: null, status: null, vendor: null, project: null, page: null } }]
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-400 text-center text-white border-slate-200 dark:bg-slate-800 dark:text-slate-400',
  pending_approval: 'bg-amber-400 text-white text-center border-none dark:bg-amber-900/20 dark:text-amber-400',
  pending_finance: 'bg-violet-400 text-white border-none dark:bg-violet-900/20 dark:text-violet-400',
  approved: 'bg-blue-400 text-white border-none dark:bg-blue-900/20 dark:text-blue-400',
  converted: 'bg-emerald-400 text-white border-none dark:bg-emerald-900/20 dark:text-emerald-400',
  cancelled: 'bg-red-400 text-white border-none dark:bg-slate-800 dark:text-slate-500',
};

const STATUS_ICON: Record<string, LucideIcon> = {
  draft: FileText,
  pending_approval: Clock,
  pending_finance: Wallet,
  approved: CheckCircle2,
  converted: RefreshCw,
  cancelled: XCircle,
};

export default function PurchaseRequestsPage(props: {
  searchParams?: Promise<{ q?: string; status?: string; vendor?: string; project?: string; page?: string }>
}) {
  return (
    <Suspense fallback={<PurchaseRequestsSkeleton />}>
      <PurchaseRequestsContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function PurchaseRequestsContent({ searchParams: searchParamsPromise }: { searchParams?: Promise<any> }) {
  const searchParams = await searchParamsPromise;
  const supabase = await createClient();
  const q = searchParams?.q || '';
  const statusFilter = searchParams?.status || 'all';
  const vendorFilter = searchParams?.vendor || 'all';
  const projectFilter = searchParams?.project || 'all';
  const page = parsePage(searchParams?.page);
  const [from, to] = pageRange(page, PR_PAGE_SIZE);

  const { role: currentRole } = await getCurrentProfile(supabase);
  const canDelete = hasCapability(currentRole, 'pr.delete');

  const [projectsResponse, vendorsResponse] = await Promise.all([
    supabase.from('projects').select('id, name').is('deleted_at', null).order('name'),
    supabase.from('vendors').select('id, name').is('deleted_at', null).order('name')
  ]);

  const projectsOptions = [
    { value: 'all', label: 'All Projects' },
    ...(projectsResponse.data?.map(p => ({ value: p.id, label: p.name })) || [])
  ];

  const vendorsOptions = [
    { value: 'all', label: 'All Vendors' },
    ...(vendorsResponse.data?.map(v => ({ value: v.id, label: v.name })) || [])
  ];

  let listQuery = supabase
    .from('purchase_requests')
    .select('id, pr_number, description, amount, dp_amount, currency, status, created_at, projects(name), vendors(name)', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (q) listQuery = listQuery.ilike('pr_number', `%${q}%`);
  if (statusFilter !== 'all') listQuery = listQuery.eq('status', statusFilter);
  if (vendorFilter !== 'all') listQuery = listQuery.eq('vendor_id', vendorFilter);
  if (projectFilter !== 'all') listQuery = listQuery.eq('project_id', projectFilter);

  const { data: prs, error, count } = await listQuery.range(from, to);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">Purchase Requests</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Request purchases and route them for approval before they become POs.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportDropdown exportBaseUrl="/api/export/purchase-requests" />
          <Link
            href="/dashboard/purchase-requests/new"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-primary/20 active:scale-95"
          >
            <Plus className="h-5 w-5" />
            New Request
          </Link>
        </div>
      </div>

      {/* Filters and List */}
      <div className="bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 bg-slate-50/50 dark:bg-[#0a0a0a]/50 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <SearchInput placeholder="Search PRs..." paramName="q" />
          </div>
          <StatusSelect
            paramName="status"
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'pending_approval', label: 'Pending Admin Approval' },
              { value: 'pending_finance', label: 'Pending Finance Approval' },
              { value: 'approved', label: 'Approved (Ready to Convert)' },
              { value: 'converted', label: 'Converted' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
          <StatusSelect
            paramName="vendor"
            options={vendorsOptions}
          />
          <StatusSelect
            paramName="project"
            options={projectsOptions}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-3 py-3 font-semibold">PR</th>
                <th className="px-3 py-3 font-semibold">Description</th>
                <th className="px-3 py-3 font-semibold">Project</th>
                <th className="px-3 py-3 font-semibold">Preferred Vendor</th>
                <th className="px-3 py-3 font-semibold">Est. Amount</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {error && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-red-500">{error.message}</td></tr>
              )}
              {!error && (prs || []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No purchase requests found.
                  </td>
                </tr>
              )}
              {(prs || []).map((pr: any) => (
                <PrTableRow key={pr.id} href={`/dashboard/purchase-requests/${pr.id}`}>
                  <td className="px-3 py-3.5">
                    <Link href={`/dashboard/purchase-requests/${pr.id}`} className="font-semibold text-primary hover:underline">
                      {pr.pr_number}
                    </Link>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {new Date(pr.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-slate-700 dark:text-slate-300 max-w-40 truncate">
                    {pr.description || 'ΓÇö'}
                  </td>
                  <td className="px-3 py-3.5 text-slate-600 dark:text-slate-400 truncate max-w-[10rem]">
                    {pr.projects?.name || 'ΓÇö'}
                  </td>
                  <td className="px-3 py-3.5 text-slate-600 dark:text-slate-400 truncate max-w-[10rem]">
                    {pr.vendors?.name || 'ΓÇö'}
                  </td>
                  <td className="px-3 py-3.5 text-slate-900 dark:text-white">
                    <div className="font-medium">
                      {pr.currency === 'USD' ? '$' : 'Γé▒'}{Number(pr.amount).toLocaleString()}
                    </div>
                    {Number(pr.dp_amount) > 0 && (
                      <span
                        className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700"
                      >
                        DP {pr.currency === 'USD' ? '$' : 'Γé▒'}{Number(pr.dp_amount).toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-bold border ${STATUS_BADGE[pr.status] || STATUS_BADGE.draft}`}>
                      {(() => {
                        const Icon = STATUS_ICON[pr.status] || FileText;
                        return <Icon className="h-3.5 w-3.5 shrink-0" />;
                      })()}
                      {pr.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <span className="inline-flex items-center justify-end gap-2">
                      {['draft', 'cancelled'].includes(pr.status) && canDelete && (
                        <PrDeleteRowButton prId={pr.id} />
                      )}
                      {pr.status === 'approved' && (
                        <Link
                          href={`/dashboard/purchase-orders/new?from_pr=${pr.id}`}
                          className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95"
                        >
                          Convert to PO
                        </Link>
                      )}
                    </span>
                  </td>
                </PrTableRow>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalCount={count ?? 0} pageSize={PR_PAGE_SIZE} />
      </div>
      <LiveListRefresh />
    </div>
  );
}

function PurchaseRequestsSkeleton() {
  return (
    <div className="p-6 lg:p-8 space-y-8 animate-pulse">
      <div className="h-10 w-64 bg-slate-100 dark:bg-slate-800/50 rounded-lg" />
      <div className="h-96 rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
    </div>
  );
}
