'use client';

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Check, Copy, Trash2, Upload } from 'lucide-react';
import { Blueprint } from '@/components/ui/blueprint';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import {
  deleteTemplateAction,
  renameTemplateAction,
  uploadTemplateAction,
  type TemplateActionState,
} from '@/app/(app)/admin/database-manager/templates/actions';
import type { DocxTemplate } from '@/lib/land-sales/docx-templates';
import type { MergeTagDescriptor } from '@/lib/land-sales/merge-tags';

const updatedFormat = new Intl.DateTimeFormat('en-US', {
  month: '2-digit', day: '2-digit', year: 'numeric',
});

function StatusNote({ state }: { state: TemplateActionState }) {
  if (!state) return null;
  return (
    <p
      role="status"
      className={state.status === 'error' ? 'record-error' : undefined}
      style={{
        margin: 'var(--space-3) 0 0',
        fontSize: 13,
        color: state.status === 'error' ? undefined : 'var(--color-accent-700)',
      }}
    >
      {state.message}
    </p>
  );
}

function TemplateRow({
  template,
  onChanged,
}: {
  template: DocxTemplate;
  onChanged: (state: TemplateActionState) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(template.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    if (name.trim() === template.name) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const result = await renameTemplateAction(template.id, name);
      onChanged(result);
      if (result?.status === 'success') setEditing(false);
      else setName(template.name);
    });
  }

  function remove() {
    startTransition(async () => {
      onChanged(await deleteTemplateAction(template.id));
      setConfirmingDelete(false);
    });
  }

  return (
    <tr>
      <td style={{ width: '55%' }}>
        {editing ? (
          <input
            className="input"
            value={name}
            autoFocus
            disabled={pending}
            onChange={event => setName(event.target.value)}
            onBlur={save}
            onKeyDown={event => {
              if (event.key === 'Enter') { event.preventDefault(); save(); }
              if (event.key === 'Escape') { setName(template.name); setEditing(false); }
            }}
            aria-label={`Rename ${template.name}`}
          />
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: 0, fontWeight: 600 }}
            onClick={() => setEditing(true)}
            title="Rename"
          >
            {template.name}
          </button>
        )}
      </td>
      <td style={{ color: 'var(--color-neutral-700)' }}>
        {updatedFormat.format(new Date(template.updated_at))}
      </td>
      <td style={{ textAlign: 'right' }}>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending}
          onClick={() => setConfirmingDelete(true)}
          aria-label={`Delete ${template.name}`}
          title="Delete"
        >
          <Trash2 size={16} strokeWidth={1.5} aria-hidden />
        </button>

        <Dialog
          open={confirmingDelete}
          onClose={() => setConfirmingDelete(false)}
          title="Delete template"
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
              <Button variant="primary" disabled={pending} onClick={remove}>
                {pending ? 'Deleting…' : 'Delete'}
              </Button>
            </>
          }
        >
          <p style={{ margin: 0 }}>
            Delete “{template.name}”? Anyone mid-merge with this template selected will need to pick another.
          </p>
        </Dialog>
      </td>
    </tr>
  );
}

