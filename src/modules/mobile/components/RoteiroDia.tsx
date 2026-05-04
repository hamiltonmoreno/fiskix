"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getScoreLabel, getCurrentMesAno } from "@/lib/utils";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import type { OrdemFiscal } from "../types";
import {
  MapPin,
  RefreshCw,
  ClipboardList,
  LogOut,
  AlertTriangle,
  CloudUpload,
} from "lucide-react";
import { syncPendingReports } from "../lib/sync-pending-reports";
import { useRouter } from "next/navigation";

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
  const supabase = createClient();
  const router = useRouter();
  const mesAno = getCurrentMesAno();
  const online = useOnlineStatus();

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

    // Guardar em localStorage para offline
    try {
      localStorage.setItem("fiskix_ordens", JSON.stringify(mapped));
      localStorage.setItem("fiskix_ordens_ts", Date.now().toString());
    } catch {}

    setOrdens(mapped);
  }, [zona, mesAno]);

  useEffect(() => {
    async function init() {
      setLoading(true);

      // Tentar online primeiro
      if (online) {
        await carregarOrdens();
      } else {
        // Fallback offline
        try {
          const cached = localStorage.getItem("fiskix_ordens");
          if (cached) {
            setOrdens(JSON.parse(cached));
          }
        } catch {}
      }

      setLoading(false);
    }

    init();
  }, [carregarOrdens, online]);

  // Sync pending offline reports when online
  useEffect(() => {
    if (online) {
      syncPendingReports(supabase, fiscalId).then((res) => {
        if (res.synced > 0) setSyncedCount(res.synced);
      });
    }
  }, [fiscalId, online, supabase]);

  async function handleRefresh() {
    setRefreshing(true);
    await carregarOrdens();
    setRefreshing(false);
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
            <p className="text-xs text-slate-400 mt-0.5">{nomeFiscal}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-slate-100 text-slate-600"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={handleSignOut}
              className="p-2.5 rounded-xl bg-slate-100 text-slate-600"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Contador de ordens */}
      <div className="px-4 py-3 bg-blue-700 text-white">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          <span className="font-semibold">
            {loading ? "..." : `${ordens.length} ordem(s) para hoje`}
          </span>
        </div>
        {zona && (
          <p className="text-blue-200 text-xs mt-0.5">Zona: {zona.replace(/_/g, " ")}</p>
        )}
      </div>

      {/* Lista de ordens */}
      <div className="p-4 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
            </div>
          ))
        ) : ordens.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Sem ordens para hoje</p>
            <p className="text-slate-400 text-sm mt-1">
              Toque em atualizar para verificar novamente
            </p>
          </div>
        ) : (
          ordens.map((ordem) => {
            const isCritico = ordem.score_risco >= 75;
            const regrasPontuadas = ordem.motivo.filter((r) => r.pontos > 0);

            return (
              <Link
                key={ordem.id}
                href={`/mobile/${ordem.id}`}
                className="block bg-white rounded-2xl p-4 shadow-sm active:scale-98 transition-transform"
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
                  <span
                    className={`ml-3 px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                      isCritico
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {getScoreLabel(ordem.score_risco)}
                  </span>
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

                {ordem.cliente.lat && ordem.cliente.lng && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <a
                      href={`https://maps.google.com/?q=${ordem.cliente.lat},${ordem.cliente.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 text-sm font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Abrir no Mapa
                    </a>
                  </div>
                )}
              </Link>
            );
          })
        )}
      </div>

      {/* Sync success banner */}
      {syncedCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
          <CloudUpload className="w-4 h-4 text-green-600 shrink-0" />
          <p className="text-green-700 text-sm">{syncedCount} relatório(s) offline sincronizado(s)</p>
          <button onClick={() => setSyncedCount(0)} className="ml-auto text-green-500 text-lg leading-none">×</button>
        </div>
      )}

      {/* Aviso offline */}
      {!online && (
        <div className="fixed bottom-4 left-4 right-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
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
