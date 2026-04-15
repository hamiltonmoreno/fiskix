"use client";

import { useState, useEffect, useMemo } from "react";
import { Save, RotateCcw, AlertCircle, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

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
  limiar_score_medio: "Score MÉDIO mínimo",
  limiar_score_critico: "Score CRÍTICO mínimo",
};

const CONFIG_LIMITS: Record<string, { min: number; max: number; hint: string }> = {
  limiar_queda_pct:      { min: 5,   max: 80,  hint: "5% – 80%" },
  limiar_cv_maximo:      { min: 0.01,max: 1,   hint: "0.01 – 1.00" },
  limiar_mu_minimo:      { min: 0,   max: 500, hint: "≥ 0 kWh" },
  limiar_zscore_cluster: { min: 0.5, max: 5,   hint: "0.5 – 5.0" },
  limiar_div_sazonal:    { min: 1,   max: 80,  hint: "1% – 80%" },
  limiar_slope_tendencia:{ min: -500,max: -0.1,hint: "Valor negativo" },
  limiar_ratio_racio:    { min: 0.5, max: 5,   hint: "0.5 – 5.0" },
  limiar_pico_ratio:     { min: 0.05,max: 0.5, hint: "0.05 – 0.50" },
  limiar_perda_zona_pct: { min: 5,   max: 40,  hint: "5% – 40%" },
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
    setConfigs((prev) => prev.map((c) => editado[c.chave] !== undefined ? { ...c, valor: editado[c.chave] } : c));
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
    <div className="min-h-screen bg-background px-8 pt-8 pb-12">

      {/* Page hero */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs font-bold text-primary uppercase tracking-[0.15em] mb-2">
            Administração · Parâmetros
          </p>
          <h1 className="text-[2.5rem] font-bold tracking-tighter text-on-surface leading-none">
            Configuração do Motor
          </h1>
          <p className="text-sm text-on-surface-variant mt-2">
            Limiares ajustáveis sem reescrever código
          </p>
        </div>

        {temAlteracoes && (
          <button
            onClick={handleSalvar}
            disabled={saving || temErros}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-full font-bold text-sm transition-opacity cursor-pointer touch-manipulation"
            title={temErros ? "Corrija os erros antes de guardar" : undefined}
          >
            <Save className="w-4 h-4" />
            {saving
              ? "A guardar..."
              : temErros
              ? `${Object.values(erros).filter(Boolean).length} erro(s)`
              : `Guardar ${Object.keys(editado).length} alteração(ões)`}
          </button>
        )}
      </div>

      {erroGlobal && (
        <div className="mb-4 p-4 bg-[#ffdad6]/30 rounded-xl flex items-center gap-2 text-sm text-[#ba1a1a]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {erroGlobal}
        </div>
      )}

      {sucesso && (
        <div className="mb-4 p-4 bg-emerald-50 rounded-xl flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Configurações guardadas com sucesso
        </div>
      )}

      {loading ? (
        <div className="space-y-3 max-w-2xl">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-[1rem]" />
          ))}
        </div>
      ) : (
        <div className="max-w-2xl space-y-3">
          {configsVisiveis.map((c) => {
            const erro = erros[c.chave] ?? null;
            const isEdited = editado[c.chave] !== undefined;
            const limits = CONFIG_LIMITS[c.chave];

            return (
              <div
                key={c.chave}
                className={`bg-surface-container-lowest rounded-[1rem] p-5 shadow-sm border transition-colors ${
                  erro
                    ? "border-[#ba1a1a]/30"
                    : isEdited
                    ? "border-primary/30"
                    : "border-outline-variant/10"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-on-surface">
                    {CONFIG_LABELS[c.chave] ?? c.chave}
                  </label>
                  {limits && (
                    <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded-full">
                      {limits.hint}
                    </span>
                  )}
                </div>
                {c.descricao && (
                  <p className="text-[11px] text-on-surface-variant mb-2">{c.descricao}</p>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min={limits?.min}
                    max={limits?.max}
                    value={getValor(c.chave)}
                    onChange={(e) => handleChange(c.chave, e.target.value)}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-sm border-none focus:outline-none focus:ring-2 transition-colors ${
                      erro
                        ? "bg-[#ffdad6]/20 text-[#ba1a1a] focus:ring-[#ba1a1a]/30"
                        : isEdited
                        ? "bg-primary/5 text-on-surface focus:ring-primary/30"
                        : "bg-surface-container-low text-on-surface focus:ring-primary/30"
                    }`}
                  />
                  {isEdited && (
                    <button
                      onClick={() => handleReverter(c.chave)}
                      className="p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-container-low transition-colors cursor-pointer"
                      title="Reverter"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {erro && (
                  <p className="flex items-center gap-1 mt-2 text-[11px] text-[#ba1a1a]">
                    <AlertCircle className="w-3 h-3" />
                    {erro}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
