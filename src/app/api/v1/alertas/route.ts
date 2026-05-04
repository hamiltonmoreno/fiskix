import { createClient } from "@supabase/supabase-js";
import { verificarApiKey } from "@/lib/api/auth";
import { apiError, apiCors, parsePaginacao } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/api/rateLimit";

/**
 * GET /api/v1/alertas
 *
 * Parâmetros opcionais:
 *   mes_ano       YYYY-MM
 *   status        Pendente | Notificado_SMS | Pendente_Inspecao | Inspecionado
 *   min_score     0-100
 *   subestacao_id UUID
 *   limit         1-100 (default 50)
 *   page          1+ (default 1)
 *
 * Headers: Authorization: Bearer <api_key>
 */
export async function OPTIONS() {
  return apiCors();
}

export async function GET(request: Request) {
  const cliente = await verificarApiKey(request);
  if (!cliente) return apiError("API key inválida ou ausente", 401);

  const { allowed, remaining, resetAt } = checkRateLimit(cliente);
  if (!allowed) {
    return apiError("Rate limit excedido. Tente novamente em breve.", 429);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { searchParams } = new URL(request.url);
  const { limit, offset, page } = parsePaginacao(searchParams);
  const mes_ano = searchParams.get("mes_ano");
  const status = searchParams.get("status");
  const min_score = searchParams.get("min_score");
  const subestacao_id = searchParams.get("subestacao_id");

  let query = supabase
    .from("alertas_fraude")
    .select(
      `id, score_risco, status, resultado, mes_ano, criado_em,
       clientes!inner(id, numero_contador, nome_titular, tipo_tarifa,
         subestacoes!inner(id, nome, zona_bairro))`,
      { count: "exact" }
    )
    .order("score_risco", { ascending: false })
    .range(offset, offset + limit - 1);

  if (mes_ano) query = query.eq("mes_ano", mes_ano);
  if (status) query = query.eq("status", status);
  if (min_score) query = query.gte("score_risco", parseInt(min_score));
  if (subestacao_id) query = query.eq("clientes.subestacoes.id", subestacao_id);

  const { data, error, count } = await query;

  if (error) return apiError("Erro ao consultar alertas", 500);

  const headers: Record<string, string> = {
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.floor(resetAt / 1000)),
  };

  return new Response(
    JSON.stringify({
      data: data ?? [],
      meta: { total: count ?? 0, page, limit },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        ...headers,
      },
    }
  );
}
