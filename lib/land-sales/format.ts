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
