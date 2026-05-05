"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getCurrentMesAno } from "@/lib/utils";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import type { OrdemFiscal } from "../types";
import {
  MapPin,
  RefreshCw,
  ClipboardList,
  LogOut,
  AlertTriangle,
  CloudUpload,
  ChevronRight,
} from "lucide-react";
import { syncPendingReports } from "../lib/sync-pending-reports";
import { useRouter } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreBadge } from "@/components/ui/score-badge";
import { logger } from "@/lib/observability/logger";

interface RoteiroDiaProps {
  fiscalId: string;
  zona: string | null;
  nomeFiscal: string;
}

export function RoteiroDia({ fiscalId, zona, nomeFiscal }: RoteiroDiaProps) {
  const [ordens, setOrdens] = useState<OrdemFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncedCount, setSyncedCount] = useState(0);
  const [zonaError, setZonaError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const mesAno = getCurrentMesAno();
  const isOnline = useOnlineStatus();

  const ordensPendentes = ordens.filter((o) => o.status === "Pendente_Inspecao");
  const ordensConcluidas = ordens.filter((o) => o.status !== "Pendente_Inspecao");
  const proximaOrdem = ordensPendentes[0] ?? null;
  const progressoPct = ordens.length > 0 ? (ordensConcluidas.length / ordens.length) * 100 : 0;

  const carregarOrdens = useCallback(async () => {
    // A fiscal without an assigned zone cannot see any orders (RLS would
    // return zero rows silently). Surface the misconfiguration explicitly.
    if (zona == null) {
      setZonaError(
        "A sua conta não tem zona atribuída. Contacte o administrador para receber ordens de inspeção.",
      );
      setOrdens([]);
      return;
    }
    setZonaError(null);

    setRefreshing(true);
    try {
      const query = supabase
        .from("alertas_fraude")
        .select(
          `
          id, score_risco, status, mes_ano, motivo,
          clientes!inner (
            id, numero_contador, nome_titular, morada, tipo_tarifa, telemovel, lat, lng,
            subestacoes!inner (nome, zona_bairro)
          )
          `
        )
        .eq("mes_ano", mesAno)
        .eq("status", "Pendente_Inspecao")
        // Defence-in-depth: in addition to RLS, restrict to the fiscal's zone
        // via the joined substation so a misconfigured policy can't leak rows.
        .eq("clientes.subestacoes.zona_bairro", zona)
        .order("score_risco", { ascending: false });

      const { data } = await query;

      const mapped: OrdemFiscal[] = (data ?? []).map((r) => {
        const c = r.clientes as {
          id: string;
          numero_contador: string;
          nome_titular: string;
          morada: string;
          tipo_tarifa: string;
          telemovel: string | null;
          lat: number | null;
          lng: number | null;
          subestacoes: { nome: string; zona_bairro: string };
        };

        return {
          id: r.id,
          score_risco: r.score_risco,
          status: r.status,
          mes_ano: r.mes_ano,
          motivo: (r.motivo as OrdemFiscal["motivo"]) ?? [],
          cliente: {
            id: c.id,
            numero_contador: c.numero_contador,
            nome_titular: c.nome_titular,
            morada: c.morada,
            tipo_tarifa: c.tipo_tarifa,
            telemovel: c.telemovel,
            lat: c.lat,
            lng: c.lng,
          },
          subestacao: {
            nome: c.subestacoes.nome,
            zona_bairro: c.subestacoes.zona_bairro,
          },
        };
      });

      try {
        localStorage.setItem("fiskix_ordens", JSON.stringify(mapped));
        localStorage.setItem("fiskix_ordens_ts", Date.now().toString());
      } catch (err) {
        // QuotaExceeded ou private mode — fallback ao Supabase no próximo refresh
        logger({ module: "RoteiroDia" }).warn("localstorage_write_failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      setOrdens(mapped);
    } finally {
      setRefreshing(false);
    }
  }, [mesAno, supabase, zona]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        if (isOnline) {
          await carregarOrdens();
        } else {
          // Fallback offline
          try {
            const cached = localStorage.getItem("fiskix_ordens");
            if (cached) {
              setOrdens(JSON.parse(cached) as OrdemFiscal[]);
            }
          } catch (err) {
            // Cache corrupto ou inacessível — UI mostra estado vazio
            logger({ module: "RoteiroDia" }).warn("localstorage_read_failed", {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [carregarOrdens, isOnline]);

  // Sync pending offline reports when online
  useEffect(() => {
    if (isOnline) {
      syncPendingReports(supabase, fiscalId).then((res) => {
        if (res.synced > 0) setSyncedCount(res.synced);
      });
    }
  }, [fiscalId, isOnline, supabase]);

  async function handleRefresh() {
    await carregarOrdens();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="mobile-app min-h-screen" style={{ backgroundColor: "#F1F5F9", color: "#0F172A" }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-700 rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-sm">F</span>
              </div>
              <span className="font-bold text-slate-900">Fiskix</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{nomeFiscal}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Atualizar ordens"
              className="p-2.5 rounded-xl bg-slate-100 text-slate-600"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={handleSignOut}
              aria-label="Terminar sessão"
              className="p-2.5 rounded-xl bg-slate-100 text-slate-600"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Barra de progresso */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-slate-500">
            {loading ? "..." : `${ordens.length} ordem(s) para hoje`}
          </span>
          {zona && (
            <span className="text-xs text-slate-400">Zona: {zona.replace(/_/g, " ")}</span>
          )}
        </div>
        <Progress value={progressoPct} className="h-2" />
      </div>

      {/* Corpo */}
      <div className="p-4 space-y-3">
        {loading ? (
          <>
            <Skeleton className="rounded-2xl h-32" />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </>
        ) : ordens.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Sem ordens para hoje</p>
            <p className="text-slate-500 text-sm mt-1">
              Toque em atualizar para verificar novamente
            </p>
          </div>
        ) : (
          <>
            {/* Hero card — próxima ordem */}
            {proximaOrdem && (
              <div className="rounded-2xl overflow-hidden shadow-lg">
                <Link href={`/mobile/${proximaOrdem.id}`} className="block p-5 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white active:scale-98 transition-transform">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-indigo-200 text-xs font-medium uppercase tracking-wide">
                      Próxima inspeção
                    </span>
                    <ScoreBadge score={proximaOrdem.score_risco} showScore />
                  </div>
                  <p className="font-bold text-lg leading-snug mb-1">
                    {proximaOrdem.cliente.nome_titular}
                  </p>
                  <p className="text-indigo-200 text-sm mb-3">
                    {proximaOrdem.cliente.morada}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-300 text-xs">
                      <span className="font-mono">{proximaOrdem.cliente.numero_contador}</span>
                      <span>·</span>
                      <span>{proximaOrdem.subestacao.zona_bairro.replace(/_/g, " ")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {proximaOrdem.motivo.filter((r) => r.pontos > 0).slice(0, 3).map((r) => (
                        <span
                          key={r.regra}
                          className="text-xs px-1.5 py-0.5 bg-white/20 text-white rounded font-mono"
                        >
                          {r.regra}
                        </span>
                      ))}
                      <ChevronRight className="w-5 h-5 text-indigo-300 ml-1" />
                    </div>
                  </div>
                </Link>
                {proximaOrdem.cliente.lat && proximaOrdem.cliente.lng && (
                  <div className="px-5 py-3 bg-indigo-900/40 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <a
                      href={`https://maps.google.com/?q=${proximaOrdem.cliente.lat},${proximaOrdem.cliente.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-300 text-sm font-medium"
                    >
                      Abrir no Mapa
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Restantes ordens pendentes */}
            {ordensPendentes.slice(1).map((ordem) => {
              const regrasPontuadas = ordem.motivo.filter((r) => r.pontos > 0);
              return (
                <div key={ordem.id} className="bg-white rounded-2xl shadow-sm">
                  <Link
                    href={`/mobile/${ordem.id}`}
                    className="block p-4 active:scale-98 transition-transform"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 text-base">
                          {ordem.cliente.nome_titular}
                        </p>
                        <p className="text-slate-500 text-sm mt-0.5">
                          {ordem.cliente.morada}
                        </p>
                      </div>
                      <ScoreBadge score={ordem.score_risco} showScore className="ml-3 shrink-0" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-sm text-slate-400">
                        <span className="font-mono text-xs">{ordem.cliente.numero_contador}</span>
                        <span>·</span>
                        <span>{ordem.subestacao.zona_bairro.replace(/_/g, " ")}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {regrasPontuadas.slice(0, 3).map((r) => (
                          <span
                            key={r.regra}
                            className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-mono"
                          >
                            {r.regra}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                  {ordem.cliente.lat && ordem.cliente.lng && (
                    <div className="px-4 pb-4 pt-3 border-t border-slate-100 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <a
                        href={`https://maps.google.com/?q=${ordem.cliente.lat},${ordem.cliente.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 text-sm font-medium"
                      >
                        Abrir no Mapa
                      </a>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Ordens concluídas */}
            {ordensConcluidas.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 px-1">
                  Concluídas ({ordensConcluidas.length})
                </p>
                {ordensConcluidas.map((ordem) => (
                  <div key={ordem.id} className="bg-white/60 rounded-2xl p-4 opacity-60">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-slate-600 text-sm">
                        {ordem.cliente.nome_titular}
                      </p>
                      <span className="text-xs text-green-600 font-medium">✓ Concluída</span>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5 font-mono">
                      {ordem.cliente.numero_contador}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Sync success banner */}
      {syncedCount > 0 && (
        <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
          <CloudUpload className="w-4 h-4 text-green-600 shrink-0" />
          <p className="text-green-700 text-sm">{syncedCount} relatório(s) offline sincronizado(s)</p>
          <button onClick={() => setSyncedCount(0)} className="ml-auto text-green-500 text-lg leading-none">×</button>
        </div>
      )}

      {/* Aviso offline */}
      {!isOnline && (
        <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-amber-700 text-sm">Modo offline — a mostrar dados guardados</p>
        </div>
      )}

      {/* Aviso de zona não atribuída */}
      {zonaError && (
        <div className="mx-4 mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{zonaError}</p>
        </div>
      )}
    </div>
  );
}
