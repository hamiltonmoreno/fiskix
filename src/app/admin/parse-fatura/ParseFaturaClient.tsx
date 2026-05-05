"use client";

import { useState } from "react";
import Link from "next/link";
import { ScanText, AlertTriangle, CheckCircle, Settings, Image as ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { haptics } from "@/lib/haptics";
import type { ParsedFatura } from "@/lib/parsers/fatura-edec";

interface Props {
  provider: "text-paste" | "claude-vision";
  claudeReady: boolean;
}

interface ParseResponse {
  parsed: ParsedFatura;
  provider_used: string;
  warnings: string[];
}

export function ParseFaturaClient({ provider, claudeReady }: Props) {
  const supabase = createClient();
  const [text, setText] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  async function handleParse() {
    setParsing(true);
    setParseError(null);
    setParseResult(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("Sem sessão activa");

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/parse-fatura-edec`;
      const body =
        provider === "claude-vision"
          ? { mode: "image", image_base64: imageBase64, mime_type: mimeType }
          : { mode: "text", text };

      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setParseError(data?.error || `HTTP ${response.status}`);
      } else {
        setParseResult(data);
      }
    } catch (e) {
      setParseError(String(e));
    } finally {
      setParsing(false);
    }
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageName(file.name);
    setMimeType(file.type);
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
    setImageBase64(btoa(binary));
  }

  async function handleImport() {
    if (!parseResult?.parsed) return;
    const p = parseResult.parsed;
    if (!p.numero_contador || !p.mes_ano || p.kwh_faturado === null || p.valor_cve === null) {
      setImportMsg("Faltam campos obrigatórios (numero_contador, mes_ano, kwh, valor).");
      return;
    }
    setImporting(true);
    setImportMsg(null);
    try {
      const { data: cliente } = await supabase
        .from("clientes")
        .select("id")
        .eq("numero_contador", p.numero_contador)
        .maybeSingle();
      if (!cliente) {
        setImportMsg(`Contador ${p.numero_contador} não existe em clientes. Adiciona-o primeiro.`);
        return;
      }
      const enrichClient: Partial<{ nif: string; cil: string; numero_conta: string; unidade_comercial: string; potencia_contratada_w: number }> = {};
      if (p.nif) enrichClient.nif = p.nif;
      if (p.cil) enrichClient.cil = p.cil;
      if (p.numero_conta) enrichClient.numero_conta = p.numero_conta;
      if (p.unidade_comercial) enrichClient.unidade_comercial = p.unidade_comercial;
      if (p.potencia_contratada_w !== null) enrichClient.potencia_contratada_w = p.potencia_contratada_w;
      if (Object.keys(enrichClient).length > 0) {
        await supabase.from("clientes").update(enrichClient).eq("id", cliente.id);
      }

      const fatura = {
        id_cliente: cliente.id,
        mes_ano: p.mes_ano,
        kwh_faturado: p.kwh_faturado,
        valor_cve: p.valor_cve,
        ...(p.numero_fatura ? { numero_fatura: p.numero_fatura } : {}),
        ...(p.tipo_leitura ? { tipo_leitura: p.tipo_leitura } : {}),
        ...(p.leitura_inicial !== null ? { leitura_inicial: p.leitura_inicial } : {}),
        ...(p.leitura_final !== null ? { leitura_final: p.leitura_final } : {}),
        ...(p.saldo_anterior_cve !== null ? { saldo_anterior_cve: p.saldo_anterior_cve } : {}),
        ...(p.saldo_atual_cve !== null ? { saldo_atual_cve: p.saldo_atual_cve } : {}),
        ...(p.periodo_inicio ? { periodo_inicio: p.periodo_inicio } : {}),
        ...(p.periodo_fim ? { periodo_fim: p.periodo_fim } : {}),
      };

      const { error } = await supabase.from("faturacao_clientes").upsert(fatura, { onConflict: "id_cliente,mes_ano" });
      if (error) {
        setImportMsg(`Erro ao gravar fatura: ${error.message}`);
      } else {
        setImportMsg("Fatura importada com sucesso.");
      }
    } finally {
      setImporting(false);
    }
  }

  const canParse = provider === "text-paste" ? text.trim().length > 50 : !!imageBase64;
  const providerWarning = provider === "claude-vision" && !claudeReady;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <ScanText className="w-6 h-6 text-purple-600" />
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">Parser de Faturas EDEC</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Provider activo: <strong>{provider}</strong>
          {" · "}
          <Link href="/admin/configuracao" className="text-blue-600 hover:underline inline-flex items-center gap-1">
            <Settings className="w-3 h-3" /> trocar
          </Link>
        </p>
      </div>

      {providerWarning && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Provider <code>claude-vision</code> activo mas sem API key. Configura em <Link href="/admin/configuracao" className="underline">/admin/configuracao</Link>.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700/60 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">
            {provider === "text-paste" ? "1. Cola o texto da fatura" : "1. Upload da imagem"}
          </h2>

          {provider === "text-paste" ? (
            <textarea
              rows={18}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Cola aqui o texto integral da fatura EDEC (NIF, CIL, contador, leituras, valores...)"
              className="w-full font-mono text-xs px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-500">{imageName ?? "Escolher imagem (PNG/JPG)"}</span>
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleImageSelect} />
            </label>
          )}

          <button
            onClick={() => { haptics.medium(); handleParse(); }}
            disabled={!canParse || parsing || providerWarning}
            className="mt-4 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg font-semibold text-sm transition-colors cursor-pointer"
          >
            {parsing ? "A processar..." : "Processar fatura"}
          </button>

          {parseError && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-500/10 rounded-lg text-xs text-red-700 dark:text-red-400 border border-red-100 dark:border-red-500/20">
              {parseError}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700/60 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">2. Preview dos campos extraídos</h2>

          {!parseResult ? (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">Aguardando processamento</div>
          ) : (
            <>
              {parseResult.warnings.length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg text-xs text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20">
                  <strong>Avisos:</strong> {parseResult.warnings.join(", ")}
                </div>
              )}

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {Object.entries(parseResult.parsed)
                  .filter(([k]) => k !== "warnings")
                  .map(([k, v]) => (
                    <div key={k} className="flex flex-col py-1 border-b border-gray-100 dark:border-gray-700/60 last:border-0">
                      <dt className="text-xs sm:text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{k}</dt>
                      <dd className={`font-mono text-xs ${v === null ? "text-gray-300" : "text-gray-900 dark:text-gray-100"}`}>
                        {v === null ? "—" : String(v)}
                      </dd>
                    </div>
                  ))}
              </dl>

              <button
                onClick={() => { haptics.medium(); handleImport(); }}
                disabled={importing || !parseResult.parsed.numero_contador}
                className="mt-5 w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg font-semibold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {importing ? "A importar..." : "Importar para a base de dados"}
              </button>

              {importMsg && (
                <div className={`mt-3 p-3 rounded-lg text-xs border ${
                  importMsg.toLowerCase().includes("sucesso")
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20"
                    : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-100 dark:border-red-500/20"
                }`}>{importMsg}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
