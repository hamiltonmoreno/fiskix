import { createClient } from "@supabase/supabase-js";
import { verificarApiKey } from "@/lib/api/auth";
import { apiError, apiCors } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/api/rateLimit";
import { corsHeadersFor } from "@/lib/api/cors";
import { getClientIp } from "@/lib/api/client-ip";
import { AlertaIdParamSchema, parseParams } from "@/lib/api/schemas";

/**
 * GET /api/v1/alertas/:id
 *
 * Retorna o detalhe de um alerta com motivo e dados do cliente.
 * Headers: Authorization: Bearer <api_key>
 */
export async function OPTIONS(request: Request) {
  return apiCors(request);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cliente = await verificarApiKey(request);
  if (!cliente) {
    const ip = getClientIp(request);
    const rl = await checkRateLimit(`unauth:${ip}`);
    if (!rl.allowed) return apiError("Rate limit exceeded", 429, request);
    return apiError("API key inválida ou ausente", 401, request);
  }

  const { allowed, remaining } = await checkRateLimit(`key:${cliente}`);
  if (!allowed) return apiError("Rate limit excedido.", 429, request);

  const rawParams = await params;
  const parsed = parseParams(AlertaIdParamSchema, rawParams);
  if (!parsed.ok) {
    return apiError("ID inválido", 400, request, parsed.errors);
  }
  const { id } = parsed.data;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase
    .from("alertas_fraude")
    .select(
      `id, score_risco, status, resultado, motivo, mes_ano, criado_em, atualizado_em,
       clientes!inner(
         id, numero_contador, nome_titular, tipo_tarifa, morada, telemovel,
         subestacoes!inner(id, nome, zona_bairro, ilha)
       )`
    )
    .eq("id", id)
    .single();

  if (error || !data) return apiError("Alerta não encontrado", 404, request);

  const corsHeaders = await corsHeadersFor(request);
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "X-RateLimit-Remaining": String(remaining),
    },
  });
}
