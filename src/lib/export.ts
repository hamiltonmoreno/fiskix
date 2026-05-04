import ExcelJS from "exceljs";

export type ExportRow = Record<string, string | number | null>;
const MAX_EXPORT_ROWS = 50000;
// Cells whose first non-whitespace character is `=`, `+`, `-`, `@`, tab or
// CR are interpreted by Excel/LibreOffice as formulas. If the source data
// came from an untrusted import (e.g. ingest-data CSV upload), the formula
// could exfiltrate adjacent cells via `=HYPERLINK(...)` or, on legacy Office
// configurations, run a local command via DDE. Prefix any such string with
// a single quote `'`, which Excel strips on display but treats as a
// literal-text marker.
const DANGEROUS_FORMULA_PREFIX = /^[=+\-@\t\r]/;

function sanitizeCell(value: string | number | null): string | number | null {
  if (typeof value !== "string") return value;
  const trimmed = value.trimStart();
  return DANGEROUS_FORMULA_PREFIX.test(trimmed) ? `'${value}` : value;
}

/**
 * Triggers a browser download of an .xlsx file.
 * Must be called from a client-side event handler (not during SSR).
 */
export async function exportToExcel(
  filename: string,
  headers: string[],
  rows: ExportRow[]
): Promise<void> {
  if (rows.length > MAX_EXPORT_ROWS) {
    throw new Error(`Exportação excede o limite de ${MAX_EXPORT_ROWS} linhas`);
  }

  // Build rows with ordered keys matching headers, sanitising formula
  // triggers in the process to prevent CSV/XLSX formula injection.
  const data = rows.map((row) => {
    const ordered: ExportRow = {};
    headers.forEach((h) => {
      ordered[h] = sanitizeCell(row[h] ?? null);
    });
    return ordered;
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Dados");
  worksheet.addRow(headers);

  data.forEach((row) => {
    worksheet.addRow(headers.map((h) => row[h] ?? null));
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
