import { createClient } from "@supabase/supabase-js";
import { verificarApiKey } from "@/lib/api/auth";
import { apiError, apiCors, parsePaginacao } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/api/rateLimit";

/**
 * GET /api/v1/predicoes
 *
 * Parâmetros opcionais:
 *   mes_ano       YYYY-MM
 *   min_score_ml  0.0-1.0 (default 0)
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

  const { allowed, remaining } = checkRateLimit(cliente);
  if (!allowed) return apiError("Rate limit excedido.", 429);

  const { searchParams } = new URL(request.url);
  const { limit, offset, page } = parsePaginacao(searchParams);
  const mes_ano = searchParams.get("mes_ano");
  const min_score_ml = parseFloat(searchParams.get("min_score_ml") ?? "0");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let query = supabase
    .from("ml_predicoes")
    .select(
      `id, score_ml, modelo_versao, features_json, mes_ano, criado_em,
       clientes!inner(id, numero_contador, nome_titular,
         subestacoes!inner(nome, zona_bairro))`,
      { count: "exact" }
    )
    .order("score_ml", { ascending: false })
    .range(offset, offset + limit - 1);

  if (mes_ano) query = query.eq("mes_ano", mes_ano);
  if (min_score_ml > 0) query = query.gte("score_ml", min_score_ml);

  const { data, error, count } = await query;

  if (error) return apiError("Erro ao consultar predições ML", 500);

  return new Response(
    JSON.stringify({ data: data ?? [], meta: { total: count ?? 0, page, limit } }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        "X-RateLimit-Remaining": String(remaining),
      },
    }
  );
}
