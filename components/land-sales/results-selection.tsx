'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  activateSelectionScope,
  togglePageSelection,
  toggleSelection,
  type ScopedSelectionState,
} from '@/lib/land-sales/row-selection';

type ResultsSelectionContextValue = ScopedSelectionState & {
  activate: (filtersKey: string) => void;
  toggleRow: (filtersKey: string, id: string) => void;
  togglePage: (filtersKey: string, pageIds: readonly string[]) => void;
  clear: (filtersKey: string) => void;
};

type ResultsSelection = {
  selectedIds: Set<string>;
  selectedCount: number;
  toggleRow: (id: string) => void;
  togglePage: (pageIds: readonly string[]) => void;
  clear: () => void;
};

const EMPTY_SELECTION = new Set<string>();
const ResultsSelectionContext = createContext<ResultsSelectionContextValue | null>(null);

/** Lives in the authenticated layout so checked rows survive `?page=` changes
 * and the results Suspense remount. Filter changes still clear the set. */
export function ResultsSelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<ScopedSelectionState>({ filtersKey: null, selectedIds: new Set() });

  const activate = useCallback((filtersKey: string) => {
    setSelection(prev => activateSelectionScope(prev, filtersKey));
  }, []);

  const toggleRow = useCallback((filtersKey: string, id: string) => {
    setSelection(prev => ({
      filtersKey,
      selectedIds: toggleSelection(prev.filtersKey === filtersKey ? prev.selectedIds : EMPTY_SELECTION, id),
    }));
  }, []);

  const togglePage = useCallback((filtersKey: string, pageIds: readonly string[]) => {
    setSelection(prev => ({
      filtersKey,
      selectedIds: togglePageSelection(prev.filtersKey === filtersKey ? prev.selectedIds : EMPTY_SELECTION, pageIds),
    }));
  }, []);

  const clear = useCallback((filtersKey: string) => {
    setSelection({ filtersKey, selectedIds: new Set() });
  }, []);

  const value = useMemo<ResultsSelectionContextValue>(() => ({
    ...selection,
    activate,
    toggleRow,
    togglePage,
    clear,
  }), [selection, activate, toggleRow, togglePage, clear]);

  return (
    <ResultsSelectionContext.Provider value={value}>
      {children}
    </ResultsSelectionContext.Provider>
  );
}

export function useResultsSelection(filtersKey: string): ResultsSelection {
  const value = useContext(ResultsSelectionContext);
  if (!value) throw new Error('useResultsSelection must be used under ResultsSelectionProvider');
  const selectedIds = value.filtersKey === filtersKey ? value.selectedIds : EMPTY_SELECTION;
  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggleRow: (id: string) => value.toggleRow(filtersKey, id),
    togglePage: (pageIds: readonly string[]) => value.togglePage(filtersKey, pageIds),
    clear: () => value.clear(filtersKey),
  };
}

/** Hides a mismatched selection synchronously, then discards it permanently so
 * returning to an earlier filter cannot resurrect stale checked records. */
export function useActivateResultsSelection(filtersKey: string) {
  const value = useContext(ResultsSelectionContext);
  const activate = value?.activate;
  useEffect(() => {
    activate?.(filtersKey);
  }, [activate, filtersKey]);
  if (!value) throw new Error('useActivateResultsSelection must be used under ResultsSelectionProvider');
}
