import * as XLSX from "xlsx";

export type ExportRow = Record<string, string | number | null>;

/**
 * Triggers a browser download of an .xlsx file.
 * Must be called from a client-side event handler (not during SSR).
 */
export function exportToExcel(
  filename: string,
  headers: string[],
  rows: ExportRow[]
): void {
  // Build rows with ordered keys matching headers
  const data = rows.map((row) => {
    const ordered: ExportRow = {};
    headers.forEach((h) => {
      ordered[h] = row[h] ?? null;
    });
    return ordered;
  });

  const ws = XLSX.utils.json_to_sheet(data, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
