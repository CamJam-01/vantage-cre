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
  const [year, month, day] = value.split('-');
  return `${month}/${day}/${year}`;
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
