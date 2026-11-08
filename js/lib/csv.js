/**
 * csv.js — exportación de series a CSV listo para abrir en Excel en español:
 * separador ";" , coma decimal, UTF-8 con BOM y saltos de línea de Windows.
 */

/** Número con coma decimal y hasta 6 decimales, sin ceros sobrantes */
const num = (v) => String(Number(v.toFixed(6))).replace('.', ',');

/** Texto de celda: se entrecomilla si trae separador, comillas o saltos de línea */
const text = (s) => (/[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/**
 * @param {Array<{label:string, points:Array<[string, number]>}>} columns series a exportar
 * @returns {string} contenido del CSV: una fila por fecha, una columna por serie
 */
export function seriesToCsv(columns) {
  const dates = [...new Set(columns.flatMap((c) => c.points.map((p) => p[0])))].sort();
  const maps = columns.map((c) => new Map(c.points));
  const lines = [['Fecha', ...columns.map((c) => text(c.label))].join(';')];
  for (const d of dates) {
    lines.push([d, ...maps.map((m) => (m.has(d) ? num(m.get(d)) : ''))].join(';'));
  }
  return lines.join('\r\n');
}

/** Descarga un archivo de texto desde el navegador (con BOM para que Excel lea bien los acentos) */
export function downloadCsv(filename, content) {
  const blob = new Blob(['\ufeff', content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
