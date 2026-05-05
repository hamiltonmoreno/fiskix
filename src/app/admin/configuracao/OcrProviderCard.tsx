"use client";

import { useState, useEffect, useMemo } from "react";
import { Save, ScanText, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { haptics } from "@/lib/haptics";

interface OcrConfig {
  ocr_provider: "text-paste" | "claude-vision";
  ocr_claude_api_key: string;
  ocr_claude_model: string;
}

const DEFAULTS: OcrConfig = {
  ocr_provider: "text-paste",
  ocr_claude_api_key: "",
  ocr_claude_model: "claude-haiku-4-5",
};

export function OcrProviderCard() {
  const supabase = useMemo(() => createClient(), []);
  const [cfg, setCfg] = useState<OcrConfig>(DEFAULTS);
  const [draft, setDraft] = useState<OcrConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from("configuracoes")
          .select("chave, valor")
          .in("chave", ["ocr_provider", "ocr_claude_api_key", "ocr_claude_model"]);
        const next: OcrConfig = { ...DEFAULTS };
        for (const r of data ?? []) {
          if (r.chave === "ocr_provider" && (r.valor === "text-paste" || r.valor === "claude-vision")) {
            next.ocr_provider = r.valor;
          } else if (r.chave === "ocr_claude_api_key") {
            next.ocr_claude_api_key = r.valor ?? "";
          } else if (r.chave === "ocr_claude_model") {
            next.ocr_claude_model = r.valor ?? DEFAULTS.ocr_claude_model;
          }
        }
        setCfg(next);
        setDraft(next);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = JSON.stringify(cfg) !== JSON.stringify(draft);

  async function save() {
    setSaving(true);
    setFeedback(null);
    try {
      const updates = (Object.entries(draft) as [keyof OcrConfig, string][]).map(([k, v]) =>
        supabase.from("configuracoes").update({ valor: v }).eq("chave", k)
      );
      const results = await Promise.all(updates);
      if (results.some((r) => r.error)) {
        setFeedback("Erro a guardar — verifica permissões.");
        return;
      }
      setCfg(draft);
      setFeedback("Configurações OCR guardadas.");
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  const apiKeyMasked = draft.ocr_claude_api_key
    ? "•".repeat(Math.max(0, draft.ocr_claude_api_key.length - 4)) + draft.ocr_claude_api_key.slice(-4)
    : "";

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-4">
        <ScanText className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Parser de Faturas EDEC</h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Provider usado pela edge function <code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">parse-fatura-edec</code> ao processar faturas.
      </p>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700/60 shadow-sm space-y-5">
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Provider activo
          </label>
          <select
            value={draft.ocr_provider}
            onChange={(e) => setDraft({ ...draft, ocr_provider: e.target.value as OcrConfig["ocr_provider"] })}
            disabled={loading}
            className="w-full md:w-1/2 appearance-none px-4 py-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer"
          >
            <option value="text-paste">Text-paste (gratuito) — user cola texto</option>
            <option value="claude-vision">Claude Vision (premium) — upload de imagem</option>
          </select>
          <p className="text-xs text-gray-400 mt-2">
            {draft.ocr_provider === "text-paste"
              ? "Zero custo. Accuracy alta para faturas EDEC com layout consistente."
              : "Requer API key Anthropic. Accuracy >95%, ~$0.003 por fatura."}
          </p>
        </div>

        <div className={draft.ocr_provider === "claude-vision" ? "" : "opacity-50 pointer-events-none"}>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            API key Anthropic
          </label>
          <div className="flex items-center gap-2">
            <input
              type={showKey ? "text" : "password"}
              placeholder="sk-ant-api03-..."
              value={showKey ? draft.ocr_claude_api_key : (apiKeyMasked || "")}
              onChange={(e) => setDraft({ ...draft, ocr_claude_api_key: e.target.value })}
              disabled={loading || draft.ocr_provider !== "claude-vision"}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-mono bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700/60 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
              aria-label={showKey ? "Ocultar API key" : "Mostrar API key"}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Obter em <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">console.anthropic.com</a>. Vazio desactiva o provider.
          </p>
        </div>

        <div className={draft.ocr_provider === "claude-vision" ? "" : "opacity-50 pointer-events-none"}>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Modelo Claude
          </label>
          <select
            value={draft.ocr_claude_model}
            onChange={(e) => setDraft({ ...draft, ocr_claude_model: e.target.value })}
            disabled={loading || draft.ocr_provider !== "claude-vision"}
            className="w-full md:w-1/2 appearance-none px-4 py-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer"
          >
            <option value="claude-haiku-4-5">Haiku 4.5 (mais barato, ~$0.003/fatura)</option>
            <option value="claude-sonnet-4-6">Sonnet 4.6 (accuracy mais alta, ~$0.015/fatura)</option>
          </select>
        </div>

        <div className="flex items-center gap-3 pt-3 border-t border-gray-100 dark:border-gray-700/60">
          <button
            onClick={() => { haptics.medium(); save(); }}
            disabled={!dirty || saving || loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? "A guardar..." : "Guardar OCR"}
          </button>
          {feedback && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">{feedback}</span>
          )}
        </div>
      </div>
    </section>
  );
}
