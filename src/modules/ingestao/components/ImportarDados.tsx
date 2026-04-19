import { haptics } from "@/lib/haptics";
import { Icon } from "@/components/Icon";
import { CloudUpload } from "lucide-react";

import dynamic from "next/dynamic";
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
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      <div className="sm:flex sm:justify-between sm:items-center mb-8">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
            Importar Dados
          </h1>
          <p className="text-sm text-gray-500 mt-1 uppercase tracking-wider font-semibold">
            CSV e Excel · Ingestão de Energia e Faturação
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7 space-y-4">

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700/60 mb-6">
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
              Tipo de Dados
            </p>
            <div className="flex gap-2">
              {(["faturacao", "injecao"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { haptics.light(); setTipo(t); }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm ${
                    tipo === t
                      ? "bg-blue-600 text-white shadow-blue-100 dark:shadow-none"
                      : "bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {t === "faturacao" ? "Faturação de Clientes" : "Injeção de Energia"}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 font-mono">
              {tipo === "faturacao"
                ? "Colunas: numero_contador · mes_ano (YYYY-MM) · kwh_faturado · valor_cve"
                : "Colunas: subestacao_nome · mes_ano (YYYY-MM) · total_kwh_injetado"}
            </p>
          </div>

          {!preview && !resultado && !loading && (
            <UploadZone onFile={handleFile} />
          )}

          {loading && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center border border-gray-200 dark:border-gray-700/60">
              <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">A processar ficheiro...</p>
              <Skeleton className="h-4 w-48 rounded-md mx-auto mt-4" />
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

    </div>
  );
}
