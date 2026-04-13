"use client";

import { useState, useRef } from "react";
import { Upload, CheckCircle, AlertCircle, FileText, CloudUpload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".csv", ".xls", ".xlsx"]);
const ALLOWED_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

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
    const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    const mimeOk = !file.type || ALLOWED_MIME_TYPES.has(file.type);
    const extOk = ALLOWED_EXTENSIONS.has(ext);

    if (!extOk || !mimeOk) {
      setFicheiro(null);
      setPreview({
        preview: [],
        total: 0,
        validos: 0,
        erros_count: 1,
        erros: [{ linha: 0, campo: "ficheiro", valor: file.name, motivo: "Formato inválido. Use CSV, XLS ou XLSX." }],
      });
      setResultado(null);
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setFicheiro(null);
      setPreview({
        preview: [],
        total: 0,
        validos: 0,
        erros_count: 1,
        erros: [{ linha: 0, campo: "ficheiro", valor: file.name, motivo: "Ficheiro excede o limite de 10MB." }],
      });
      setResultado(null);
      return;
    }

    setFicheiro(file);
    setPreview(null);
    setResultado(null);
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        setPreview({ preview: [], total: 0, validos: 0, erros_count: 1, erros: [{ linha: 0, campo: "sessão", valor: "", motivo: "Sessão expirada. Recarregue a página." }] });
        return;
      }

      const form = new FormData();
      form.append("file", file);
      form.append("tipo", tipo);
      form.append("preview_only", "true");

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ingest-data`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setPreview({ preview: [], total: 0, validos: 0, erros_count: 1, erros: [{ linha: 0, campo: "servidor", valor: "", motivo: err.error ?? "Erro desconhecido" }] });
        return;
      }

      const data = await res.json();
      setPreview(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleImportar() {
    if (!ficheiro) return;
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        setResultado({ total: 0, sucesso: 0, erros: 1, detalhes_erros: [{ linha: 0, campo: "sessão", motivo: "Sessão expirada." }] });
        return;
      }

      const form = new FormData();
      form.append("file", ficheiro);
      form.append("tipo", tipo);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ingest-data`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form }
      );

      const data = await res.json().catch(() => ({ total: 0, sucesso: 0, erros: 1 }));
      setResultado(data);
      setFicheiro(null);
      setPreview(null);

      const { data: hist } = await supabase
        .from("importacoes")
        .select("id, tipo, nome_ficheiro, total_registos, registos_sucesso, registos_erro, criado_em")
        .order("criado_em", { ascending: false })
        .limit(10);

      if (hist) setHistorico(hist);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-8 pt-8 pb-12">

      {/* Page hero */}
      <div className="mb-8">
        <p className="text-xs font-bold text-primary uppercase tracking-[0.15em] mb-2">
          Administração · Ingestão
        </p>
        <h1 className="text-[2.5rem] font-bold tracking-tighter text-on-surface leading-none">
          Importar Dados
        </h1>
        <p className="text-sm text-on-surface-variant mt-2">
          CSV e Excel de faturação ou injeção de energia
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">

        {/* Left: upload zone */}
        <div className="col-span-12 lg:col-span-7 space-y-4">

          {/* Tipo selector */}
          <div className="bg-surface-container-lowest rounded-[1.5rem] p-6 shadow-sm border border-outline-variant/10">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              Tipo de Dados
            </p>
            <div className="flex gap-2">
              {(["faturacao", "injecao"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-colors cursor-pointer touch-manipulation ${
                    tipo === t
                      ? "bg-primary text-white"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  {t === "faturacao" ? "Faturação de Clientes" : "Injeção de Energia"}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-on-surface-variant mt-3 font-mono">
              {tipo === "faturacao"
                ? "numero_contador · mes_ano (YYYY-MM) · kwh_faturado · valor_cve"
                : "subestacao_nome · mes_ano (YYYY-MM) · total_kwh_injetado"}
            </p>
          </div>

          {/* Upload zone */}
          {!preview && !resultado && !loading && (
            <div
              className="bg-surface-container-lowest rounded-[1.5rem] shadow-sm border-2 border-dashed border-outline-variant/30 p-12 text-center cursor-pointer hover:border-primary/40 hover:bg-surface-container-low/30 transition-all"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CloudUpload className="w-6 h-6 text-primary" />
              </div>
              <p className="font-bold text-on-surface">Arrastar ficheiro ou clicar para selecionar</p>
              <p className="text-xs text-on-surface-variant mt-1">CSV, XLS, XLSX · máx. 10MB</p>
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

          {/* Loading */}
          {loading && (
            <div className="bg-surface-container-lowest rounded-[1.5rem] shadow-sm p-8 text-center border border-outline-variant/10">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-on-surface-variant">A processar ficheiro...</p>
              <Skeleton className="h-4 w-48 rounded mx-auto mt-3" />
            </div>
          )}

          {/* Preview */}
          {preview && !loading && (
            <div className="bg-surface-container-lowest rounded-[1.5rem] shadow-sm overflow-hidden border border-outline-variant/10">
              <div className="px-6 py-4 border-b border-surface-container-low flex items-center justify-between">
                <div>
                  <p className="font-bold text-on-surface text-sm">{ficheiro?.name}</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    {preview.total} registos ·{" "}
                    <span className="text-emerald-600">{preview.validos} válidos</span>
                    {preview.erros_count > 0 && (
                      <> · <span className="text-[#ba1a1a]">{preview.erros_count} erros</span></>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => { setPreview(null); setFicheiro(null); }}
                  className="text-xs font-bold text-on-surface-variant hover:text-on-surface cursor-pointer"
                >
                  Cancelar
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <tbody className="divide-y divide-surface-container-low">
                    {(preview.preview ?? []).slice(0, 6).map((row, i) => (
                      <tr
                        key={i}
                        className={i === 0 ? "bg-surface-container-low/50" : "hover:bg-surface-container-low/20"}
                      >
                        {row.map((cell, j) => (
                          <td key={j} className={`px-6 py-3 ${i === 0 ? "font-bold text-slate-400 uppercase tracking-widest text-[10px]" : "text-on-surface"}`}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(preview.erros ?? []).length > 0 && (
                <div className="p-4 border-t border-surface-container-low bg-[#ffdad6]/20">
                  <p className="text-xs font-bold text-[#ba1a1a] mb-2">Erros de validação</p>
                  {(preview.erros ?? []).slice(0, 5).map((e, i) => (
                    <p key={i} className="text-[11px] text-[#ba1a1a]/80 font-mono">
                      Linha {e.linha} · {e.campo}: {e.motivo}
                    </p>
                  ))}
                </div>
              )}

              <div className="px-6 py-4 border-t border-surface-container-low flex justify-end">
                <button
                  onClick={handleImportar}
                  disabled={preview.validos === 0}
                  className="px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-40 text-white rounded-full font-bold text-xs transition-opacity cursor-pointer touch-manipulation"
                >
                  Importar {preview.validos} registos válidos
                </button>
              </div>
            </div>
          )}

          {/* Resultado */}
          {resultado && (
            <div className="bg-surface-container-lowest rounded-[1.5rem] shadow-sm p-6 border border-outline-variant/10">
              <div className="flex items-center gap-3 mb-4">
                {resultado.erros === 0 ? (
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-[#ffdad6] flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-[#ba1a1a]" />
                  </div>
                )}
                <div>
                  <p className="font-bold text-on-surface">Importação concluída</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    <span className="text-emerald-600">{resultado.sucesso} inseridos</span>
                    {resultado.erros > 0 && <> · <span className="text-[#ba1a1a]">{resultado.erros} erros</span></>}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setResultado(null)}
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                Importar mais dados
              </button>
            </div>
          )}
        </div>

        {/* Right: history */}
        <div className="col-span-12 lg:col-span-5">
          <div className="bg-surface-container-lowest rounded-[1.5rem] shadow-sm overflow-hidden border border-outline-variant/10">
            <div className="px-6 py-5 border-b border-surface-container-low">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                Histórico
              </p>
              <p className="font-bold text-on-surface">Importações Recentes</p>
            </div>

            {historico.length === 0 ? (
              <div className="p-10 text-center">
                <FileText className="w-8 h-8 text-on-surface-variant/30 mx-auto mb-2" />
                <p className="text-sm text-on-surface-variant">Nenhuma importação ainda</p>
              </div>
            ) : (
              <div className="divide-y divide-surface-container-low">
                {historico.map((h) => (
                  <div key={h.id} className="px-6 py-4 hover:bg-surface-container-low/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-on-surface truncate flex-1">{h.nome_ficheiro}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase flex-shrink-0 ${
                        h.tipo === "faturacao"
                          ? "bg-primary/10 text-primary"
                          : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {h.tipo}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[11px] text-on-surface-variant">{h.total_registos} total</span>
                      <span className="text-[11px] text-emerald-600">{h.registos_sucesso} ok</span>
                      {h.registos_erro > 0 && (
                        <span className="text-[11px] text-[#ba1a1a]">{h.registos_erro} erros</span>
                      )}
                      <span className="text-[11px] text-on-surface-variant ml-auto tabular-nums">
                        {new Date(h.criado_em).toLocaleDateString("pt-CV")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload icon override */}
      <span className="hidden"><Upload /></span>
    </div>
  );
}
