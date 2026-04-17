"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { HistoricoItem, PreviewResult, ImportResult } from "./types";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".csv", ".xls", ".xlsx"]);
const ALLOWED_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

function makeFileError(motivo: string, valor = ""): PreviewResult {
  return { preview: [], total: 0, validos: 0, erros_count: 1, erros: [{ linha: 0, campo: "ficheiro", valor, motivo }] };
}

export function useImportarDados(historicoInicial: HistoricoItem[]) {
  const [tipo, setTipo] = useState<"faturacao" | "injecao">("faturacao");
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [resultado, setResultado] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState(historicoInicial);
  const supabase = createClient();

  async function handleFile(file: File) {
    const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;

    if (!ALLOWED_EXTENSIONS.has(ext) || (!file.type || !ALLOWED_MIME_TYPES.has(file.type)) && file.type) {
      setFicheiro(null);
      setPreview(makeFileError("Formato inválido. Use CSV, XLS ou XLSX.", file.name));
      setResultado(null);
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setFicheiro(null);
      setPreview(makeFileError("Ficheiro excede o limite de 10MB.", file.name));
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

      setPreview(await res.json());
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

      setResultado(await res.json().catch(() => ({ total: 0, sucesso: 0, erros: 1 })));
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

  return { tipo, setTipo, ficheiro, preview, setPreview, setFicheiro, resultado, setResultado, loading, historico, handleFile, handleImportar };
}
