/**
 * Supabase mock harness — Fiskix tests
 *
 * Helper centralizado para criar mocks consistentes do Supabase client.
 * Antes deste helper, cada ficheiro de test reimplementava a chain
 * `from().select().eq().single()` à mão — 4+ padrões diferentes nos
 * 43 ficheiros, com bugs subtis (mocks que retornavam wrong shape).
 *
 * Uso típico:
 *
 *     import { createSupabaseMock } from "./_helpers/supabase-mock";
 *
 *     const supabase = createSupabaseMock({
 *       from: {
 *         alertas_fraude: { select: { data: [{ id: "a1" }], error: null } },
 *       },
 *       auth: { user: { id: "u1" } },
 *     });
 *     vi.mock("@/lib/supabase/client", () => ({ createClient: () => supabase }));
 *
 * Para casos avançados, sobrescrever métodos específicos via `.from()`,
 * `.channel()`, `.storage` directamente após criação.
 */

import { vi, type Mock } from "vitest";

export interface QueryResult<T = unknown> {
  data: T;
  error: { message: string } | null;
  count?: number;
}

export interface TableSpec {
  /** Resultado partilhado por todos os terminators (single, maybeSingle, sem .single). */
  select?: QueryResult;
  /** Resultado específico de `.single()`. */
  single?: QueryResult;
  /** Resultado específico de `.maybeSingle()`. */
  maybeSingle?: QueryResult;
  /** Resultado de `.insert(...).select()` chain. */
  insert?: QueryResult;
  /** Resultado de `.update(...).eq()` chain. */
  update?: QueryResult;
  /** Resultado de `.delete().eq()` chain. */
  delete?: QueryResult;
}

export interface SupabaseMockSpec {
  /** Spec por nome de tabela. Use `default` para fallback. */
  from?: Record<string, TableSpec> & { default?: TableSpec };
  /** Auth `getUser()` resolve para `{ data: { user }, error: null }`. */
  auth?: { user?: { id: string; email?: string } | null };
  /** Storage upload/getPublicUrl resultados. */
  storage?: {
    upload?: QueryResult;
    publicUrl?: string;
  };
}

const defaultResult: QueryResult = { data: null, error: null };

/**
 * Cria um query builder que aceita qualquer encadeamento Supabase
 * (eq, in, gte, like, order, range, etc.) e termina em `.single()`,
 * `.maybeSingle()` ou await directo.
 *
 * Retorna `any` deliberadamente — em tests só interessa o comportamento
 * runtime; type strict aqui produz boilerplate sem valor.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildQuery(spec: TableSpec | undefined): any {
  const selectResult = spec?.select ?? defaultResult;
  const singleResult = spec?.single ?? selectResult;
  const maybeSingleResult = spec?.maybeSingle ?? selectResult;

  // Promise resolvido pelo "await query" (sem .single()).
  const thenable = {
    then: (resolve: (v: QueryResult) => unknown) => Promise.resolve(selectResult).then(resolve),
  };

  // Builder com chain methods que retornam o próprio builder.
  // single() e maybeSingle() retornam Promise (terminator).
  // Cada chain method aceita `(...args: unknown[])` para suportar todas as
  // assinaturas do Supabase client (eq(col, val), order(col, opts), etc.).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain = (..._args: any[]) => builder;
  const builder: Record<string, unknown> = {
    select: vi.fn(chain),
    eq: vi.fn(chain),
    neq: vi.fn(chain),
    in: vi.fn(chain),
    gte: vi.fn(chain),
    lte: vi.fn(chain),
    gt: vi.fn(chain),
    lt: vi.fn(chain),
    like: vi.fn(chain),
    ilike: vi.fn(chain),
    is: vi.fn(chain),
    order: vi.fn(chain),
    range: vi.fn(chain),
    limit: vi.fn(chain),
    or: vi.fn(chain),
    not: vi.fn(chain),
    contains: vi.fn(chain),
    insert: vi.fn(chain),
    update: vi.fn(chain),
    upsert: vi.fn(chain),
    delete: vi.fn(chain),
    single: vi.fn(() => Promise.resolve(singleResult)),
    maybeSingle: vi.fn(() => Promise.resolve(maybeSingleResult)),
    then: thenable.then,
  };

  return builder;
}

/** Cria mock do client Supabase. */
export function createSupabaseMock(spec: SupabaseMockSpec = {}) {
  const fromSpec = spec.from ?? {};

  const fromFn = vi.fn((table: string) => {
    const tableSpec = fromSpec[table] ?? fromSpec.default;
    return buildQuery(tableSpec);
  });

  const channelMock: Record<string, unknown> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelChain = (..._args: any[]) => channelMock;
  channelMock.on = vi.fn(channelChain);
  channelMock.subscribe = vi.fn(channelChain);
  channelMock.unsubscribe = vi.fn(channelChain);

  const storageBucket = {
    upload: vi.fn().mockResolvedValue(spec.storage?.upload ?? { data: { path: "x" }, error: null }),
    getPublicUrl: vi.fn().mockReturnValue({
      data: { publicUrl: spec.storage?.publicUrl ?? "https://cdn.example/x" },
    }),
    download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
    remove: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelFn: any = vi.fn((..._args: any[]) => channelMock);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storageFromFn: any = vi.fn((..._args: any[]) => storageBucket);

  return {
    from: fromFn,
    channel: channelFn,
    removeChannel: vi.fn(),
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: spec.auth?.user ?? null },
        error: null,
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: spec.auth?.user ? { user: spec.auth.user } : null },
        error: null,
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: spec.auth?.user ?? null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    storage: {
      from: storageFromFn,
    },
    _internal: { fromFn, channelMock, storageBucket },
  };
}

export type MockedSupabase = ReturnType<typeof createSupabaseMock>;

/** Retorna o vi.fn de uma chain method para inspecção (`expect(eq).toHaveBeenCalledWith(...)`) */
export function getSpyOnTable(supabase: MockedSupabase, table: string, method: string): Mock {
  const builder = supabase.from(table) as Record<string, Mock>;
  const fn = builder[method];
  if (!fn) throw new Error(`Mock chain method '${method}' não existe`);
  return fn;
}
