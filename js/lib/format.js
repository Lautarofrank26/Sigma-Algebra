/**
 * format.js — formato de números y fechas en español (sin dependencias).
 */
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** 1234.5 -> "1.234,5" */
export function fmtNum(value, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Con signo explícito: +0,3 / −0,3 */
export function fmtSigned(value, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const s = fmtNum(Math.abs(value), decimals);
  if (value > 0) return `+${s}`;
  if (value < 0) return `−${s}`;
  return s;
}

/**
 * Fecha ISO (YYYY-MM-DD) -> texto según frecuencia.
 * @param {'long'|'short'} style long: "mar 2026" / "T1 2026"; short: "mar 26" / "T1 26"
 */
export function fmtDate(iso, freq = 'M', style = 'long') {
  const [y, m] = iso.split('-').map(Number);
  const yy = style === 'short' ? String(y).slice(2) : String(y);
  if (freq === 'A') return String(y);
  if (freq === 'Q') return `T${Math.floor((m - 1) / 3) + 1} ${yy}`;
  return `${MONTHS[m - 1]} ${yy}`;
}
