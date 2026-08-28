import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { landSaleExportDeniedMessage } from '@/lib/users/roles';
import { parseExportIds } from '@/lib/land-sales/export-ids';
import { fetchLandSalesByIds } from '@/lib/land-sales/query';
import { DocxTemplateError, mergeDocx } from '@/lib/land-sales/docx-merge';
import { mergeValuesFromColumns } from '@/lib/land-sales/merge-tags';
import {
  DOCX_MIME_TYPE,
  DOCX_TEMPLATE_BUCKET,
  MERGE_RECORD_LIMIT,
  mergedFileName,
} from '@/lib/land-sales/docx-templates';

/** Merge to DOCX. A route handler rather than a Server Action because the
 * result is a binary download: this streams the file with its own Content-Type
 * and filename, where an action would have to base64 it through the RSC
 * payload. It mirrors the CSV export route next door, down to the id parsing
 * and the export permission gate.
 *
 * jszip needs Node APIs, so this cannot run on the edge runtime. */
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = await createClient();
  // Reachable by direct POST, so authorization is checked here, not in the UI.
  const denied = await landSaleExportDeniedMessage(supabase);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Merge selection was not readable.' }, { status: 400 });
  }

  const fields = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const templateId = typeof fields.templateId === 'string' ? fields.templateId.trim() : '';
  if (!templateId) {
    return NextResponse.json({ error: 'Choose a template to merge with.' }, { status: 400 });
  }

  const ids = parseExportIds(fields.ids);
  if (!ids.length) return NextResponse.json({ error: 'No records selected.' }, { status: 400 });
  if (ids.length > MERGE_RECORD_LIMIT) {
    return NextResponse.json(
      { error: `Merge up to ${MERGE_RECORD_LIMIT} records at a time.` },
      { status: 400 },
    );
  }

  const { data: template, error: templateError } = await supabase
    .from('docx_templates')
    .select('name, storage_path')
    .eq('id', templateId)
    .maybeSingle();

  if (templateError) {
    return NextResponse.json({ error: `Could not load the template: ${templateError.message}` }, { status: 500 });
  }
  if (!template) {
    return NextResponse.json({ error: 'That template no longer exists.' }, { status: 404 });
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from(DOCX_TEMPLATE_BUCKET)
    .download(template.storage_path as string);

  if (downloadError || !file) {
    return NextResponse.json(
      { error: `Could not open the template file: ${downloadError?.message ?? 'not found'}` },
      { status: 500 },
    );
  }

  // Re-fetched server-side and in full: the results table only holds the
  // columns the Admin left visible, and a merge must reach every field.
  const { records, error } = await fetchLandSalesByIds(supabase, ids);
  if (error) return NextResponse.json({ error }, { status: 500 });
  if (!records.length) {
    return NextResponse.json({ error: 'None of the selected records could be found.' }, { status: 404 });
  }

  try {
    const merged = await mergeDocx(
      await file.arrayBuffer(),
      records.map(record => mergeValuesFromColumns(record.columns)),
    );
    return new NextResponse(Buffer.from(merged), {
      status: 200,
      headers: {
        'Content-Type': DOCX_MIME_TYPE,
        'Content-Disposition': `attachment; filename="${mergedFileName(String(template.name), records.length)}"`,
        'Content-Length': String(merged.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (thrown) {
    if (thrown instanceof DocxTemplateError) {
      return NextResponse.json({ error: thrown.message }, { status: 422 });
    }
    const message = thrown instanceof Error ? thrown.message : 'Could not build the merged document.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
