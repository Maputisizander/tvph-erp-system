import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getCurrentProfile } from '@/lib/auth/permissions'

// Edit history for a PO — visible to any authenticated user who can view the
// PO details page. Deliberately NOT gated by the superadmin-only audit.read
// capability; it exposes only audit rows scoped to a single PO.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { user, error: authError } = await getCurrentProfile(supabase)
  if (authError || !user) {
    return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('id')
    .eq('id', id)
    .single()
  if (!po) {
    return NextResponse.json({ error: 'Purchase order not found.' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('audit_logs')
    .select(
      `
      id,
      action,
      entity_type,
      changes,
      created_at,
      profiles:performed_by (full_name, email)
    `,
    )
    .eq('entity_type', 'purchase_order')
    .eq('entity_id', id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
