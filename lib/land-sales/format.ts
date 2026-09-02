const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('en-US');
const IDENTIFIER_COLUMNS = new Set([
  'Property Zip Code',
  'Assessed Year',
  'Document Number',
  'Parcel Number 1 (Min)',
  'Parcel Number 2 (Max)',
  'PropertyID',
]);

export function formatCurrency(value: number | null | undefined): string {
  return value == null ? '—' : currency.format(value);
}

export function formatNumber(value: number | null | undefined): string {
  return value == null ? '—' : number.format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const iso = value.slice(0, 10);
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return '—';
  return `${month}/${day}/${year}`;
}

function isMoneyColumn(header: string): boolean {
  return header === 'Assessed Value'
    || header === 'Assessed Land'
    || /price|payment|balance|tax|income|expense|down payment/i.test(header);
}

/** Adds USD presentation without coercing through a number, preserving every
 * fractional digit supplied by PostgREST for per-unit prices. */
function formatPreciseCurrency(text: string): string {
  const match = text.match(/^(-?)(\d+)(\.\d+)?$/);
  if (!match) return text;
  const [, sign, integer, fraction = ''] = match;
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign ? '-' : ''}$${grouped}${fraction}`;
}

/** Formats only recognizable North American numbers. Source text outside that
 * shape survives unchanged rather than being guessed into a domestic number. */
function formatPhoneNumber(text: string): string {
  const extensionMatch = text.match(/\s*(?:ext\.?|x)\s*(\d+)$/i);
  const extension = extensionMatch?.[1];
  const base = extensionMatch?.index == null ? text : text.slice(0, extensionMatch.index);
  const digits = base.replace(/\D/g, '');
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (national.length !== 10) return text;

  const formatted = `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  const withCountryCode = digits.length === 11 ? `+1 ${formatted}` : formatted;
  return extension ? `${withCountryCode} ext. ${extension}` : withCountryCode;
}

/** Display a catalog cell by the column's Postgres type. Empty is an em dash. */
export function formatCatalogValue(header: string, value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text) && (header.includes('Date') || header === 'Sale Date')) {
    return formatDate(text);
  }
  if (header.includes('Phone')) return formatPhoneNumber(text);
  // These fields may be numeric in Postgres, but their digits identify or label
  // something rather than count it, so grouping would misrepresent them.
  if (IDENTIFIER_COLUMNS.has(header)) return text;
  if (header === 'Price Per SF Land') return formatPreciseCurrency(text);
  if (typeof value === 'number' || /^-?\d+(\.\d+)?$/.test(text)) {
    const n = typeof value === 'number' ? value : Number(text);
    if (!Number.isFinite(n)) return text;
    return isMoneyColumn(header) ? formatCurrency(n) : formatNumber(n);
  }
  return text;
}

/** Live-formats a numeric input's raw text with thousands separators as the
 * user types (e.g. "12000" -> "12,000"), used by the SF/AC filter fields. */
export function formatInputWithCommas(raw: string): string {
  let clean = raw.replace(/[^0-9.]/g, '');
  const firstDot = clean.indexOf('.');
  if (firstDot !== -1) clean = clean.slice(0, firstDot + 1) + clean.slice(firstDot + 1).replace(/\./g, '');
  const [intPart, decPart] = clean.split('.');
  const withCommas = (intPart || '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
}

export function parseFormattedNumber(formatted: string): number | undefined {
  const n = Number(formatted.replace(/,/g, ''));
  return formatted && Number.isFinite(n) ? n : undefined;
}
