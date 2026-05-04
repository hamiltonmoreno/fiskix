"use client";

import { useState, useEffect } from "react";
import { Save, RotateCcw, AlertCircle, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Configuracao {
  chave: string;
  valor: string;
  descricao: string | null;
}

const CONFIG_LABELS: Record<string, string> = {
  limiar_queda_pct: "R1 — Queda mínima (%)",
  limiar_cv_maximo: "R2 — CV máximo (coeficiente de variação)",
  limiar_mu_minimo: "R2 — Consumo médio mínimo (kWh)",
  limiar_zscore_cluster: "R3 — Z-score mínimo",
  limiar_div_sazonal: "R4 — Divergência sazonal mínima (%)",
  limiar_slope_tendencia: "R5 — Slope mínimo (kWh/mês)",
  limiar_ratio_racio: "R6 — Desvios padrão para rácio CVE/kWh",
  limiar_pico_ratio: "R8 — Rácio pico histórico mínimo",
  limiar_perda_zona_pct: "Filtro Macro — Perda mínima por zona (%)",
  limiar_score_medio: "Score MÉDIO mínimo",
  limiar_score_critico: "Score CRÍTICO mínimo",
};

// Min / max constraints per config key
const CONFIG_LIMITS: Record<string, { min: number; max: number; hint: string }> = {
  limiar_queda_pct:      { min: 5,   max: 80,  hint: "Entre 5% e 80%" },
  limiar_cv_maximo:      { min: 0.01,max: 1,   hint: "Entre 0.01 e 1.00" },
  limiar_mu_minimo:      { min: 0,   max: 500, hint: "kWh ≥ 0" },
  limiar_zscore_cluster: { min: -5,  max: -0.5,hint: "Valor negativo (entre -5.0 e -0.5)" },
  limiar_div_sazonal:    { min: 1,   max: 80,  hint: "Entre 1% e 80%" },
  limiar_slope_tendencia:{ min: -500,max: -0.1,hint: "Valor negativo (descida)" },
  limiar_ratio_racio:    { min: 0.5, max: 5,   hint: "Entre 0.5 e 5.0" },
  limiar_pico_ratio:     { min: 0.05,max: 0.5, hint: "Entre 0.05 e 0.50" },
  limiar_perda_zona_pct: { min: 5,   max: 40,  hint: "Entre 5% e 40%" },
  limiar_score_medio:    { min: 20,  max: 74,  hint: "Entre 20 e 74 pontos" },
  limiar_score_critico:  { min: 50,  max: 100, hint: "Entre 50 e 100 pontos" },
};

function validateValue(chave: string, valor: string): string | null {
  const num = parseFloat(valor);
  if (isNaN(num)) return "Deve ser um número válido";
  const limits = CONFIG_LIMITS[chave];
  if (!limits) return null;
  if (num < limits.min) return `Mínimo: ${limits.min}`;
  if (num > limits.max) return `Máximo: ${limits.max}`;
  // Extra: limiar_score_critico must be > limiar_score_medio (checked at save time)
  return null;
}

export default function ConfiguracaoPage() {
  const [configs, setConfigs] = useState<Configuracao[]>([]);
  const [editado, setEditado] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erroGlobal, setErroGlobal] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("configuracoes")
      .select("chave, valor, descricao")
      .then(({ data }) => {
        setConfigs(data ?? []);
        setLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Per-field errors
  const erros: Record<string, string | null> = {};
  for (const [chave, valor] of Object.entries(editado)) {
    erros[chave] = validateValue(chave, valor);
  }

  const temErros = Object.values(erros).some((e) => e !== null);
  const temAlteracoes = Object.keys(editado).length > 0;

  async function handleSalvar() {
    // Cross-field validation: score_critico > score_medio
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
      setErroGlobal("Erro ao guardar algumas configurações. Verifique as permissões.");
      return;
    }

    setSucesso(true);
    setConfigs((prev) =>
      prev.map((c) =>
        editado[c.chave] !== undefined ? { ...c, valor: editado[c.chave] } : c
      )
    );
    setEditado({});
    setTimeout(() => setSucesso(false), 3000);
  }

  function handleChange(chave: string, valor: string) {
    setErroGlobal(null);
    setEditado((prev) => ({ ...prev, [chave]: valor }));
  }

  function handleReverter(chave: string) {
    setEditado((prev) => {
      const next = { ...prev };
      delete next[chave];
      return next;
    });
  }

  function getValor(chave: string): string {
    return editado[chave] ?? configs.find((c) => c.chave === chave)?.valor ?? "";
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="font-bold text-slate-900">Configuração do Motor</h1>
        <p className="text-sm text-slate-400">Limiares ajustáveis — sem reescrever código</p>
      </header>

      <main className="max-w-2xl mx-auto p-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-1/2 mb-2" />
                <div className="h-8 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {configs.map((c) => {
              const erro = erros[c.chave] ?? null;
              const isEdited = editado[c.chave] !== undefined;
              const limits = CONFIG_LIMITS[c.chave];

              return (
                <div
                  key={c.chave}
                  className={`bg-white rounded-xl border p-4 transition-colors ${
                    erro ? "border-red-300" : isEdited ? "border-blue-300" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <label className="text-sm font-medium text-slate-700">
                      {CONFIG_LABELS[c.chave] ?? c.chave}
                    </label>
                    {limits && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Info className="w-3 h-3" />
                        {limits.hint}
                      </span>
                    )}
                  </div>
                  {c.descricao && (
                    <p className="text-xs text-slate-400 mb-2">{c.descricao}</p>
                  )}
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.01"
                      min={limits?.min}
                      max={limits?.max}
                      value={getValor(c.chave)}
                      onChange={(e) => handleChange(c.chave, e.target.value)}
                      className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                        erro
                          ? "border-red-300 bg-red-50 focus:ring-red-400"
                          : isEdited
                          ? "border-blue-300 bg-blue-50 focus:ring-blue-500"
                          : "border-slate-200 focus:ring-blue-500"
                      }`}
                    />
                    {isEdited && (
                      <button
                        onClick={() => handleReverter(c.chave)}
                        className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Reverter"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {erro && (
                    <p className="flex items-center gap-1 mt-1.5 text-xs text-red-600">
                      <AlertCircle className="w-3 h-3" />
                      {erro}
                    </p>
                  )}
                </div>
              );
            })}

            {erroGlobal && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {erroGlobal}
              </div>
            )}

            {temAlteracoes && (
              <button
                onClick={handleSalvar}
                disabled={saving || temErros}
                className="w-full py-3 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                title={temErros ? "Corrija os erros antes de guardar" : undefined}
              >
                <Save className="w-4 h-4" />
                {saving
                  ? "A guardar..."
                  : temErros
                  ? `${Object.values(erros).filter(Boolean).length} campo(s) com erro`
                  : `Guardar ${Object.keys(editado).length} alteração(ões)`}
              </button>
            )}

            {sucesso && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center text-green-700 font-medium">
                ✓ Configurações guardadas com sucesso
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
