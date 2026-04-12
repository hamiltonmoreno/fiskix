/**
 * Executa `fn` para cada item com no máximo `limit` chamadas simultâneas.
 * Preserva a ordem dos resultados e propaga erros sem cancelar as restantes tarefas.
 */
export async function runPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i]);
      } catch (error) {
        // Propaga o erro no slot do resultado para ser tratado pelo chamador
        results[i] = error as unknown as R;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );

  return results;
}
