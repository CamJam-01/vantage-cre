export type KeyedRecord<T> = { record: T; key: string };

export function keyedRecords<T>(records: T[]): KeyedRecord<T>[] {
  return records.map((record, index) => ({ record, key: `row:${index}` }));
}

export function toggleSelection(selected: Set<string>, key: string): Set<string> {
  const next = new Set(selected);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

export function selectedRecords<T>(keyed: KeyedRecord<T>[], selected: Set<string>): T[] {
  return keyed.filter(row => selected.has(row.key)).map(row => row.record);
}
