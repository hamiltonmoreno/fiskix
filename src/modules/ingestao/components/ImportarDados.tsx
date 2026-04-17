"use client";

import { Upload } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { HistoricoItem } from "./types";
import { useImportarDados } from "./useImportarDados";
import { UploadZone } from "./UploadZone";
import { PreviewTable } from "./PreviewTable";
import { ImportResultado } from "./ImportResultado";
import { ImportHistorico } from "./ImportHistorico";

interface ImportarDadosProps {
  historico: HistoricoItem[];
}

export function ImportarDados({ historico: historicoInicial }: ImportarDadosProps) {
  const {
    tipo, setTipo,
    ficheiro, preview, setPreview, setFicheiro,
    resultado, setResultado,
    loading, historico,
    handleFile, handleImportar,
  } = useImportarDados(historicoInicial);

  return (
    <div className="min-h-screen bg-background px-8 pt-8 pb-12">
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
        <div className="col-span-12 lg:col-span-7 space-y-4">

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

          {!preview && !resultado && !loading && (
            <UploadZone onFile={handleFile} />
          )}

          {loading && (
            <div className="bg-surface-container-lowest rounded-[1.5rem] shadow-sm p-8 text-center border border-outline-variant/10">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-on-surface-variant">A processar ficheiro...</p>
              <Skeleton className="h-4 w-48 rounded mx-auto mt-3" />
            </div>
          )}

          {preview && !loading && (
            <PreviewTable
              preview={preview}
              ficheiro={ficheiro}
              loading={loading}
              onCancel={() => { setPreview(null); setFicheiro(null); }}
              onImportar={handleImportar}
            />
          )}

          {resultado && (
            <ImportResultado
              resultado={resultado}
              onReset={() => setResultado(null)}
            />
          )}
        </div>

        <div className="col-span-12 lg:col-span-5">
          <ImportHistorico historico={historico} />
        </div>
      </div>

      {/* Upload icon override */}
      <span className="hidden"><Upload /></span>
    </div>
  );
}
