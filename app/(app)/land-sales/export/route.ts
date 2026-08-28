import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { landSaleExportDeniedMessage } from '@/lib/users/roles';
import { parseExportIds } from '@/lib/land-sales/export-ids';
import { fetchLandSalesByIds } from '@/lib/land-sales/query';
import { makeCsv } from '@/lib/land-sales/csv';

export async function POST(request: Request) {
  const supabase = await createClient();
  const denied = await landSaleExportDeniedMessage(supabase);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Export selection was not readable.' }, { status: 400 });
  }

  const ids = parseExportIds(
    body && typeof body === 'object' && 'ids' in body ? (body as { ids: unknown }).ids : undefined,
  );
  if (!ids.length) {
    return NextResponse.json({ error: 'No records selected.' }, { status: 400 });
  }

  const { records, error } = await fetchLandSalesByIds(supabase, ids);
  if (error) return NextResponse.json({ error }, { status: 500 });

  const csv = makeCsv(records);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="land-sales-export.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
