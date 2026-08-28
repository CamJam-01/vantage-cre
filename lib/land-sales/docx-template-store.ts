import type { SupabaseClient } from '@supabase/supabase-js';
import { DOCX_TEMPLATE_SELECT, type DocxTemplate } from './docx-templates';
import { SALES_DATABASE_KEY, type DatabaseKey } from './field-visibility';

export class DocxTemplateReadError extends Error {
  constructor(message: string) {
    super(`Could not load merge templates: ${message}`);
    this.name = 'DocxTemplateReadError';
  }
}

/** Every saved template for a database, newest name-order first so the merge
 * dialog and the admin list agree. */
export async function listDocxTemplates(
  supabase: SupabaseClient,
  databaseKey: DatabaseKey = SALES_DATABASE_KEY,
): Promise<DocxTemplate[]> {
  const { data, error } = await supabase
    .from('docx_templates')
    .select(DOCX_TEMPLATE_SELECT)
    .eq('database_key', databaseKey)
    .order('name', { ascending: true });

  if (error) throw new DocxTemplateReadError(error.message);
  return (data ?? []) as DocxTemplate[];
}
