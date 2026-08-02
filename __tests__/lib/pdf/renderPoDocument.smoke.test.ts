/**
 * Smoke test for the new pdfkit-based renderer.
 * Verifies a valid multi-page PDF comes out with mocked data, so pdfkit
 * actually runs (fonts, logo, page flow) without touching Supabase.
 */

import { renderPoDocument } from '@/lib/pdf/renderPoDocument';
import { fetchPoData } from '@/lib/pdf/fetchPoData';
import { createClient } from '@/utils/supabase/server';
import { writeFileSync } from 'fs';

jest.mock('@/lib/pdf/fetchPoData');
jest.mock('@/utils/supabase/server');
jest.mock('server-only', () => ({}));

const mockPo: any = {
  po_number: 'PO-2026000027',
  po_date: '22 June 2026',
  vendor_name: 'JEWELINO TECH CONSTRUCTION SERVICES',
  vendor_no: '1000026',
  vendor_contact: 'ANGELITO BARCIAL',
  vendor_address: '303 L. Dela Torre St., Mag-Asawang Sapa, Sta. Maria, Bulacan',
  vendor_tel: '+639766680860',
  vendor_fax: '-',
  downpayment_amount: 43451.1,
  payment_terms: 'Refer to the PO notes below.',
  currency: 'PHP',
  line_items: [
    {
      line_no: '0010',
      item_code: 'Services',
      description:
        'SKY Cable Coaxial Cable Full Teardown, Recovery of Pole Equipment and Accessories, 1 Las Pinas City/Municipality, 5 Nodes, 16.093 km',
      quantity: 1,
      uom: 'LOT',
      unit_price: 144837,
      amount: 144837,
    },
  ],
  terms_and_conditions: '',
  mobilization_date: '06/22/2026',
  delivery_date: '06/30/2026',
  pr_number: 'PR-2026000027',
  requisitioner: 'M Bacayo',
  site_details: [
    { sn: 1, region: 'NCR', area_city: 'Las Pinas', no_of_nodes: 5, estimated_strand_km: 16.093, node_id: '', phase: '' },
  ],
  delivery_address_note: 'Pls coordinate with Mae Bacayo mae.bacayo@telcovantage.com',
  incoterms: null,
  date_prepared: '06/22/2026',
  approved_by: ['Edardnal Giovanni C. Canicula', 'Meinardo A. Opiana', 'Teresa Grecia N. Beltran'],
  project_name: 'EXTRACTION OF COAXIAL CABLES AND POLE-EQUIPMENT',
  ref_no: 'CM-1N-2026-017',
};

describe('renderPoDocument', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchPoData as jest.Mock).mockResolvedValue(mockPo);
    (createClient as jest.Mock).mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  company_name: 'TELCOVANTAGE PHILIPPINES\nSERVICES INC.',
                  company_address:
                    'Unit 1811 North Tower, Park Triangle\nCorporate Plaza, 32nd St. cor 11th Ave, Bonifacio\nGlobal City, Taguig City 1634',
                  company_tel: '09209680070',
                },
                error: null,
              }),
          }),
        }),
      }),
    });
  });

  it('produces a valid multi-page PDF from mock PO data', async () => {
    const { buffer } = await renderPoDocument('test-po-id');

    expect(buffer.length).toBeGreaterThan(1000);
    const head = buffer.subarray(0, 5).toString('latin1');
    expect(head).toBe('%PDF-');
    const pageCount = (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
    expect(pageCount).toBeGreaterThanOrEqual(3);

    writeFileSync('scripts/tmp-rendered.pdf', buffer);
  }, 30000);
});
