import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { VendorEditForm } from '@/components/dashboard/vendors/vendor-edit-form';

export const unstable_instant = {
  prefetch: 'static',
  samples: [{
    params: { id: 'sample-id' },
  }]
};

export default function VendorEditPage(props: {
  params: Promise<{ id: string }>,
}) {
  return (
    <Suspense
      fallback={
        <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8 animate-pulse">
          <div className="h-10 w-64 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-72 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
      }
    >
      <VendorEditContent paramsPromise={props.params} />
    </Suspense>
  );
}

async function VendorEditContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>,
}) {
  const { id } = await paramsPromise;
  const supabase = await createClient();

  const { data: vendor, error } = await supabase
    .from('vendors')
    .select(
      'id, name, vendor_code, currency, address, tin, contact_person, contact_email, contact_phone, contact_fax, bank_name, bank_account_number, bank_account_name, payment_terms, notes, secondary_contacts, secondary_banking',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !vendor) {
    notFound();
  }

  return <VendorEditForm vendor={vendor} />;
}
