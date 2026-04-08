import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron route: executa o motor de scoring para todas as subestações ativas.
 * Chamado automaticamente no dia 1 de cada mês às 02:00 UTC (via Vercel Cron).
 *
 * Protegido por CRON_SECRET — Vercel injeta o header Authorization automaticamente.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET não configurado" },
      { status: 500 }
    );
  }

  // Verificar autorização do cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SUPABASE_URL não configurada" },
      { status: 500 }
    );
  }

  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY não configurada" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Calcular mês atual no formato YYYY-MM
  const now = new Date();
  const mesAno = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Obter todas as subestações ativas
  const { data: subestacoes, error: subError } = await supabase
    .from("subestacoes")
    .select("id, nome")
    .eq("ativo", true);

  if (subError || !subestacoes) {
    return NextResponse.json(
      { error: "Erro ao obter subestações", detail: subError?.message },
      { status: 500 }
    );
  }

  const resultados: Array<{
    subestacao_id: string;
    nome: string;
    alertas_gerados?: number;
    perda_pct?: string;
    error?: string;
  }> = [];

  // Chamar scoring-engine para cada subestação
  for (const sub of subestacoes) {
    try {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/scoring-engine`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ subestacao_id: sub.id, mes_ano: mesAno }),
        }
      );

      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      resultados.push({
        subestacao_id: sub.id,
        nome: sub.nome,
        alertas_gerados: data.alertas_gerados ?? 0,
        perda_pct: data.perda_pct,
        error: data.error,
      });
    } catch (err) {
      resultados.push({
        subestacao_id: sub.id,
        nome: sub.nome,
        error: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }

  const totalAlertas = resultados.reduce((s, r) => s + (r.alertas_gerados ?? 0), 0);
  const erros = resultados.filter((r) => r.error);

  console.log(
    `[cron/scoring] ${mesAno} — ${subestacoes.length} subestações, ${totalAlertas} alertas gerados, ${erros.length} erros`
  );

  return NextResponse.json({
    mes_ano: mesAno,
    subestacoes_processadas: subestacoes.length,
    total_alertas_gerados: totalAlertas,
    erros: erros.length,
    resultados,
  });
}
