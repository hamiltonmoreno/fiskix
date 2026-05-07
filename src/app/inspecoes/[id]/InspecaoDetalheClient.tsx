"use client";

import Link from "next/link";
import { ArrowLeft, Printer, MapPin, User, Clock, Camera } from "lucide-react";

type Subestacao = { nome: string; zona_bairro: string };
type Cliente = { nome_titular: string; numero_contador: string; morada: string; tipo_tarifa: string; subestacoes: Subestacao };
type Alerta = { id: string; score_risco: number; mes_ano: string; motivo: Record<string, unknown>; status: string; resultado: string; clientes: Cliente };
type Perfil = { nome_completo: string; role: string };

type Inspecao = {
  id: string;
  resultado: string;
  tipo_fraude: string | null;
  observacoes: string | null;
  foto_url: string | null;
  lat_foto: number | null;
  lng_foto: number | null;
  criado_em: string;
  alertas_fraude: Alerta;
  perfis: Perfil;
};

const CARD = "bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-5";

function scoreColor(score: number) {
  if (score >= 75) return "text-red-600 dark:text-red-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-gray-600 dark:text-gray-400";
}

function resultadoBadge(resultado: string) {
  const map: Record<string, string> = {
    Fraude_Confirmada: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    Anomalia_Tecnica: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    Sem_Anomalia: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  };
  return map[resultado] ?? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
}

export function InspecaoDetalheClient({ inspecao }: { inspecao: Inspecao }) {
  const alerta = inspecao.alertas_fraude;
  const cliente = alerta.clientes;
  const sub = cliente.subestacoes;
  const fiscal = inspecao.perfis;
  const dataFormatada = new Date(inspecao.criado_em).toLocaleDateString("pt-CV");

  const motivosAtivos = Object.entries(
    (alerta.motivo ?? {}) as Record<string, { pontos?: number; descricao?: string }>
  ).filter(([, v]) => (v?.pontos ?? 0) > 0);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 12pt; }
          .print-page { padding: 0; }
          img { max-width: 100%; page-break-inside: avoid; }
          .card-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="print-page max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Toolbar */}
        <div className="no-print flex items-center justify-between">
          <Link href="/inspecoes" className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Voltar a Inspeções
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>

        {/* Header */}
        <div className={CARD}>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{cliente.nome_titular}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Contador: {cliente.numero_contador} · {cliente.morada}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{sub.nome} — {sub.zona_bairro}</p>
          <div className="mt-3 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <User className="w-4 h-4" />
            <span>{fiscal.nome_completo}</span>
            <span className="text-gray-300 dark:text-gray-600 mx-1">·</span>
            <Clock className="w-4 h-4" />
            <span>{dataFormatada}</span>
          </div>
        </div>

        {/* KPI row */}
        <div className="card-grid grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className={CARD}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Score de Risco</p>
            <p className={`text-2xl font-bold ${scoreColor(alerta.score_risco)}`}>{alerta.score_risco}</p>
          </div>
          <div className={CARD}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Resultado</p>
            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${resultadoBadge(inspecao.resultado)}`}>
              {inspecao.resultado?.replace(/_/g, " ")}
            </span>
          </div>
          <div className={CARD}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tipo de Fraude</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{inspecao.tipo_fraude ?? "—"}</p>
          </div>
          <div className={CARD}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Mês / Ano</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{alerta.mes_ano}</p>
          </div>
        </div>

        {/* Foto */}
        {inspecao.foto_url && (
          <div className={CARD}>
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <Camera className="w-4 h-4" />
              Foto da Inspeção
            </div>
            <img src={inspecao.foto_url} alt="Foto da inspeção" className="w-full rounded-lg object-cover max-h-72" />
            {inspecao.lat_foto != null && inspecao.lng_foto != null && (
              <p className="mt-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <MapPin className="w-3.5 h-3.5" />
                {inspecao.lat_foto.toFixed(6)}, {inspecao.lng_foto.toFixed(6)}
              </p>
            )}
          </div>
        )}

        {/* Observações */}
        <div className={CARD}>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Observações</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
            {inspecao.observacoes ?? "Sem observações registadas"}
          </p>
        </div>

        {/* Regras ativadas */}
        {motivosAtivos.length > 0 && (
          <div className={CARD}>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Regras Ativadas</p>
            <ul className="space-y-2">
              {motivosAtivos.map(([regra, v]) => (
                <li key={regra} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-gray-600 dark:text-gray-400">{v.descricao ?? regra}</span>
                  <span className="shrink-0 font-semibold text-gray-900 dark:text-gray-100">+{v.pontos} pts</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
