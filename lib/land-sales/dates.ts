const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function isValidDate(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function toIso(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 2-digit year pivot: 00-69 -> 2000-2069, 70-99 -> 1970-1999. */
function fullYear(yy: number): number {
  return yy <= 69 ? 2000 + yy : 1900 + yy;
}

/**
 * Interprets a date written in any of several common spreadsheet/export
 * formats and converts it to the ISO format (YYYY-MM-DD) the database
 * stores `sale_date` in. This is the function CSV import calls whenever a
 * mapped date column doesn't already match our own format — it tries each
 * shape below in turn and returns the first one that resolves to a real
 * calendar date, or null if nothing matches.
 *
 * Recognized shapes:
 *  - ISO:              2026-06-12, 2026/06/12, 2026-06-12T00:00:00Z, 2026-06-12 00:00:00
 *  - Numeric + 4yr:     6/12/2026, 06-12-2026, 6.12.2026
 *  - Numeric + 2yr:     6/12/26, 06-12-26
 *  - Month name:        June 12, 2026 / Jun 12th 2026 / 12 June 2026 / 12-Jun-2026
 *
 * All-numeric dates are read month-first (6/12/2026 = June 12), matching US
 * CRE export conventions and this app's own template — but if that reading
 * isn't a valid calendar date (e.g. "25/12/2026"), a day-first reading is
 * tried before giving up, since day-first exports do show up occasionally.
 */
export function parseFlexibleDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ].*)?$/);
  if (iso) {
    const [, y, m, d] = iso;
    const yn = Number(y), mn = Number(m), dn = Number(d);
    return isValidDate(yn, mn, dn) ? toIso(yn, mn, dn) : null;
  }

  const numeric = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (numeric) {
    const [, a, b, yy] = numeric;
    const yn = yy.length === 2 ? fullYear(Number(yy)) : Number(yy);
    const an = Number(a), bn = Number(b);
    if (isValidDate(yn, an, bn)) return toIso(yn, an, bn); // month-first
    if (isValidDate(yn, bn, an)) return toIso(yn, bn, an); // day-first fallback
    return null;
  }

  const monthDayYear = trimmed.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
  const dayMonthYear = trimmed.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?,?\s+(\d{4})$/);
  const dashedMonth = trimmed.match(/^(\d{1,2})-([A-Za-z]+)-(\d{4})$/);
  const named = monthDayYear ?? dayMonthYear ?? dashedMonth;
  if (named) {
    const [, first, second, yearText] = named;
    const isMonthFirst = /^[A-Za-z]+$/.test(first);
    const monthText = isMonthFirst ? first : second;
    const dayText = isMonthFirst ? second : first;
    const mn = MONTH_NAMES[monthText.toLowerCase()];
    if (!mn) return null;
    const dn = Number(dayText), yn = Number(yearText);
    return isValidDate(yn, mn, dn) ? toIso(yn, mn, dn) : null;
  }

  return null;
}
