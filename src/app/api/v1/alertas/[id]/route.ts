import { createClient } from "@supabase/supabase-js";
import { verificarApiKey } from "@/lib/api/auth";
import { apiError, apiCors } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/api/rateLimit";

/**
 * GET /api/v1/alertas/:id
 *
 * Retorna o detalhe de um alerta com motivo e dados do cliente.
 * Headers: Authorization: Bearer <api_key>
 */
export async function OPTIONS() {
  return apiCors();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cliente = await verificarApiKey(request);
  if (!cliente) return apiError("API key inválida ou ausente", 401);

  const { allowed, remaining } = checkRateLimit(cliente);
  if (!allowed) return apiError("Rate limit excedido.", 429);

  const { id } = await params;

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

  if (error || !data) return apiError("Alerta não encontrado", 404);

  return new Response(
    JSON.stringify({ data }),
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