function TagCatalog({ tags }: { tags: MergeTagDescriptor[] }) {
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return tags;
    return tags.filter(
      tag => tag.header.toLowerCase().includes(needle) || tag.name.includes(needle),
    );
  }, [tags, query]);

  async function copy(tag: string) {
    try {
      await navigator.clipboard.writeText(tag);
      setCopied(tag);
      window.setTimeout(() => setCopied(current => (current === tag ? null : current)), 1500);
    } catch {
      // Clipboard access can be denied; the tag is selectable on screen either way.
    }
  }

  return (
    <>
      <input
        className="input"
        type="search"
        value={query}
        placeholder="Search fields — e.g. sale price, buyer, zoning"
        onChange={event => setQuery(event.target.value)}
        aria-label="Search merge tags"
        style={{ marginBottom: 'var(--space-3)' }}
      />
      <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--color-neutral-300)' }}>
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Field</th>
              <th>Merge tag</th>
              <th style={{ width: 44 }}></th>
            </tr>
          </thead>
          <tbody>
            {matches.map(tag => (
              <tr key={tag.name}>
                <td>{tag.header}</td>
                <td>
                  <code style={{ fontSize: 13 }}>{tag.tag}</code>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => copy(tag.tag)}
                    aria-label={`Copy ${tag.tag}`}
                    title="Copy"
                  >
                    {copied === tag.tag
                      ? <Check size={15} strokeWidth={1.5} aria-hidden />
                      : <Copy size={15} strokeWidth={1.5} aria-hidden />}
                  </button>
                </td>
              </tr>
            ))}
            {matches.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-neutral-600)', padding: 'var(--space-6)' }}>
                  No field matches “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function DocxTemplatesManager({
  templates,
  tags,
  loadError,
}: {
  templates: DocxTemplate[];
  tags: MergeTagDescriptor[];
  loadError?: string;
}) {
  const [uploadState, uploadAction, uploading] = useActionState(uploadTemplateAction, null);
  const [rowState, setRowState] = useState<TemplateActionState>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // The list is server-rendered and revalidated by the actions, so a successful
  // upload only needs to clear the form it came from.
  useEffect(() => {
    if (uploadState?.status === 'success') formRef.current?.reset();
  }, [uploadState]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', padding: 'var(--space-6)', background: 'var(--color-neutral-100)' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-2)' }}>
          Upload a template
        </div>
        <p style={{ fontSize: 14, color: 'var(--color-neutral-700)', margin: '0 0 var(--space-4)' }}>
          Write merge tags such as <code>{'{{ property_name }}'}</code> anywhere in a Word document —
          body text, tables, headers and footers. Save it as .docx and upload it here.
        </p>

        <form ref={formRef} action={uploadAction} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="field">
            <label htmlFor="templateName">Template name</label>
            <input
              id="templateName"
              name="name"
              className="input"
              type="text"
              required
              maxLength={80}
              placeholder="e.g. Land Comp Narrative"
              style={{ backgroundColor: 'var(--color-paper)' }}
            />
          </div>
          <div className="field">
            <label htmlFor="templateFile">Word template (.docx)</label>
            <input
              id="templateFile"
              name="template"
              type="file"
              required
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="input"
              style={{ backgroundColor: 'var(--color-paper)' }}
            />
          </div>
          <div>
            <Button type="submit" variant="primary" disabled={uploading}>
              <Upload size={16} strokeWidth={1.5} aria-hidden />
              {uploading ? 'Uploading…' : 'Save template'}
            </Button>
          </div>
        </form>
        <StatusNote state={uploadState} />
      </Blueprint>

      <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', padding: 'var(--space-6)', background: 'var(--color-bg)' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-4)' }}>
          Saved templates
        </div>
        {loadError ? (
          <p className="record-error" style={{ margin: 0 }}>{loadError}</p>
        ) : (
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr><th>Name</th><th>Updated</th><th style={{ width: 60 }}></th></tr>
            </thead>
            <tbody>
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-neutral-600)', padding: 'var(--space-6)' }}>
                    No templates yet. Upload one above to enable Merge to DOCX.
                  </td>
                </tr>
              ) : templates.map(template => (
                <TemplateRow key={template.id} template={template} onChanged={setRowState} />
              ))}
            </tbody>
          </table>
        )}
        <StatusNote state={rowState} />
      </Blueprint>

      <Blueprint elevation="sm" style={{ position: 'relative', boxSizing: 'border-box', padding: 'var(--space-6)', background: 'var(--color-bg)' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 600, color: 'var(--color-text)', marginBottom: 'var(--space-2)' }}>
          Merge tags
        </div>
        <p style={{ fontSize: 14, color: 'var(--color-neutral-700)', margin: '0 0 var(--space-4)' }}>
          Every field in the Land Sales database has a tag. Paste one into your template and it is
          replaced with that record&apos;s value; empty fields merge as nothing at all, and a tag
          that matches no field is left in place so you can spot the typo.
        </p>
        <TagCatalog tags={tags} />
      </Blueprint>
    </div>
  );
}
