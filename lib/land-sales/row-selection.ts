export type KeyedRecord<T> = { record: T; key: string };
export type ScopedSelectionState = { filtersKey: string | null; selectedIds: Set<string> };

/** A different search is a different selection scope. Once activated, it
 * permanently discards the prior scope so revisiting old filters stays empty. */
export function activateSelectionScope(
  selection: ScopedSelectionState,
  filtersKey: string,
): ScopedSelectionState {
  return selection.filtersKey === filtersKey
    ? selection
    : { filtersKey, selectedIds: new Set() };
}

/** Row identity is the uuid `id`. Comp ID is not unique and must never be the key. */
export function keyedRecords<T extends { id: string }>(records: T[]): KeyedRecord<T>[] {
  return records.map(record => ({ record, key: record.id }));
}

export function toggleSelection(selected: Set<string>, key: string): Set<string> {
  const next = new Set(selected);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** Header checkbox: add or remove only this page's ids, leaving other pages alone. */
export function togglePageSelection(selected: Set<string>, pageIds: readonly string[]): Set<string> {
  const next = new Set(selected);
  const allOnPage = pageIds.length > 0 && pageIds.every(id => next.has(id));
  if (allOnPage) {
    for (const id of pageIds) next.delete(id);
  } else {
    for (const id of pageIds) next.add(id);
  }
  return next;
}

export function pageSelectionState(
  selected: Set<string>,
  pageIds: readonly string[],
): 'none' | 'some' | 'all' {
  if (pageIds.length === 0) return 'none';
  let n = 0;
  for (const id of pageIds) {
    if (selected.has(id)) n += 1;
  }
  if (n === 0) return 'none';
  if (n === pageIds.length) return 'all';
  return 'some';
}

export function selectedRecords<T>(keyed: KeyedRecord<T>[], selected: Set<string>): T[] {
  return keyed.filter(row => selected.has(row.key)).map(row => row.record);
}
