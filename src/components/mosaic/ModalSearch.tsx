"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { createClient } from "@/lib/supabase/client";

interface ModalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  icon: string;
  label: string;
  sublabel?: string;
  href: string;
  type: "cliente" | "alerta";
}

const QUICK_LINKS = [
  { icon: "dashboard", label: "Dashboard", href: "/dashboard" },
  { icon: "warning", label: "Alertas de Fraude", href: "/alertas" },
  { icon: "analytics", label: "Relatórios", href: "/relatorios" },
  { icon: "admin_panel_settings", label: "Motor de Scoring", href: "/admin/scoring" },
];

export function ModalSearch({ isOpen, onClose }: ModalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useLayoutEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const search = useCallback(async (q: string) => {
    const term = q.trim();
    if (!term || term.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const pattern = `%${term}%`;
      const [clientesRes, alertasRes] = await Promise.all([
        supabase
          .from("clientes")
          .select("id, nome_titular, numero_contador, subestacoes!inner(zona_bairro)")
          .or(`nome_titular.ilike.${pattern},numero_contador.ilike.${pattern}`)
          .eq("ativo", true)
          .limit(5),
        supabase
          .from("alertas_fraude")
          .select("id, score_risco, status, clientes!inner(nome_titular, numero_contador)")
          .or(`clientes.nome_titular.ilike.${pattern},clientes.numero_contador.ilike.${pattern}`)
          .in("status", ["Pendente", "Notificado_SMS", "Pendente_Inspecao"])
          .order("score_risco", { ascending: false })
          .limit(5),
      ]);

      const clienteResults: SearchResult[] = (clientesRes.data ?? []).map((c) => {
        const sub = c.subestacoes as { zona_bairro: string } | null;
        return {
          id: `c-${c.id}`,
          icon: "person",
          label: c.nome_titular,
          sublabel: `${c.numero_contador}${sub ? ` · ${sub.zona_bairro.replace(/_/g, " ")}` : ""}`,
          href: `/clientes/${c.id}`,
          type: "cliente" as const,
        };
      });

      const alertaResults: SearchResult[] = (alertasRes.data ?? []).map((a) => {
        const c = a.clientes as { nome_titular: string; numero_contador: string } | null;
        return {
          id: `a-${a.id}`,
          icon: a.score_risco >= 75 ? "error" : "warning",
          label: c?.nome_titular ?? "—",
          sublabel: `Alerta · Score ${a.score_risco} · ${a.status.replace(/_/g, " ")}`,
          href: `/alertas`,
          type: "alerta" as const,
        };
      });

      setResults([...clienteResults, ...alertaResults]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => { search(query); }, 250);
    return () => clearTimeout(timer);
  }, [query, search]);

  if (!isOpen) return null;

  const hasQuery = query.trim().length >= 2;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-gray-900/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
        <div
          className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700/60 mosaic-dropdown-enter overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-gray-200 dark:border-gray-700/60">
            <Icon name={loading ? "progress_activity" : "search"} size="sm" className={`text-gray-400 flex-shrink-0 ${loading ? "animate-spin" : ""}`} />
            <input
              ref={inputRef}
              type="search"
              placeholder="Pesquisar clientes, contadores, alertas..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full py-3.5 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none"
            />
            <button
              onClick={onClose}
              className="flex-shrink-0 text-xs text-gray-400 border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              ESC
            </button>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto mosaic-scrollbar py-2">
            {!hasQuery ? (
              <>
                <p className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  Acesso rápido
                </p>
                {QUICK_LINKS.map((item) => (
                  <button
                    key={item.href}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors text-left cursor-pointer"
                    onClick={() => { onClose(); router.push(item.href); }}
                  >
                    <Icon name={item.icon} size="sm" className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-200">{item.label}</span>
                  </button>
                ))}
              </>
            ) : results.length === 0 && !loading ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Nenhum resultado para &ldquo;{query}&rdquo;
                </p>
              </div>
            ) : (
              <>
                {results.filter((r) => r.type === "cliente").length > 0 && (
                  <>
                    <p className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                      Clientes
                    </p>
                    {results.filter((r) => r.type === "cliente").map((item) => (
                      <button
                        key={item.id}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors text-left cursor-pointer"
                        onClick={() => { onClose(); router.push(item.href); }}
                      >
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <Icon name={item.icon} size="xs" className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{item.label}</p>
                          {item.sublabel && <p className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate">{item.sublabel}</p>}
                        </div>
                      </button>
                    ))}
                  </>
                )}
                {results.filter((r) => r.type === "alerta").length > 0 && (
                  <>
                    <p className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mt-1">
                      Alertas ativos
                    </p>
                    {results.filter((r) => r.type === "alerta").map((item) => (
                      <button
                        key={item.id}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors text-left cursor-pointer"
                        onClick={() => { onClose(); router.push(item.href); }}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${item.icon === "error" ? "bg-red-100 dark:bg-red-500/20" : "bg-amber-100 dark:bg-amber-500/20"}`}>
                          <Icon name={item.icon} size="xs" className={item.icon === "error" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{item.label}</p>
                          {item.sublabel && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{item.sublabel}</p>}
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </div>

          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700/60">
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              Pesquisa em tempo real · clientes e alertas ativos
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
