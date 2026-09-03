/**
 * Money is stored as DECIMAL(14,2) and moved around as strings so it never
 * touches a float. These helpers do exact arithmetic in integer paise.
 */

export function toPaise(value: string | number): bigint {
  const s = String(value).trim();
  const neg = s.startsWith('-');
  const [whole, frac = ''] = s.replace('-', '').split('.');
  const paise =
    BigInt(whole || '0') * 100n + BigInt((frac + '00').slice(0, 2) || '0');
  return neg ? -paise : paise;
}

export function fromPaise(paise: bigint): string {
  const neg = paise < 0n;
  const abs = neg ? -paise : paise;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, '0');
  return `${neg ? '-' : ''}${whole}.${frac}`;
}

export function addMoney(a: string, b: string): string {
  return fromPaise(toPaise(a) + toPaise(b));
}

/**
 * `basePaise` * `percent` -> paise, rounded to the nearest paisa. `percent` may
 * carry up to 3 decimals (e.g. "8.333" for EPS). Shared by payroll + statutory.
 */
export function percentOfPaise(basePaise: bigint, percent: string | number): bigint {
  const milliBps = BigInt(Math.round(Number(percent) * 1000)); // percent -> 1e-3 %
  const scaled = basePaise * milliBps; // paise * (percent * 1000)
  // divide by 100_000 (100 for %, 1000 for the milli scale) with rounding
  const q = scaled / 100_000n;
  const r = scaled % 100_000n;
  return r * 2n >= 100_000n ? q + 1n : q;
}

/** Round a paise amount to the nearest whole rupee (100 paise). */
export function roundToRupeePaise(paise: bigint): bigint {
  const r = paise % 100n;
  const base = paise - r;
  return r >= 50n ? base + 100n : base;
}

/** Round a paise amount UP to the next whole rupee (ESI employee share rule). */
export function ceilToRupeePaise(paise: bigint): bigint {
  const r = paise % 100n;
  return r === 0n ? paise : paise - r + 100n;
}
