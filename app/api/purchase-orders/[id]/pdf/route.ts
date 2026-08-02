import { NextRequest } from 'next/server'
import { renderPoDocument } from '@/lib/pdf/renderPoDocument'
import { getCurrentProfile } from '@/lib/auth/permissions'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error: authError } = await getCurrentProfile()
    if (authError) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { id } = await params

    const { buffer, filename } = await renderPoDocument(id)

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    console.error('PO PDF generation error:', error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to generate PDF' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
