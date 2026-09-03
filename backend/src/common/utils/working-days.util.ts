/**
 * Calendar helpers for attendance / payroll. All dates are 'YYYY-MM-DD' strings
 * handled in UTC to avoid timezone drift.
 */

/** 0 = Sunday … 6 = Saturday. Default week-off = Sat + Sun; override via env. */
export function weekOffDays(): Set<number> {
  const raw = process.env.WEEK_OFF_DAYS;
  if (!raw) return new Set([0, 6]);
  return new Set(
    raw
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
  );
}

/**
 * Coerce a 'YYYY-MM-DD' string to a real calendar date, clamping a day that
 * overflows its month (e.g. '2026-09-31' -> '2026-09-30'). Returns undefined
 * if the shape is not YYYY-MM-DD or the month is out of range. Guards raw
 * date-range filters against MySQL's ER_WRONG_VALUE on impossible dates.
 */
export function normalizeDateStr(s: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return undefined;
  const [, y, mo, d] = m;
  const month = Number(mo);
  if (month < 1 || month > 12 || Number(d) < 1) return undefined;
  const last = new Date(Date.UTC(Number(y), month, 0)).getUTCDate();
  const day = Math.min(Number(d), last);
  return `${y}-${mo}-${String(day).padStart(2, '0')}`;
}

export function daysInMonth(periodMonth: string): number {
  const [y, m] = periodMonth.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthDateRange(periodMonth: string): { from: string; to: string } {
  const [y, m] = periodMonth.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { from: `${periodMonth}-01`, to: `${periodMonth}-${String(last).padStart(2, '0')}` };
}

/** Every 'YYYY-MM-DD' from `from` to `to` inclusive. */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export function isWeekOff(date: string, offDays = weekOffDays()): boolean {
  return offDays.has(new Date(`${date}T00:00:00Z`).getUTCDay());
}

/**
 * Count working days in [from, to] — excludes week-off days and any date in
 * `holidays`.
 */
export function countWorkingDays(
  from: string,
  to: string,
  holidays: Set<string> = new Set(),
): number {
  const offDays = weekOffDays();
  return eachDate(from, to).filter(
    (d) => !offDays.has(new Date(`${d}T00:00:00Z`).getUTCDay()) && !holidays.has(d),
  ).length;
}
