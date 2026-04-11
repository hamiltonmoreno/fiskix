import ExcelJS from "exceljs";

export type ExportRow = Record<string, string | number | null>;
const MAX_EXPORT_ROWS = 50000;
const DANGEROUS_FORMULA_PREFIX = /^[=\-+@]/;

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

  const sanitizeCell = (value: string | number | null): string | number | null => {
    if (typeof value !== "string") return value;
    const trimmed = value.trimStart();
    return DANGEROUS_FORMULA_PREFIX.test(trimmed) ? `'${value}` : value;
  };

  // Build rows with ordered keys matching headers
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
