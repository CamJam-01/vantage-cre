import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { landSaleExportDeniedMessage } from '@/lib/users/roles';
import { parseExportIds } from '@/lib/land-sales/export-ids';
import { fetchLandSalesByIds } from '@/lib/land-sales/query';
import { makeCsv } from '@/lib/land-sales/csv';
import type { SalesPath } from '@/lib/land-sales/sales-path';
import { DocxTemplateError, mergeRoutedDocx, type RecordImageBytes } from '@/lib/land-sales/docx-merge';
import { mergeValuesForRecord } from '@/lib/land-sales/merge-tags';
import {
  DOCX_MIME_TYPE,
  DOCX_TEMPLATE_BUCKET,
  DOCX_TEMPLATE_SELECT,
  MERGE_RECORD_LIMIT,
  type DocxTemplate,
  mergedFileName,
} from '@/lib/land-sales/docx-templates';
import { listDocxOutputFlows } from '@/lib/land-sales/output-flow-store';
import {
  resolveOutputTemplateId,
  tableOutputFlow,
  tableOutputFlowSetupMessage,
} from '@/lib/land-sales/output-flows';
import { RECORD_IMAGE_BUCKET, recordImageContentType } from '@/lib/land-sales/record-image';
import type { SupabaseClient } from '@supabase/supabase-js';

async function loadRecordImagesBytes(
  supabase: SupabaseClient,
  images: ReadonlyArray<{ path: string; caption: string }> | undefined,
): Promise<RecordImageBytes[]> {
  if (!images?.length) return [];
  const loaded: RecordImageBytes[] = [];
  for (const image of images) {
    const { data, error } = await supabase.storage.from(RECORD_IMAGE_BUCKET).download(image.path);
    if (error || !data) continue;
    loaded.push({
      bytes: new Uint8Array(await data.arrayBuffer()),
      mimeType: recordImageContentType(image.path),
      caption: image.caption,
    });
  }
  return loaded;
}

export function makeExportPost(path: SalesPath) {
  return async function POST(request: Request) {
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

    const { records, error } = await fetchLandSalesByIds(supabase, ids, path.table);
    if (error) return NextResponse.json({ error }, { status: 500 });

    const csv = makeCsv(records, path.id);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${path.exportFilename}"`,
        'Cache-Control': 'no-store',
      },
    });
  };
}

export function makeMergePost(path: SalesPath) {
  return async function POST(request: Request) {
    const supabase = await createClient();
    const denied = await landSaleExportDeniedMessage(supabase);
    if (denied) return NextResponse.json({ error: denied }, { status: 403 });

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Print selection was not readable.' }, { status: 400 });
    }

    const fields = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const ids = parseExportIds(fields.ids);
    if (!ids.length) return NextResponse.json({ error: 'No records selected.' }, { status: 400 });
    if (ids.length > MERGE_RECORD_LIMIT) {
      return NextResponse.json(
        { error: `Print up to ${MERGE_RECORD_LIMIT} records at a time.` },
        { status: 400 },
      );
    }

    const { flowResult, recordResult } = await Promise.all([
      listDocxOutputFlows(supabase, path.databaseKey),
      fetchLandSalesByIds(supabase, ids, path.table),
    ]).then(([flows, records]) => ({ flowResult: flows, recordResult: records }))
      .catch((error: unknown) => ({
        flowResult: null,
        recordResult: { records: [], error: error instanceof Error ? error.message : 'Could not load print data.' },
      }));
    if (!flowResult) return NextResponse.json({ error: recordResult.error }, { status: 500 });
    const flow = tableOutputFlow(flowResult);
    if (!flow) {
      return NextResponse.json(
        { error: tableOutputFlowSetupMessage(flowResult.length) },
        { status: 422 },
      );
    }

    const { records, error } = recordResult;
    if (error) return NextResponse.json({ error }, { status: 500 });
    if (!records.length) {
      return NextResponse.json({ error: 'None of the selected records could be found.' }, { status: 404 });
    }

    const routedTemplateIds = records.map(record => resolveOutputTemplateId(flow, record.columns));
    const neededTemplateIds = [...new Set([flow.defaultTemplateId, ...routedTemplateIds])];
    const { data: templateRows, error: templateError } = await supabase
      .from('docx_templates')
      .select(DOCX_TEMPLATE_SELECT)
      .eq('database_key', path.databaseKey)
      .in('id', neededTemplateIds);
    if (templateError) {
      return NextResponse.json({ error: `Could not load routed templates: ${templateError.message}` }, { status: 500 });
    }

    const templates = (templateRows ?? []) as DocxTemplate[];
    const templateById = new Map(templates.map(template => [template.id, template]));
    const missingTemplateId = neededTemplateIds.find(id => !templateById.has(id));
    if (missingTemplateId) {
      return NextResponse.json(
        { error: 'This Output Flow references a template that is no longer available.' },
        { status: 422 },
      );
    }

    const downloaded = await Promise.all(neededTemplateIds.map(async templateId => {
      const template = templateById.get(templateId);
      if (!template) return { templateId, bytes: null, error: 'not found' };
      const { data: file, error: downloadError } = await supabase.storage
        .from(DOCX_TEMPLATE_BUCKET)
        .download(template.storage_path);
      return {
        templateId,
        bytes: file ? new Uint8Array(await file.arrayBuffer()) : null,
        error: downloadError?.message ?? (file ? null : 'not found'),
      };
    }));
    const failedDownload = downloaded.find(result => !result.bytes);
    if (failedDownload) {
      return NextResponse.json(
        { error: `Could not open a routed template file: ${failedDownload.error}` },
        { status: 500 },
      );
    }
    const bytesByTemplateId = new Map(downloaded.map(result => [result.templateId, result.bytes as Uint8Array]));
    const defaultTemplateBytes = bytesByTemplateId.get(flow.defaultTemplateId);
    if (!defaultTemplateBytes) {
      return NextResponse.json({ error: 'Could not open the default template.' }, { status: 500 });
    }

    const images = await Promise.all(
      records.map(record => loadRecordImagesBytes(supabase, record.recordImages)),
    );

    try {
      const merged = await mergeRoutedDocx(defaultTemplateBytes, records.map((record, index) => ({
        templateBytes: bytesByTemplateId.get(routedTemplateIds[index]) as Uint8Array,
        values: mergeValuesForRecord(record.columns, index + 1),
        images: images[index],
      })));
      return new NextResponse(Buffer.from(merged), {
        status: 200,
        headers: {
          'Content-Type': DOCX_MIME_TYPE,
          'Content-Disposition': `attachment; filename="${mergedFileName(flow.name, records.length)}"`,
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
  };
}
