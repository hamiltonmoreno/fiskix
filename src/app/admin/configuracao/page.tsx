"use client";

import { useState, useEffect, useMemo } from "react";
import { Save, RotateCcw, AlertCircle, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { haptics } from "@/lib/haptics";
import { Icon } from "@/components/Icon";
import { OcrProviderCard } from "./OcrProviderCard";

interface Configuracao {
  chave: string;
  valor: string;
  descricao: string | null;
}

const CONFIG_LABELS: Record<string, string> = {
  limiar_queda_pct: "R1 — Queda mínima (%)",
  limiar_cv_maximo: "R2 — CV máximo",
  limiar_mu_minimo: "R2 — Consumo médio mínimo (kWh)",
  limiar_zscore_cluster: "R3 — Z-score mínimo",
  limiar_div_sazonal: "R4 — Divergência sazonal mínima (%)",
  limiar_slope_tendencia: "R5 — Slope mínimo (kWh/mês)",
  limiar_ratio_racio: "R6 — Desvios padrão rácio CVE/kWh",
  limiar_pico_ratio: "R8 — Rácio pico histórico mínimo",
  limiar_perda_zona_pct: "Filtro Macro — Perda mínima por zona (%)",
  limiar_divida_acumulada_cve: "R10 — Limiar dívida acumulada (CVE)",
  r11_meses_min_estimada: "R11 — Meses mínimos consecutivos estimada",
  r12_threshold_pct: "R12 — Capacidade subutilizada (% mínimo)",
  limiar_score_medio: "Score MÉDIO mínimo",
  limiar_score_critico: "Score CRÍTICO mínimo",
};

const CONFIG_LIMITS: Record<string, { min: number; max: number; hint: string }> = {
  limiar_queda_pct:      { min: 5,   max: 80,  hint: "5% – 80%" },
  limiar_cv_maximo:      { min: 0.01,max: 1,   hint: "0.01 – 1.00" },
  limiar_mu_minimo:      { min: 0,   max: 500, hint: "≥ 0 kWh" },
  // Z-score for cluster anomaly is below-mean detection: must be negative.
  limiar_zscore_cluster: { min: -5,  max: -0.5,hint: "Valor negativo (-5.0 a -0.5)" },
  limiar_div_sazonal:    { min: 1,   max: 80,  hint: "1% – 80%" },
  limiar_slope_tendencia:{ min: -500,max: -0.1,hint: "Valor negativo" },
  limiar_ratio_racio:    { min: 0.5, max: 5,   hint: "0.5 – 5.0" },
  limiar_pico_ratio:     { min: 0.05,max: 0.5, hint: "0.05 – 0.50" },
  limiar_perda_zona_pct: { min: 5,   max: 40,  hint: "5% – 40%" },
  limiar_divida_acumulada_cve: { min: 500,  max: 100000, hint: "500 – 100.000 CVE" },
  r11_meses_min_estimada: { min: 2, max: 12, hint: "2 – 12 meses" },
  r12_threshold_pct:     { min: 0.1, max: 50,  hint: "0.1% – 50%" },
  limiar_score_medio:    { min: 20,  max: 74,  hint: "20 – 74 pts" },
  limiar_score_critico:  { min: 50,  max: 100, hint: "50 – 100 pts" },
};

function validateValue(chave: string, valor: string): string | null {
  const num = parseFloat(valor);
  if (isNaN(num)) return "Deve ser um número válido";
  const limits = CONFIG_LIMITS[chave];
  if (!limits) return null;
  if (num < limits.min) return `Mínimo: ${limits.min}`;
  if (num > limits.max) return `Máximo: ${limits.max}`;
  return null;
}

export default function ConfiguracaoPage() {
  const [configs, setConfigs] = useState<Configuracao[]>([]);
  const [editado, setEditado] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erroGlobal, setErroGlobal] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function fetchConfigs() {
      try {
        const { data } = await supabase
          .from("configuracoes")
          .select("chave, valor, descricao");
        setConfigs(data ?? []);
      } finally {
        setLoading(false);
      }
    }
    fetchConfigs();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const erros: Record<string, string | null> = {};
  for (const [chave, valor] of Object.entries(editado)) {
    erros[chave] = validateValue(chave, valor);
  }

  const temErros = Object.values(erros).some((e) => e !== null);
  const temAlteracoes = Object.keys(editado).length > 0;

  async function handleSalvar() {
    const medio = parseFloat(editado["limiar_score_medio"] ?? configs.find((c) => c.chave === "limiar_score_medio")?.valor ?? "50");
    const critico = parseFloat(editado["limiar_score_critico"] ?? configs.find((c) => c.chave === "limiar_score_critico")?.valor ?? "75");
    if (critico <= medio) {
      setErroGlobal("Score CRÍTICO deve ser maior que Score MÉDIO.");
      return;
    }

    setSaving(true);
    setSucesso(false);
    setErroGlobal(null);

    const updates = Object.entries(editado).map(([chave, valor]) =>
      supabase.from("configuracoes").update({ valor }).eq("chave", chave)
    );
    const results = await Promise.all(updates);
    const anyError = results.some((r) => r.error);
    setSaving(false);

    if (anyError) {
      setErroGlobal("Erro ao guardar algumas configurações.");
      return;
    }

    setSucesso(true);
    setConfigs((prev) => prev.map((c) => editado[c.chave] !== undefined ? { ...c, valor: editado[c.chave]! } : c));
    setEditado({});
    setTimeout(() => setSucesso(false), 3000);
  }

  function handleChange(chave: string, valor: string) {
    setErroGlobal(null);
    setEditado((prev) => ({ ...prev, [chave]: valor }));
  }

  function handleReverter(chave: string) {
    setEditado((prev) => { const next = { ...prev }; delete next[chave]; return next; });
  }

  function getValor(chave: string): string {
    return editado[chave] ?? configs.find((c) => c.chave === chave)?.valor ?? "";
  }

  // Only show labeled configs
  const configsVisiveis = configs.filter((c) => CONFIG_LABELS[c.chave]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      {/* Page hero */}
      <div className="sm:flex sm:justify-between sm:items-center mb-8">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
            Configuração do Motor
          </h1>
          <p className="text-sm text-gray-500 mt-1 uppercase tracking-wider font-semibold">
            Limiares ajustáveis · 12 Regras v3
          </p>
        </div>

        {temAlteracoes && (
          <button
            onClick={() => { haptics.medium(); handleSalvar(); }}
            disabled={saving || temErros}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm cursor-pointer"
            title={temErros ? "Corrija os erros antes de guardar" : undefined}
          >
            <Icon name="save" size="xs" />
            {saving
              ? "A guardar..."
              : temErros
              ? `${Object.values(erros).filter(Boolean).length} erro(s)`
              : `Guardar ${Object.keys(editado).length} alterações`}
          </button>
        )}
      </div>

      {erroGlobal && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 rounded-xl flex items-center gap-2 text-sm text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20 shadow-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {erroGlobal}
        </div>
      )}

      {sucesso && (
        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 shadow-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Configurações guardadas com sucesso
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {configsVisiveis.map((c) => {
            const erro = erros[c.chave] ?? null;
            const isEdited = editado[c.chave] !== undefined;
            const limits = CONFIG_LIMITS[c.chave];

            return (
              <div
                key={c.chave}
                className={`bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border transition-all duration-300 ${
                  erro
                    ? "border-red-300 dark:border-red-500/50 shadow-red-50/50 dark:shadow-none"
                    : isEdited
                    ? "border-blue-300 dark:border-blue-500/50 shadow-blue-50/50 dark:shadow-none"
                    : "border-gray-200 dark:border-gray-700/60"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {CONFIG_LABELS[c.chave] ?? c.chave}
                  </label>
                  {limits && (
                    <span className="text-[10px] font-mono font-semibold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900/50 px-2 py-0.5 rounded-md border border-gray-100 dark:border-gray-700/50">
                      {limits.hint}
                    </span>
                  )}
                </div>
                {c.descricao && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{c.descricao}</p>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min={limits?.min}
                    max={limits?.max}
                    value={getValor(c.chave)}
                    onChange={(e) => handleChange(c.chave, e.target.value)}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm border focus:outline-none focus:ring-0 transition-all duration-200 ${
                      erro
                        ? "bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-400"
                        : isEdited
                        ? "bg-blue-50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/50 text-blue-600 dark:text-blue-400"
                        : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700/60 text-gray-900 dark:text-gray-100"
                    }`}
                  />
                  {isEdited && (
                    <button
                      onClick={() => { haptics.light(); handleReverter(c.chave); }}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      title="Reverter"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {erro && (
                  <p className="flex items-center gap-1 mt-3 text-xs text-red-600 dark:text-red-400 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {erro}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <OcrProviderCard />
    </div>
  );
}
