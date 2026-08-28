const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('en-US');

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
  return /price|payment|balance|tax|income|expense|down payment/i.test(header);
}

/** Display a catalog cell by the column's Postgres type. Empty is an em dash. */
export function formatCatalogValue(header: string, value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text) && (header.includes('Date') || header === 'Sale Date')) {
    return formatDate(text);
  }
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
