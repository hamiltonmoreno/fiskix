"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Upload, CheckCircle, AlertCircle, ArrowLeft, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface HistoricoItem {
  id: string;
  tipo: string;
  nome_ficheiro: string;
  total_registos: number;
  registos_sucesso: number;
  registos_erro: number;
  criado_em: string;
}

interface ImportarDadosProps {
  historico: HistoricoItem[];
}

interface PreviewResult {
  preview: string[][];
  total: number;
  validos: number;
  erros_count: number;
  erros: Array<{ linha: number; campo: string; valor: string; motivo: string }>;
}

interface ImportResult {
  total: number;
  sucesso: number;
  erros: number;
  detalhes_erros?: Array<{ linha: number; campo: string; motivo: string }>;
}

export function ImportarDados({ historico: historicoInicial }: ImportarDadosProps) {
  const [tipo, setTipo] = useState<"faturacao" | "injecao">("faturacao");
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [resultado, setResultado] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState(historicoInicial);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function handleFile(file: File) {
    setFicheiro(file);
    setPreview(null);
    setResultado(null);
    setLoading(true);

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const form = new FormData();
    form.append("file", file);
    form.append("tipo", tipo);
    form.append("preview_only", "true");

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ingest-data`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      setPreview({ preview: [], total: 0, validos: 0, erros_count: 1, erros: [{ linha: 0, campo: "servidor", valor: "", motivo: err.error ?? "Erro desconhecido" }] });
      setLoading(false);
      return;
    }

    const data = await res.json();
    setPreview(data);
    setLoading(false);
  }

  async function handleImportar() {
    if (!ficheiro) return;
    setLoading(true);

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const form = new FormData();
    form.append("file", ficheiro);
    form.append("tipo", tipo);

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ingest-data`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      }
    );

    const data = await res.json().catch(() => ({ total: 0, sucesso: 0, erros: 1 }));
    setResultado(data);
    setFicheiro(null);
    setPreview(null);

    // Atualizar histórico
    const { data: hist } = await supabase
      .from("importacoes")
      .select("id, tipo, nome_ficheiro, total_registos, registos_sucesso, registos_erro, criado_em")
      .order("criado_em", { ascending: false })
      .limit(10);

    if (hist) setHistorico(hist);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="font-bold text-slate-900">Importar Dados</h1>
        <p className="text-sm text-slate-400">CSV e Excel de faturação ou injeção</p>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Seletor de tipo */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="font-semibold text-slate-700 mb-3">Tipo de dados</p>
          <div className="flex gap-3">
            {(["faturacao", "injecao"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  tipo === t
                    ? "bg-blue-700 text-white border-blue-700"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              >
                {t === "faturacao" ? "Faturação de Clientes" : "Injeção de Energia"}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            {tipo === "faturacao"
              ? "Colunas: numero_contador, mes_ano (YYYY-MM), kwh_faturado, valor_cve"
              : "Colunas: subestacao_nome, mes_ano (YYYY-MM), total_kwh_injetado"}
          </p>
        </div>

        {/* Upload */}
        {!preview && !resultado && (
          <div
            className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-10 text-center cursor-pointer hover:border-blue-400 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
          >
            <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-medium text-slate-600">Arrastar ficheiro ou clicar para selecionar</p>
            <p className="text-sm text-slate-400 mt-1">CSV, XLS, XLSX até 10MB</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xls,.xlsx"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500">A processar ficheiro...</p>
          </div>
        )}

        {/* Preview */}
        {preview && !loading && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-700">
                  Preview: {ficheiro?.name}
                </p>
                <p className="text-sm text-slate-400 mt-0.5">
                  {preview.total} registos · {preview.validos} válidos ·{" "}
                  {preview.erros_count > 0 && (
                    <span className="text-red-500">{preview.erros_count} erros</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => {
                  setPreview(null);
                  setFicheiro(null);
                }}
                className="text-sm text-slate-400 hover:text-slate-600"
              >
                Cancelar
              </button>
            </div>

            {/* Tabela preview */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <tbody>
                  {(preview.preview ?? []).slice(0, 6).map((row, i) => (
                    <tr
                      key={i}
                      className={
                        i === 0
                          ? "bg-slate-50 font-semibold"
                          : "border-t border-slate-50"
                      }
                    >
                      {row.map((cell, j) => (
                        <td key={j} className="px-4 py-2 text-slate-600">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Erros */}
            {(preview.erros ?? []).length > 0 && (
              <div className="p-4 border-t border-slate-100 bg-red-50">
                <p className="text-sm font-medium text-red-700 mb-2">
                  Erros de validação:
                </p>
                {(preview.erros ?? []).slice(0, 5).map((e, i) => (
                  <p key={i} className="text-xs text-red-600">
                    Linha {e.linha} · {e.campo}: {e.motivo}
                  </p>
                ))}
              </div>
            )}

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={handleImportar}
                disabled={preview.validos === 0}
                className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white rounded-lg font-medium text-sm transition-colors"
              >
                Importar {preview.validos} registos válidos
              </button>
            </div>
          </div>
        )}

        {/* Resultado */}
        {resultado && (
          <div
            className={`bg-white rounded-xl border p-6 ${
              resultado.erros === 0
                ? "border-green-200"
                : "border-amber-200"
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              {resultado.erros === 0 ? (
                <CheckCircle className="w-6 h-6 text-green-500" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-500" />
              )}
              <div>
                <p className="font-semibold text-slate-900">Importação concluída</p>
                <p className="text-sm text-slate-400">
                  {resultado.sucesso} inseridos · {resultado.erros} erros
                </p>
              </div>
            </div>
            <button
              onClick={() => setResultado(null)}
              className="text-sm text-blue-600 hover:underline"
            >
              Importar mais dados
            </button>
          </div>
        )}

        {/* Histórico */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700">Histórico de Importações</h3>
          </div>
          {historico.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <FileText className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Nenhuma importação ainda</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Ficheiro</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Sucesso</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Erros</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Data</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((h) => (
                  <tr key={h.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{h.nome_ficheiro}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                        {h.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{h.total_registos}</td>
                    <td className="px-4 py-3 text-green-600 font-medium">{h.registos_sucesso}</td>
                    <td className="px-4 py-3 text-red-500">{h.registos_erro || "—"}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {new Date(h.criado_em).toLocaleString("pt-CV")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
