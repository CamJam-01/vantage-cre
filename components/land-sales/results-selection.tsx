'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { togglePageSelection, toggleSelection } from '@/lib/land-sales/row-selection';

type ResultsSelection = {
  selectedIds: Set<string>;
  selectedCount: number;
  toggleRow: (id: string) => void;
  togglePage: (pageIds: readonly string[]) => void;
  clear: () => void;
  syncFilters: (filtersKey: string) => void;
};

const ResultsSelectionContext = createContext<ResultsSelection | null>(null);

/** Lives in the authenticated layout so checked rows survive `?page=` changes
 * and the results Suspense remount. Filter changes still clear the set. */
export function ResultsSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const filtersKeyRef = useRef<string | null>(null);

  const syncFilters = useCallback((nextKey: string) => {
    const prev = filtersKeyRef.current;
    filtersKeyRef.current = nextKey;
    if (prev !== null && prev !== nextKey) setSelectedIds(new Set());
  }, []);

  const toggleRow = useCallback((id: string) => {
    setSelectedIds(prev => toggleSelection(prev, id));
  }, []);

  const togglePage = useCallback((pageIds: readonly string[]) => {
    setSelectedIds(prev => togglePageSelection(prev, pageIds));
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const value = useMemo<ResultsSelection>(() => ({
    selectedIds,
    selectedCount: selectedIds.size,
    toggleRow,
    togglePage,
    clear,
    syncFilters,
  }), [selectedIds, toggleRow, togglePage, clear, syncFilters]);

  return (
    <ResultsSelectionContext.Provider value={value}>
      {children}
    </ResultsSelectionContext.Provider>
  );
}

export function useResultsSelection(): ResultsSelection {
  const value = useContext(ResultsSelectionContext);
  if (!value) throw new Error('useResultsSelection must be used under ResultsSelectionProvider');
  return value;
}
