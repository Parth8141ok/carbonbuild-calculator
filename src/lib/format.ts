/**
 * Display formatting. Calculations always run at full precision; values are
 * rounded only here, at the point of display. A fixed locale keeps server and
 * client output identical.
 */
const LOCALE = "en-US";
const formatters = new Map<string, Intl.NumberFormat>();

function formatter(minDp: number, maxDp: number): Intl.NumberFormat {
  const key = `${minDp}:${maxDp}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: minDp, maximumFractionDigits: maxDp });
    formatters.set(key, f);
  }
  return f;
}

export function formatNumber(value: number | null | undefined, maxDp = 2, minDp = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return formatter(minDp, maxDp).format(value);
}

/** Fixed number of decimals, e.g. 13,137.04. */
export function formatFixed(value: number | null | undefined, dp = 2): string {
  return formatNumber(value, dp, dp);
}

export function formatKg(value: number | null | undefined, dp = 2): string {
  return `${formatFixed(value, dp)} kg CO₂e`;
}

export function formatTonnes(kg: number | null | undefined, dp = 2): string {
  if (kg === null || kg === undefined || !Number.isFinite(kg)) return "—";
  return `${formatFixed(kg / 1000, dp)} t CO₂e`;
}

/** Formats a fraction (0–1) as a percentage. */
export function formatShare(fraction: number | null | undefined, dp = 2): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return "—";
  return `${formatFixed(fraction * 100, dp)}%`;
}

/** Compact exact-looking number for formula substitutions: up to 4 decimals, trailing zeros trimmed. */
export function fmt(value: number): string {
  return formatNumber(value, 4, 0);
}

export function round(value: number, dp = 2): number {
  const p = 10 ** dp;
  return Math.round((value + Number.EPSILON * Math.sign(value)) * p) / p;
}
