"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X, MapPin, Phone, Hash, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ClienteFichaSheet } from "./_components/ClienteFichaSheet";

interface Profile {
  role: string;
  nome_completo: string;
  id_zona: string | null;
}

interface ClienteRow {
  id: string;
  numero_contador: string;
  nome_titular: string;
  morada: string;
  tipo_tarifa: string;
  telemovel: string | null;
  subestacoes: { nome: string; zona_bairro: string };
}

const PAGE_SIZE = 25;

export function ClientesClient({ profile }: { profile: Profile }) {
  const supabase = useMemo(() => createClient(), []);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ClienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const debounce = setTimeout(async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("clientes")
          .select("id, numero_contador, nome_titular, morada, tipo_tarifa, telemovel, subestacoes!inner(nome, zona_bairro)")
          .limit(PAGE_SIZE);

        if (search.trim()) {
          const term = `%${search.trim()}%`;
          query = query.or(`nome_titular.ilike.${term},numero_contador.ilike.${term},morada.ilike.${term}`);
        }

        const { data } = await query;
        setResults((data ?? []) as unknown as ClienteRow[]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(debounce);
  }, [search, supabase]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      <div className="sm:flex sm:justify-between sm:items-center mb-8">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
            Clientes
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Ficha 360º · histórico de consumo, alertas e inspeções por cliente
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, contador ou morada..."
            className="w-full pl-10 pr-10 py-2.5 border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Limpar pesquisa"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 mosaic-card-hover overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 dark:text-gray-400 text-sm">A carregar…</div>
        ) : results.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-gray-400 text-sm">
            {search ? "Sem resultados para a pesquisa." : "Comece a escrever para pesquisar clientes."}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-gray-700/40">
            {results.map((c) => (
              <li
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="p-4 sm:p-5 flex items-start gap-4 hover:bg-blue-50/40 dark:hover:bg-gray-700/40 transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-semibold text-sm shrink-0">
                  {c.nome_titular.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-gray-100 truncate">
                    {c.nome_titular}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1 font-mono"><Hash className="w-3 h-3" />{c.numero_contador}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{c.subestacoes.zona_bairro.replace(/_/g, " ")}</span>
                    <span className="inline-flex items-center gap-1"><Tag className="w-3 h-3" />{c.tipo_tarifa}</span>
                    {c.telemovel && (
                      <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{c.telemovel}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5 truncate">{c.morada}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ClienteFichaSheet
        clienteId={selectedId}
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
