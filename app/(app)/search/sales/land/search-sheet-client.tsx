'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';
import {
  compactDraftFilters,
  emptyDraftFilter,
  type DraftFieldFilter,
} from '@/lib/land-sales/field-filters';
import type { RecordDisplayPage } from '@/lib/land-sales/field-visibility';
import { encodeFilters, type LandSaleFilters } from '@/lib/land-sales/search-params';
import {
  draftsFromSearchFilters,
  filtersFromSearchSheet,
  isSearchSuggestionColumn,
  reconcileDependentDrafts,
  searchSheetColumns,
  suggestionOptionsForColumn,
  suggestionParentValues,
  type SearchSuggestionDependencies,
  type SearchSuggestions,
} from '@/lib/land-sales/search-sheet';
import type { SalesPath } from '@/lib/land-sales/sales-path';
import { SearchSuggestCombobox } from '@/components/ui/search-suggest-combobox';

function filterControlId(column: string, suffix?: string): string {
  const base = `search-${column.replaceAll(/[^a-zA-Z0-9]+/g, '-')}`;
  return suffix ? `${base}-${suffix}` : base;
}

function optionsForColumn(
  column: string,
  drafts: DraftFieldFilter[],
  suggestions: SearchSuggestions,
  dependencies: SearchSuggestionDependencies,
): string[] {
  return suggestionOptionsForColumn(
    column,
    suggestions,
    dependencies,
    suggestionParentValues(drafts),
  );
}

function SearchSheetField({
  label,
  item,
  options,
  onChange,
}: {
  label: string;
  item: DraftFieldFilter;
  options: string[];
  onChange: (next: DraftFieldFilter) => void;
}) {
  const labelFor = item.kind === 'number' || item.kind === 'date'
    ? undefined
    : filterControlId(item.column);
  return (
    <div className="record-field record-span-4">
      <label htmlFor={labelFor}>{label}</label>
      <SearchFieldControl item={item} options={options} onChange={onChange} />
    </div>
  );
}

function SearchFieldControl({
  item,
  options,
  onChange,
}: {
  item: DraftFieldFilter;
  options: string[];
  onChange: (next: DraftFieldFilter) => void;
}) {
  switch (item.kind) {
    case 'text':
      if (isSearchSuggestionColumn(item.column)) {
        return (
          <SearchSuggestCombobox
            id={filterControlId(item.column)}
            value={item.contains}
            options={options}
            ariaLabel={`${item.column} contains`}
            onChange={contains => onChange({ ...item, contains })}
          />
        );
      }
      return (
        <input
          id={filterControlId(item.column)}
          className="input"
          type="text"
          value={item.contains}
          onChange={e => onChange({ ...item, contains: e.target.value })}
          aria-label={`${item.column} contains`}
        />
      );
    case 'number':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <input
            id={filterControlId(item.column, 'min')}
            className="input"
            type="text"
            inputMode="decimal"
            placeholder="Min"
            value={item.min}
            onChange={e => onChange({ ...item, min: e.target.value })}
            aria-label={`${item.column} minimum`}
          />
          <input
            id={filterControlId(item.column, 'max')}
            className="input"
            type="text"
            inputMode="decimal"
            placeholder="Max"
            value={item.max}
            onChange={e => onChange({ ...item, max: e.target.value })}
            aria-label={`${item.column} maximum`}
          />
        </div>
      );
    case 'date':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <input
            id={filterControlId(item.column, 'from')}
            className="input"
            type="date"
            value={item.from}
            onChange={e => onChange({ ...item, from: e.target.value })}
            aria-label={`${item.column} from`}
          />
          <input
            id={filterControlId(item.column, 'to')}
            className="input"
            type="date"
            value={item.to}
            onChange={e => onChange({ ...item, to: e.target.value })}
            aria-label={`${item.column} to`}
          />
        </div>
      );
    case 'boolean':
      return (
        <select
          id={filterControlId(item.column)}
          className="input"
          value={item.value}
          onChange={e => {
            const value = e.target.value;
            onChange({
              ...item,
              value: value === 'true' || value === 'false' ? value : '',
            });
          }}
          aria-label={`${item.column} is`}
          style={{ cursor: 'pointer' }}
        >
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    default: {
      const _exhaustive: never = item;
      return _exhaustive;
    }
  }
}

