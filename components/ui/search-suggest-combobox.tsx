'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { filterSuggestionOptions } from '@/lib/land-sales/search-sheet';

export function SearchSuggestCombobox({
  id,
  value,
  options,
  ariaLabel,
  onChange,
}: {
  id: string;
  value: string;
  options: readonly string[];
  ariaLabel: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const filterId = useId();
  const filtered = useMemo(
    () => filterSuggestionOptions(options, query),
    [options, query],
  );

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function openList() {
    setQuery('');
    setOpen(true);
  }

  function choose(option: string) {
    onChange(option);
    setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className={open ? 'search-suggest is-open' : 'search-suggest'}
    >
      <input
        id={id}
        className="input"
        type="text"
        value={value}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        onChange={e => onChange(e.target.value)}
        onFocus={openList}
        onClick={openList}
      />
      {open && (
        <div className="search-suggest-panel" role="presentation">
          <div className="search-suggest-filter">
            <input
              id={filterId}
              className="input"
              type="search"
              value={query}
              placeholder="Search…"
              autoComplete="off"
              aria-label="Filter options"
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <ul id={listId} className="search-suggest-list" role="listbox" aria-label={ariaLabel}>
            {filtered.map(option => (
              <li key={option} role="option" aria-selected={option === value}>
                <button type="button" onClick={() => choose(option)}>
                  {option}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="search-suggest-empty" role="presentation">
                {options.length === 0 ? 'No values in the database yet.' : 'No matching values.'}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
