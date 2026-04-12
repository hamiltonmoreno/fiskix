import { describe, it, expect, vi } from "vitest";
import { runPool } from "@/lib/concurrency";

// ── Suite ──────────────────────────────────────────────────────────────────────

describe("runPool", () => {
  it("retorna array vazio quando items está vazio", async () => {
    const fn = vi.fn();
    const result = await runPool([], 5, fn);
    expect(result).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it("processa todos os items e preserva a ordem dos resultados", async () => {
    const items = [1, 2, 3, 4, 5];
    const result = await runPool(items, 3, async (x) => x * 2);
    expect(result).toEqual([2, 4, 6, 8, 10]);
  });

  it("respeita o limite de concorrência máxima", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    await runPool([1, 2, 3, 4, 5, 6], 2, async (x) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 5));
      concurrent--;
      return x;
    });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it("não aborta o lote quando uma tarefa individual falha", async () => {
    const items = ["a", "b", "c"];
    const results = await runPool(items, 3, async (x) => {
      if (x === "b") throw new Error("falha em b");
      return x.toUpperCase();
    });

    expect(results[0]).toBe("A");
    expect(results[1]).toBeInstanceOf(Error);
    expect((results[1] as unknown as Error).message).toBe("falha em b");
    expect(results[2]).toBe("C");
  });

  it("funciona com limit maior que o número de items", async () => {
    const result = await runPool([10, 20], 100, async (x) => x + 1);
    expect(result).toEqual([11, 21]);
  });

  it("executa sequencialmente com limit=1 mantendo a ordem de invocação", async () => {
    const order: number[] = [];
    const result = await runPool([1, 2, 3], 1, async (x) => {
      order.push(x);
      return x * 10;
    });
    expect(order).toEqual([1, 2, 3]);
    expect(result).toEqual([10, 20, 30]);
  });

  it("funciona com item único", async () => {
    const result = await runPool(["único"], 5, async (x) => x.length);
    expect(result).toEqual([5]);
  });

  it("múltiplas falhas no mesmo lote são todas capturadas", async () => {
    const results = await runPool([1, 2, 3], 3, async (x) => {
      if (x !== 2) throw new Error(`erro ${x}`);
      return "ok";
    });

    expect(results[0]).toBeInstanceOf(Error);
    expect(results[1]).toBe("ok");
    expect(results[2]).toBeInstanceOf(Error);
  });
});