export function LandSalesSearchSheetClient({
  path,
  pages,
  initial,
  suggestions,
  suggestionDependencies,
}: {
  path: SalesPath;
  pages: RecordDisplayPage[];
  initial: LandSaleFilters;
  suggestions: SearchSuggestions;
  suggestionDependencies: SearchSuggestionDependencies;
}) {
  const router = useRouter();
  const columns = searchSheetColumns(pages);
  const tabbedPages = pages.filter(page => page.title !== null);
  const [activePage, setActivePage] = useState(tabbedPages[0]?.id ?? pages[0]?.id ?? '');
  const [drafts, setDrafts] = useState<DraftFieldFilter[]>(() =>
    reconcileDependentDrafts(
      draftsFromSearchFilters(initial, columns),
      suggestions,
      suggestionDependencies,
    ),
  );

  const draftByColumn = new Map(drafts.map(draft => [draft.column, draft]));

  function replaceDraft(next: DraftFieldFilter) {
    setDrafts(prev => {
      const replaced = prev.map(item => (item.column === next.column ? next : item));
      return reconcileDependentDrafts(replaced, suggestions, suggestionDependencies);
    });
  }

  function handleSearch() {
    const filters = filtersFromSearchSheet(compactDraftFilters(drafts));
    const params = encodeFilters(filters).toString();
    router.push(params ? `${path.basePath}?${params}` : path.basePath);
  }

  return (
    <>
      <div className="record-bar">
        <Link href="/search/sales" className="record-bar-back">
          <ArrowLeft size={14} strokeWidth={1.5} />
          Back
        </Link>
        <div />
        <div className="record-bar-actions">
          <button type="button" className="search-sheet-action" onClick={handleSearch}>
            <span>SEARCH</span>
            <Search size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <main className="record-page">
        <div className="record-col">
          <div className="record-head">
            <h1>{path.label} Search</h1>
            <p className="sub">Refine your search using the criteria below.</p>
          </div>

          {tabbedPages.length > 0 && (
            <div className="record-tabs" role="tablist" aria-label="Search pages">
              {tabbedPages.map(page => (
                <button
                  key={page.id}
                  type="button"
                  role="tab"
                  id={`search-tab-${page.id}`}
                  aria-selected={page.id === activePage}
                  aria-controls={`search-sheet-${page.id}`}
                  className="record-tab"
                  onClick={() => setActivePage(page.id)}
                >
                  {page.title}
                </button>
              ))}
            </div>
          )}

          {pages.length === 0 ? (
            <section className="record-panel">
              <p style={{ margin: 0, color: 'var(--color-neutral-700)' }}>
                No visible fields are arranged for this path yet. Search will return all records.
              </p>
            </section>
          ) : (
            pages.map(page => (
              <section
                key={page.id}
                id={`search-sheet-${page.id}`}
                role={page.title === null ? undefined : 'tabpanel'}
                aria-labelledby={page.title === null ? undefined : `search-tab-${page.id}`}
                className="record-panel"
                hidden={page.title !== null && page.id !== activePage}
              >
                {page.title !== null && (
                  <div className="record-panel-title">
                    <h2>{page.title}</h2>
                  </div>
                )}

                <div className="record-grid">
                  {page.items.map(item => (
                    item.kind === 'group' ? (
                      <div key={`group-${item.id}`} className="record-field record-field-group record-span-12">
                        {item.label}
                      </div>
                    ) : (
                      <SearchSheetField
                        key={item.column.key}
                        label={item.column.label}
                        item={draftByColumn.get(item.column.key) ?? emptyDraftFilter(item.column.key)}
                        options={optionsForColumn(
                          item.column.key,
                          drafts,
                          suggestions,
                          suggestionDependencies,
                        )}
                        onChange={replaceDraft}
                      />
                    )
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </main>
    </>
  );
}
