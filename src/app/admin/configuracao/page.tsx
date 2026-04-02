"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Save, RotateCcw } from "lucide-react";
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

export default function ConfiguracaoPage() {
  const [configs, setConfigs] = useState<Configuracao[]>([]);
  const [editado, setEditado] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("configuracoes")
      .select("chave, valor, descricao")
      .then(({ data }) => {
        setConfigs(data ?? []);
        setLoading(false);
      });
  }, []);

  async function handleSalvar() {
    setSaving(true);
    setSucesso(false);

    const updates = Object.entries(editado).map(([chave, valor]) =>
      supabase.from("configuracoes").update({ valor }).eq("chave", chave)
    );

    await Promise.all(updates);
    setSaving(false);
    setSucesso(true);

    // Atualizar local
    setConfigs((prev) =>
      prev.map((c) =>
        editado[c.chave] !== undefined ? { ...c, valor: editado[c.chave] } : c
      )
    );
    setEditado({});

    setTimeout(() => setSucesso(false), 3000);
  }

  function handleChange(chave: string, valor: string) {
    setEditado((prev) => ({ ...prev, [chave]: valor }));
  }

  function getValor(chave: string): string {
    return editado[chave] ?? configs.find((c) => c.chave === chave)?.valor ?? "";
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </Link>
          <div>
            <h1 className="font-bold text-slate-900">Configuração do Motor</h1>
            <p className="text-sm text-slate-400">Limiares ajustáveis — sem reescrever código</p>
          </div>
        </div>
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
            {configs.map((c) => (
              <div key={c.chave} className="bg-white rounded-xl border border-slate-200 p-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {CONFIG_LABELS[c.chave] ?? c.chave}
                </label>
                {c.descricao && (
                  <p className="text-xs text-slate-400 mb-2">{c.descricao}</p>
                )}
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.01"
                    value={getValor(c.chave)}
                    onChange={(e) => handleChange(c.chave, e.target.value)}
                    className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      editado[c.chave] !== undefined
                        ? "border-blue-300 bg-blue-50"
                        : "border-slate-200"
                    }`}
                  />
                  {editado[c.chave] !== undefined && (
                    <button
                      onClick={() => {
                        setEditado((prev) => {
                          const next = { ...prev };
                          delete next[c.chave];
                          return next;
                        });
                      }}
                      className="p-2 text-slate-400 hover:text-slate-600"
                      title="Reverter"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {Object.keys(editado).length > 0 && (
              <button
                onClick={handleSalvar}
                disabled={saving}
                className="w-full py-3 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? "A guardar..." : `Guardar ${Object.keys(editado).length} alteração(ões)`}
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
