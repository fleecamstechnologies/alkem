const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

/** "12000.00" -> "₹12,000.00" */
export function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '₹0.00';
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? inr.format(n) : String(value);
}

export function dateISO(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthsAgoISO(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}
