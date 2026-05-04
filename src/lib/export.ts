import * as XLSX from "xlsx";

export type ExportRow = Record<string, string | number | null>;

/**
 * Cells whose first character is `=`, `+`, `-`, `@`, tab or CR are
 * interpreted by Excel/LibreOffice as formulas. If the source data
 * came from an untrusted import (e.g. ingest-data CSV upload), the
 * formula could exfiltrate adjacent cells via `=HYPERLINK(...)` or,
 * on legacy Office configurations, run a local command via DDE.
 *
 * Prefix any such string with a single quote `'`, which Excel strips
 * on display but treats as a literal-text marker.
 */
function sanitizeCell(value: string | number | null): string | number | null {
  if (typeof value !== "string") return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/**
 * Triggers a browser download of an .xlsx file.
 * Must be called from a client-side event handler (not during SSR).
 */
export function exportToExcel(
  filename: string,
  headers: string[],
  rows: ExportRow[]
): void {
  // Build rows with ordered keys matching headers, sanitising formula
  // triggers in the process to prevent CSV/XLSX formula injection.
  const data = rows.map((row) => {
    const ordered: ExportRow = {};
    headers.forEach((h) => {
      ordered[h] = sanitizeCell(row[h] ?? null);
    });
    return ordered;
  });

  const ws = XLSX.utils.json_to_sheet(data, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
