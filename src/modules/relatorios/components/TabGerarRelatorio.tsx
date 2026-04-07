"use client";

import { useState } from "react";
import {
  BarChart2,
  ClipboardList,
  MapPin,
  RefreshCw,
  Zap,
  Settings2,
  Check,
  ChevronRight,
} from "lucide-react";
import type { RelatoriosFiltros } from "../types";
import type { ExportRow } from "@/lib/export";

interface Props {
  filtros: RelatoriosFiltros;
  active: boolean;
  onExportReady: (headers: string[], rows: ExportRow[]) => void;
}

type TipoRelatorio =
  | "executivo"
  | "inspecoes"
  | "perdas-zona"
  | "recidivismo"
  | "balanco"
  | "personalizado";

const TIPOS: { value: TipoRelatorio; label: string; desc: string; icon: React.ElementType }[] = [
  { value: "executivo", label: "Executivo Mensal", desc: "KPIs, perdas e ROI para diretores", icon: BarChart2 },
  { value: "inspecoes", label: "Eficiência de Inspeções", desc: "Taxa de sucesso por zona e fiscal", icon: ClipboardList },
  { value: "perdas-zona", label: "Análise de Perdas por Zona", desc: "Top subestações e radar por ilha", icon: MapPin },
  { value: "recidivismo", label: "Recidivismo", desc: "Clientes com múltiplas deteções", icon: RefreshCw },
  { value: "balanco", label: "Balanço Energético", desc: "Injetado vs faturado + evolução", icon: Zap },
  { value: "personalizado", label: "Relatório Personalizado", desc: "Escolher secções à medida", icon: Settings2 },
];

export function TabGerarRelatorio({ filtros }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tipo, setTipo] = useState<TipoRelatorio | "">("");
  const [periodoInicio, setPeriodoInicio] = useState(filtros.mesAno);
  const [periodoFim, setPeriodoFim] = useState(filtros.mesAno);
  const [incluirGraficos, setIncluirGraficos] = useState(true);
  const [incluirTabelas, setIncluirTabelas] = useState(true);
  const [incluirKPIs, setIncluirKPIs] = useState(true);
  const [formato, setFormato] = useState<"PDF" | "Excel" | "Ambos">("PDF");
  const [gerado, setGerado] = useState(false);

  const tipoLabel = TIPOS.find((t) => t.value === tipo)?.label ?? "—";

  function handleGerar() {
    setGerado(true);
  }

  function handleReset() {
    setStep(1);
    setTipo("");
    setGerado(false);
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-8">
        {([1, 2, 3] as const).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                step > s
                  ? "bg-blue-600 text-white"
                  : step === s
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {step > s ? <Check className="w-4 h-4" /> : s}
            </div>
            <span className={`text-sm hidden sm:inline ${step === s ? "font-medium text-slate-900" : "text-slate-400"}`}>
              {s === 1 ? "Tipo" : s === 2 ? "Parâmetros" : "Confirmação"}
            </span>
            {s < 3 && <ChevronRight className="w-4 h-4 text-slate-300" />}
          </div>
        ))}
      </div>

      {/* Step 1 — Tipo */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-1">Tipo de Relatório</h2>
          <p className="text-sm text-slate-500 mb-5">Selecione o tipo de análise que pretende gerar.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TIPOS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  onClick={() => setTipo(t.value)}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                    tipo === t.value
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className={`p-2 rounded-lg flex-shrink-0 ${tipo === t.value ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{t.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!tipo}
              className="px-5 py-2 text-sm font-medium bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Seguinte →
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Parâmetros */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-1">Parâmetros</h2>
          <p className="text-sm text-slate-500 mb-5">Configure o período e conteúdo do relatório.</p>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Período — Início</label>
                <input
                  type="month"
                  value={periodoInicio}
                  onChange={(e) => setPeriodoInicio(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Período — Fim</label>
                <input
                  type="month"
                  value={periodoFim}
                  min={periodoInicio}
                  onChange={(e) => setPeriodoFim(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Secções a incluir</label>
              <div className="space-y-2">
                {[
                  { label: "KPI Cards", value: incluirKPIs, set: setIncluirKPIs },
                  { label: "Gráficos", value: incluirGraficos, set: setIncluirGraficos },
                  { label: "Tabelas de dados", value: incluirTabelas, set: setIncluirTabelas },
                ].map((opt) => (
                  <label key={opt.label} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={opt.value}
                      onChange={(e) => opt.set(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Formato de saída</label>
              <div className="flex gap-3">
                {(["PDF", "Excel", "Ambos"] as const).map((f) => (
                  <label key={f} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="formato"
                      value={f}
                      checked={formato === f}
                      onChange={() => setFormato(f)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">{f}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              ← Voltar
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-5 py-2 text-sm font-medium bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition-colors"
            >
              Seguinte →
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Confirmação */}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-1">Confirmação</h2>
          <p className="text-sm text-slate-500 mb-5">Reveja os parâmetros antes de gerar.</p>

          {gerado ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-start gap-3">
              <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Relatório agendado para geração!</p>
                <p className="mt-1 text-green-600">Receberá uma notificação quando o ficheiro estiver pronto para download.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg mb-6">
                {[
                  { label: "Tipo", value: tipoLabel },
                  { label: "Período", value: `${periodoInicio} → ${periodoFim}` },
                  { label: "Secções", value: [incluirKPIs && "KPIs", incluirGraficos && "Gráficos", incluirTabelas && "Tabelas"].filter(Boolean).join(", ") || "Nenhuma" },
                  { label: "Formato", value: formato },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between px-4 py-3 text-sm">
                    <span className="text-slate-500">{row.label}</span>
                    <span className="font-medium text-slate-800">{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  ← Voltar
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={handleGerar}
                    className="px-5 py-2 text-sm font-medium bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition-colors"
                  >
                    Gerar Agora
                  </button>
                </div>
              </div>
            </>
          )}

          {gerado && (
            <div className="mt-4 text-center">
              <button
                onClick={handleReset}
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Gerar outro relatório
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
