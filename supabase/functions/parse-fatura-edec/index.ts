/**
 * parse-fatura-edec — Edge Function
 *
 * Recebe uma fatura EDEC em diferentes formatos e devolve campos
 * canónicos (mesmo schema do `clientes` + `faturacao_clientes` pós-021).
 *
 * Provider escolhido em runtime via `configuracoes.ocr_provider`:
 *   - "text-paste"    → user enviou texto cru, regex parser puro (gratuito)
 *   - "claude-vision" → user enviou imagem base64, chamamos Claude Vision API
 *
 * Body esperado:
 *   { mode: "text", text: string }     — funciona com qualquer provider
 *   { mode: "image", image_base64: string, mime_type: string }
 *                                       — apenas claude-vision
 *
 * Response:
 *   {
 *     parsed: ParsedFatura,
 *     provider_used: "text-paste" | "claude-vision",
 *     warnings: string[]
 *   }
 *
 * Acesso restrito a admin_fiskix + gestor_perdas.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor, corsPreflight } from "../_shared/cors.ts";
import { parseFaturaEdec, type ParsedFatura } from "./parser.ts";

type Provider = "text-paste" | "claude-vision";
type Mode = "text" | "image";

interface RequestBody {
  mode: Mode;
  text?: string;
  image_base64?: string;
  mime_type?: string;
}

const ALLOWED_ROLES = ["admin_fiskix", "gestor_perdas"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return await corsPreflight(req);
  const corsHeaders = await corsHeadersFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return json({ error: "Token inválido" }, 401);

    const { data: profile } = await supabaseAuth
      .from("perfis")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return json({ error: "Sem permissão para parsear faturas" }, 403);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Provider config
    const { data: configRows } = await supabase
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", ["ocr_provider", "ocr_claude_api_key", "ocr_claude_model"]);
    const cfg: Record<string, string> = {};
    for (const r of configRows ?? []) cfg[r.chave] = r.valor ?? "";
    const provider = (cfg.ocr_provider || "text-paste") as Provider;

    const body = (await req.json()) as RequestBody;

    if (provider === "text-paste") {
      if (body.mode !== "text" || !body.text?.trim()) {
        return json({
          error: "Provider text-paste requer { mode: 'text', text: '...' }",
        }, 400);
      }
      const parsed = parseFaturaEdec(body.text);
      return json({ parsed, provider_used: "text-paste", warnings: parsed.warnings });
    }

    if (provider === "claude-vision") {
      const apiKey = cfg.ocr_claude_api_key?.trim();
      if (!apiKey) {
        return json({
          error: "Provider claude-vision activo mas ocr_claude_api_key vazia em configuracoes",
        }, 503);
      }
      if (body.mode !== "image" || !body.image_base64 || !body.mime_type) {
        return json({
          error: "Provider claude-vision requer { mode: 'image', image_base64, mime_type }",
        }, 400);
      }
      const parsed = await callClaudeVision(
        body.image_base64,
        body.mime_type,
        apiKey,
        cfg.ocr_claude_model || "claude-haiku-4-5",
      );
      return json({ parsed, provider_used: "claude-vision", warnings: parsed.warnings });
    }

    return json({ error: `Provider desconhecido: ${provider}` }, 500);
  } catch (error) {
    console.error("parse-fatura-edec erro:", error);
    return json({ error: String(error) }, 500);
  }
});

/**
 * Provider claude-vision — chama Anthropic Messages API com a imagem
 * e prompt estruturado. Devolve ParsedFatura.
 *
 * Nota: este código está pronto para usar mas só é exercitado quando
 * `ocr_provider` é mudado para "claude-vision" no admin. Mantemos o stub
 * funcional para que o user possa testar trocando a config quando quiser.
 */
async function callClaudeVision(
  imageBase64: string,
  mimeType: string,
  apiKey: string,
  model: string,
): Promise<ParsedFatura> {
  const prompt = `Extrai os campos desta fatura EDEC (Cabo Verde) e devolve APENAS um JSON com a seguinte estrutura. Usa null para campos que não consegues extrair com confiança. Não incluas explicação fora do JSON.

{
  "nif": string | null,
  "cil": string | null,
  "numero_conta": string | null,
  "numero_contador": string | null,
  "nome_titular": string | null,
  "morada": string | null,
  "unidade_comercial": string | null,
  "potencia_contratada_w": number | null,
  "tipo_tarifa": string | null,
  "numero_fatura": string | null,
  "mes_ano": string | null,
  "periodo_inicio": string | null,
  "periodo_fim": string | null,
  "tipo_leitura": "real" | "estimada" | "empresa" | "cliente" | null,
  "leitura_inicial": number | null,
  "leitura_final": number | null,
  "kwh_faturado": number | null,
  "valor_cve": number | null,
  "saldo_anterior_cve": number | null,
  "saldo_atual_cve": number | null
}

Notas:
- Vírgula portuguesa (1.839,00) → 1839
- Datas formato YYYY-MM-DD
- mes_ano formato YYYY-MM (do mês de emissão)
- potencia em watts (6.6 kW = 6600)`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType, data: imageBase64 },
          },
          { type: "text", text: prompt },
        ],
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const content = data?.content?.[0]?.text ?? "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Resposta Claude sem JSON válido");
  }
  const parsed = JSON.parse(jsonMatch[0]) as Omit<ParsedFatura, "warnings">;
  return { ...parsed, warnings: [] };
}
