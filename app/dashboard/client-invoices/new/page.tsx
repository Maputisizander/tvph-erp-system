import { Suspense } from 'react';
import { NewClientInvoiceForm } from './form';

export default function NewClientInvoicePage(props: {
  searchParams?: Promise<{ client_po_id?: string; account_id?: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <NewClientInvoiceForm searchParamsPromise={props.searchParams} />
    </Suspense>
  );
}
