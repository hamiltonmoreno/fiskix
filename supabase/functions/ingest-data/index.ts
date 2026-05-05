/**
 * Fiskix Ingest Data — Edge Function
 * Parse e validação de CSV/Excel (faturação ou injeção de energia)
 *
 * POST /ingest-data
 * Content-Type: multipart/form-data
 * Fields: file (File), tipo ('faturacao' | 'injecao'), preview_only? ('true')
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor, corsPreflight } from "../_shared/cors.ts";

interface LinhaFaturacao {
  numero_contador: string;
  mes_ano: string;
  kwh_faturado: number;
  valor_cve: number;
}

interface LinhaInjecao {
  subestacao_nome: string;
  mes_ano: string;
  total_kwh_injetado: number;
}

type ErroValidacao = {
  linha: number;
  campo: string;
  valor: string;
  motivo: string;
};

function validarMesAno(valor: string): boolean {
  return /^\d{4}-\d{2}$/.test(valor) && !isNaN(Date.parse(`${valor}-01`));
}

// Defence-in-depth: even with admin-only ingest, neutralise leading
// formula triggers (=, +, -, @, tab, CR) so a poisoned upstream feed
// can't smuggle =HYPERLINK(...) / =cmd|... payloads through to Excel
// exports downstream. The exporter also sanitises (src/lib/export.ts),
// but stripping at the source means the DB never stores the trap.
function neutralizeFormulaTriggers(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function parseCsvLine(line: string, delim: string): string[] {
  // Minimal RFC-4180 parsing: handle quoted fields containing the delimiter
  // and escaped quotes (`""` inside a quoted field).
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delim) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => neutralizeFormulaTriggers(c.trim()));
}

function parseCsv(texto: string): string[][] {
  // Strip BOM and normalise CRLF/CR → LF before splitting.
  const cleaned = texto.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = cleaned.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  // Detect the delimiter once from the header (whichever appears more often).
  const header = lines[0];
  const semis = (header.match(/;/g) ?? []).length;
  const commas = (header.match(/,/g) ?? []).length;
  const delim = semis > commas ? ";" : ",";
  return lines.map((l) => parseCsvLine(l, delim));
}

function validarFaturacao(rows: string[][]): {
  validos: LinhaFaturacao[];
  erros: ErroValidacao[];
} {
  const validos: LinhaFaturacao[] = [];
  const erros: ErroValidacao[] = [];

  const header = rows[0].map((h) => h.toLowerCase().replace(/\s/g, "_"));
  const idxContador = header.findIndex((h) =>
    h.includes("contador") || h.includes("id_cliente") || h.includes("numero")
  );
  const idxMes = header.findIndex((h) =>
    h.includes("mes") || h.includes("data") || h.includes("periodo")
  );
  const idxKwh = header.findIndex((h) =>
    h.includes("kwh") || h.includes("consumo") || h.includes("energia")
  );
  const idxCve = header.findIndex((h) =>
    h.includes("cve") || h.includes("valor") || h.includes("factura") || h.includes("fatura")
  );

  if (idxContador < 0 || idxMes < 0 || idxKwh < 0 || idxCve < 0) {
    erros.push({
      linha: 0,
      campo: "cabeçalho",
      valor: header.join(","),
      motivo:
        "Colunas obrigatórias não encontradas: numero_contador, mes_ano, kwh_faturado, valor_cve",
    });
    return { validos, erros };
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 4) continue;

    const contador = row[idxContador];
    const mesAno = row[idxMes];
    const kwhStr = row[idxKwh];
    const cveStr = row[idxCve];

    if (!contador) {
      erros.push({ linha: i + 1, campo: "numero_contador", valor: "", motivo: "Campo obrigatório vazio" });
      continue;
    }

    if (!validarMesAno(mesAno)) {
      erros.push({ linha: i + 1, campo: "mes_ano", valor: mesAno, motivo: "Formato inválido (esperado YYYY-MM)" });
      continue;
    }

    const kwh = parseFloat(kwhStr.replace(",", "."));
    if (isNaN(kwh) || kwh < 0) {
      erros.push({ linha: i + 1, campo: "kwh_faturado", valor: kwhStr, motivo: "Valor numérico inválido ou negativo" });
      continue;
    }

    const cve = parseFloat(cveStr.replace(",", "."));
    if (isNaN(cve) || cve < 0) {
      erros.push({ linha: i + 1, campo: "valor_cve", valor: cveStr, motivo: "Valor numérico inválido ou negativo" });
      continue;
    }

    validos.push({ numero_contador: contador, mes_ano: mesAno, kwh_faturado: kwh, valor_cve: cve });
  }

  return { validos, erros };
}

function validarInjecao(rows: string[][]): {
  validos: LinhaInjecao[];
  erros: ErroValidacao[];
} {
  const validos: LinhaInjecao[] = [];
  const erros: ErroValidacao[] = [];

  const header = rows[0].map((h) => h.toLowerCase().replace(/\s/g, "_"));
  const idxSub = header.findIndex((h) =>
    h.includes("subestacao") || h.includes("transformador") || h.includes("pt_")
  );
  const idxMes = header.findIndex((h) => h.includes("mes") || h.includes("data"));
  const idxKwh = header.findIndex((h) => h.includes("kwh") || h.includes("injet"));

  if (idxSub < 0 || idxMes < 0 || idxKwh < 0) {
    erros.push({
      linha: 0,
      campo: "cabeçalho",
      valor: header.join(","),
      motivo: "Colunas obrigatórias: subestacao_nome, mes_ano, total_kwh_injetado",
    });
    return { validos, erros };
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 3) continue;

    const subNome = row[idxSub];
    const mesAno = row[idxMes];
    const kwhStr = row[idxKwh];

    if (!subNome) {
      erros.push({ linha: i + 1, campo: "subestacao_nome", valor: "", motivo: "Campo obrigatório vazio" });
      continue;
    }
    if (!validarMesAno(mesAno)) {
      erros.push({ linha: i + 1, campo: "mes_ano", valor: mesAno, motivo: "Formato inválido (esperado YYYY-MM)" });
      continue;
    }
    const kwh = parseFloat(kwhStr.replace(",", "."));
    if (isNaN(kwh) || kwh <= 0) {
      erros.push({ linha: i + 1, campo: "total_kwh_injetado", valor: kwhStr, motivo: "Valor deve ser positivo" });
      continue;
    }

    validos.push({ subestacao_nome: subNome, mes_ano: mesAno, total_kwh_injetado: kwh });
  }

  return { validos, erros };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return await corsPreflight(req);
  }

  const corsHeaders = await corsHeadersFor(req);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Obter utilizador autenticado
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Restrict CSV ingestion to admin/gestor — the function uses the service
    // role key below to bypass RLS, so without this check any authenticated
    // user (including a fiscal) could upload data and even poison fields
    // with formula triggers that an admin would later export to Excel.
    const { data: profile } = await supabaseAuth
      .from("perfis")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || !["admin_fiskix", "gestor_perdas"].includes(profile.role)) {
      return new Response(
        JSON.stringify({ error: "Sem permissão para importar dados" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const tipo = formData.get("tipo") as "faturacao" | "injecao" | null;
    const previewOnly = formData.get("preview_only") === "true";

    if (!file || !tipo || !["faturacao", "injecao"].includes(tipo)) {
      return new Response(
        JSON.stringify({ error: "file e tipo (faturacao|injecao) são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const texto = await file.text();
    const rows = parseCsv(texto);

    if (rows.length < 2) {
      return new Response(
        JSON.stringify({ error: "Ficheiro vazio ou com apenas cabeçalho" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let resultado: { validos: unknown[]; erros: ErroValidacao[] } = { validos: [], erros: [] };

    if (tipo === "faturacao") {
      resultado = validarFaturacao(rows);
    } else {
      resultado = validarInjecao(rows);
    }

    const preview = rows.slice(0, 11); // header + 10 linhas

    if (previewOnly) {
      return new Response(
        JSON.stringify({
          preview,
          total: rows.length - 1,
          validos: resultado.validos.length,
          erros_count: resultado.erros.length,
          erros: resultado.erros.slice(0, 20),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inserir dados válidos
    let inseridos = 0;
    const errosInsercao: ErroValidacao[] = [];

    if (tipo === "faturacao") {
      const validosFat = resultado.validos as LinhaFaturacao[];

      // Buscar IDs dos clientes pelo numero_contador
      const contadores = [...new Set(validosFat.map((v) => v.numero_contador))];
      const { data: clientesDb } = await supabase
        .from("clientes")
        .select("id, numero_contador")
        .in("numero_contador", contadores);

      const clienteMap: Record<string, string> = {};
      for (const c of (clientesDb ?? [])) {
        clienteMap[c.numero_contador] = c.id;
      }

      const registos = validosFat
        .map((v, i) => {
          const id_cliente = clienteMap[v.numero_contador];
          if (!id_cliente) {
            errosInsercao.push({
              linha: i + 2,
              campo: "numero_contador",
              valor: v.numero_contador,
              motivo: "Contador não encontrado na base de dados",
            });
            return null;
          }
          return {
            id_cliente,
            mes_ano: v.mes_ano,
            kwh_faturado: v.kwh_faturado,
            valor_cve: v.valor_cve,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (registos.length > 0) {
        const { error } = await supabase
          .from("faturacao_clientes")
          .upsert(registos, { onConflict: "id_cliente,mes_ano" });

        if (!error) inseridos = registos.length;
        else errosInsercao.push({ linha: 0, campo: "db", valor: "", motivo: error.message });
      }
    } else {
      const validosInj = resultado.validos as LinhaInjecao[];

      const nomes = [...new Set(validosInj.map((v) => v.subestacao_nome))];
      const { data: subDb } = await supabase
        .from("subestacoes")
        .select("id, nome")
        .in("nome", nomes);

      const subMap: Record<string, string> = {};
      for (const s of (subDb ?? [])) {
        subMap[s.nome] = s.id;
      }

      const registos = validosInj
        .map((v, i) => {
          const id_subestacao = subMap[v.subestacao_nome];
          if (!id_subestacao) {
            errosInsercao.push({
              linha: i + 2,
              campo: "subestacao_nome",
              valor: v.subestacao_nome,
              motivo: "Subestação não encontrada na base de dados",
            });
            return null;
          }
          return { id_subestacao, mes_ano: v.mes_ano, total_kwh_injetado: v.total_kwh_injetado };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (registos.length > 0) {
        const { error } = await supabase
          .from("injecao_energia")
          .upsert(registos, { onConflict: "id_subestacao,mes_ano" });

        if (!error) inseridos = registos.length;
        else errosInsercao.push({ linha: 0, campo: "db", valor: "", motivo: error.message });
      }
    }

    const totalErros = resultado.erros.length + errosInsercao.length;

    // Log da importação
    await supabase.from("importacoes").insert({
      id_utilizador: user.id,
      tipo,
      nome_ficheiro: file.name,
      total_registos: rows.length - 1,
      registos_sucesso: inseridos,
      registos_erro: totalErros,
      erros_json: totalErros > 0 ? { validacao: resultado.erros, insercao: errosInsercao } : null,
    });

    return new Response(
      JSON.stringify({
        total: rows.length - 1,
        sucesso: inseridos,
        erros: totalErros,
        detalhes_erros: [...resultado.erros, ...errosInsercao].slice(0, 50),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro na ingestão:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
