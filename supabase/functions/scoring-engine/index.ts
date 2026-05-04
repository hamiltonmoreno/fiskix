/**
 * Fiskix Scoring Engine — Edge Function
 * Deno / Supabase Edge Functions
 *
 * POST /scoring-engine
 * Body: { subestacao_id: string, mes_ano: string }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const start = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { subestacao_id, mes_ano } = await req.json();

    if (!subestacao_id || !mes_ano) {
      return new Response(
        JSON.stringify({ error: "subestacao_id e mes_ano são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Carregar limiares configuráveis
    const { data: configRows } = await supabase
      .from("configuracoes")
      .select("chave, valor");

    const config: Record<string, number> = {};
    for (const row of (configRows ?? [])) {
      config[row.chave] = parseFloat(row.valor);
    }

    const limiares = {
      limiar_queda_pct: config.limiar_queda_pct ?? 30,
      limiar_cv_maximo: config.limiar_cv_maximo ?? 0.03,
      limiar_mu_minimo: config.limiar_mu_minimo ?? 15,
      limiar_zscore_cluster: config.limiar_zscore_cluster ?? -2,
      limiar_div_sazonal: config.limiar_div_sazonal ?? 20,
      limiar_slope_tendencia: config.limiar_slope_tendencia ?? -5,
      limiar_ratio_racio: config.limiar_ratio_racio ?? 2,
      limiar_pico_ratio: config.limiar_pico_ratio ?? 0.20,
      limiar_perda_zona_pct: config.limiar_perda_zona_pct ?? 15,
    };

    // 2. ETAPA A: Balanço Energético
    const { data: injecao } = await supabase
      .from("injecao_energia")
      .select("total_kwh_injetado")
      .eq("id_subestacao", subestacao_id)
      .eq("mes_ano", mes_ano)
      .single();

    if (!injecao) {
      return new Response(
        JSON.stringify({ error: `Sem dados de injeção para ${subestacao_id} em ${mes_ano}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clientes da subestação
    const { data: clientes } = await supabase
      .from("clientes")
      .select("id, numero_contador, nome_titular, tipo_tarifa, id_subestacao")
      .eq("id_subestacao", subestacao_id)
      .eq("ativo", true);

    if (!clientes || clientes.length === 0) {
      return new Response(
        JSON.stringify({ message: "Sem clientes ativos nesta subestação", scored: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clienteIds = clientes.map((c) => c.id);

    // Faturação do mês atual para calcular total faturado
    const { data: faturacaoMes } = await supabase
      .from("faturacao_clientes")
      .select("id_cliente, kwh_faturado, valor_cve")
      .eq("mes_ano", mes_ano)
      .in("id_cliente", clienteIds);

    const totalFaturado = (faturacaoMes ?? []).reduce(
      (s, f) => s + f.kwh_faturado,
      0
    );

    const kwh_injetado = injecao.total_kwh_injetado;
    const perda_pct = kwh_injetado > 0
      ? ((kwh_injetado - totalFaturado) / kwh_injetado) * 100
      : 0;
    const zona_vermelha = perda_pct > limiares.limiar_perda_zona_pct;
    const multiplicador_zona = zona_vermelha
      ? 1 + Math.min(0.3, ((perda_pct / 100) - (limiares.limiar_perda_zona_pct / 100)) * 2)
      : 1.0;

    // Se zona não é vermelha, não pontuar clientes individuais
    if (!zona_vermelha) {
      return new Response(
        JSON.stringify({
          subestacao_id,
          mes_ano,
          perda_pct: perda_pct.toFixed(2),
          zona_vermelha: false,
          multiplicador_zona: 1.0,
          message: "Zona verde — sem scoring individual necessário",
          duracao_ms: Date.now() - start,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. ETAPA B: Histórico de faturação (36 meses) para scoring
    const { data: faturacaoHistorico } = await supabase
      .from("faturacao_clientes")
      .select("id_cliente, mes_ano, kwh_faturado, valor_cve")
      .in("id_cliente", clienteIds)
      .order("mes_ano", { ascending: true });

    // Alertas anteriores por cliente (não falso-positivos, últimos 12 meses)
    const [year, month] = mes_ano.split("-").map(Number);
    const mes12Atras = new Date(year, month - 12, 1);
    const mes12AtrasFmt = `${mes12Atras.getFullYear()}-${String(mes12Atras.getMonth() + 1).padStart(2, "0")}`;

    const { data: alertasHist } = await supabase
      .from("alertas_fraude")
      .select("id_cliente, resultado")
      .in("id_cliente", clienteIds)
      .gte("mes_ano", mes12AtrasFmt)
      .lt("mes_ano", mes_ano)
      .in("resultado", ["Fraude_Confirmada", "Anomalia_Tecnica"]);

    const alertasPorCliente: Record<string, number> = {};
    for (const a of (alertasHist ?? [])) {
      alertasPorCliente[a.id_cliente] = (alertasPorCliente[a.id_cliente] ?? 0) + 1;
    }

    // 4. Calcular info de cluster por tipo de tarifa
    const faturacaoMesMap: Record<string, { kwh: number; cve: number }> = {};
    for (const f of (faturacaoMes ?? [])) {
      faturacaoMesMap[f.id_cliente] = { kwh: f.kwh_faturado, cve: f.valor_cve };
    }

    const clusterPorTarifa: Record<string, number[]> = {};
    for (const c of clientes) {
      const f = faturacaoMesMap[c.id];
      if (f) {
        if (!clusterPorTarifa[c.tipo_tarifa]) clusterPorTarifa[c.tipo_tarifa] = [];
        clusterPorTarifa[c.tipo_tarifa].push(f.kwh);
      }
    }

    function calcMediana(arr: number[]): number {
      if (arr.length === 0) return 0;
      const s = [...arr].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2;
    }

    function calcMAD(arr: number[], med: number): number {
      return calcMediana(arr.map((v) => Math.abs(v - med)));
    }

    // Tendência subestação (variação mês a mês)
    const mesAnterior = (() => {
      const [y, m] = mes_ano.split("-").map(Number);
      const d = new Date(y, m - 2, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();

    const { data: injecaoAnt } = await supabase
      .from("injecao_energia")
      .select("total_kwh_injetado")
      .eq("id_subestacao", subestacao_id)
      .eq("mes_ano", mesAnterior)
      .single();

    const tendenciaSubestacao = injecaoAnt?.total_kwh_injetado
      ? ((kwh_injetado - injecaoAnt.total_kwh_injetado) / injecaoAnt.total_kwh_injetado) * 100
      : 0;

    // 5. Pontuar cada cliente
    const alertasParaInserir = [];

    for (const cliente of clientes) {
      const fHist = (faturacaoHistorico ?? [])
        .filter((f) => f.id_cliente === cliente.id)
        .map((f) => ({ mes_ano: f.mes_ano, kwh_faturado: f.kwh_faturado, valor_cve: f.valor_cve }));

      const fAtual = faturacaoMesMap[cliente.id];
      if (!fAtual || fHist.length < 3) continue;

      // Cluster info para este cliente
      const grupoTarifa = clusterPorTarifa[cliente.tipo_tarifa] ?? [];
      const med = calcMediana(grupoTarifa);
      const madVal = calcMAD(grupoTarifa, med);

      // Rácio CVE/kWh do cluster
      const raciosPorTarifa = clientes
        .filter((c) => c.tipo_tarifa === cliente.tipo_tarifa)
        .map((c) => {
          const fm = faturacaoMesMap[c.id];
          return fm && fm.kwh > 0 ? fm.cve / fm.kwh : null;
        })
        .filter((r): r is number => r !== null);

      const mediaRacio = raciosPorTarifa.length
        ? raciosPorTarifa.reduce((s, r) => s + r, 0) / raciosPorTarifa.length
        : 0;
      // R6 needs at least 3 customers in the same tariff group to compute a
      // meaningful sigma; below that, leave it as 0 so the rule is bypassed
      // (avoids the previous fallback `sigma=1` triggering on tiny clusters).
      const sigmaRacio = raciosPorTarifa.length >= 3
        ? Math.sqrt(
          raciosPorTarifa.reduce((s, r) => s + Math.pow(r - mediaRacio, 2), 0) /
          raciosPorTarifa.length
        )
        : 0;

      // Executar as 9 regras inline (versão simplificada para Edge Function)
      const regras = [];
      let score_base = 0;

      // R1: Queda Súbita
      {
        const sorted = fHist.slice().sort((a, b) => a.mes_ano.localeCompare(b.mes_ano));
        const idx = sorted.findIndex((f) => f.mes_ano === mes_ano);
        if (idx >= 3) {
          const wSize = Math.min(idx, 6);
          const hist = sorted.slice(idx - wSize, idx);
          const media = hist.reduce((s, f) => s + f.kwh_faturado, 0) / hist.length;
          const atual = sorted[idx].kwh_faturado;
          if (media > 0) {
            const delta = ((media - atual) / media) * 100;
            const limiar = limiares.limiar_queda_pct;
            if (delta >= limiar) {
              const pts = Math.min(25, Math.floor((delta - limiar) * 0.625));
              score_base += pts;
              regras.push({ regra: "R1", pontos: pts, descricao: `Queda de ${delta.toFixed(1)}% vs média ${wSize} meses`, valor: delta, threshold: limiar });
            } else {
              regras.push({ regra: "R1", pontos: 0, descricao: `Queda de ${delta.toFixed(1)}% — normal` });
            }
          }
        }
      }

      // R2: Variância Zero
      {
        const sorted = fHist.slice().sort((a, b) => a.mes_ano.localeCompare(b.mes_ano));
        const idx = sorted.findIndex((f) => f.mes_ano === mes_ano);
        if (idx >= 4) {
          const janela = sorted.slice(idx - 3, idx + 1).map((f) => f.kwh_faturado);
          const media = janela.reduce((s, v) => s + v, 0) / janela.length;
          if (media > limiares.limiar_mu_minimo) {
            const variancia = janela.reduce((s, v) => s + Math.pow(v - media, 2), 0) / janela.length;
            const cv = Math.sqrt(variancia) / media;
            if (cv < limiares.limiar_cv_maximo) {
              const pts = Math.min(15, Math.round((1 - cv / limiares.limiar_cv_maximo) * 15));
              score_base += pts;
              regras.push({ regra: "R2", pontos: pts, descricao: `Contador anormalmente constante (CV=${cv.toFixed(4)})`, valor: cv, threshold: limiares.limiar_cv_maximo });
            } else {
              regras.push({ regra: "R2", pontos: 0, descricao: "Variação normal" });
            }
          }
        }
      }

      // R3: Desvio Cluster
      {
        if (madVal > 0) {
          const z = (fAtual.kwh - med) / madVal;
          if (z < limiares.limiar_zscore_cluster) {
            const pts = Math.min(20, Math.round(Math.abs(z - limiares.limiar_zscore_cluster) * 5));
            score_base += pts;
            regras.push({ regra: "R3", pontos: pts, descricao: `Z-score ${z.toFixed(2)} abaixo da mediana da tarifa`, valor: z, threshold: limiares.limiar_zscore_cluster });
          } else {
            regras.push({ regra: "R3", pontos: 0, descricao: `Z-score ${z.toFixed(2)} — normal` });
          }
        }
      }

      // R4: Divergência Sazonal
      {
        const sorted = fHist.slice().sort((a, b) => a.mes_ano.localeCompare(b.mes_ano));
        const idx = sorted.findIndex((f) => f.mes_ano === mes_ano);
        if (idx >= 2) {
          const atual = sorted[idx].kwh_faturado;
          const ant = sorted[idx - 1].kwh_faturado;
          if (ant > 0) {
            const tendCli = ((atual - ant) / ant) * 100;
            const div = tendenciaSubestacao - tendCli;
            if (div > limiares.limiar_div_sazonal) {
              const pts = Math.min(15, Math.round((div - limiares.limiar_div_sazonal) * 0.5));
              score_base += pts;
              regras.push({ regra: "R4", pontos: pts, descricao: `Divergência sazonal ${div.toFixed(1)}%`, valor: div, threshold: limiares.limiar_div_sazonal });
            } else {
              regras.push({ regra: "R4", pontos: 0, descricao: `Divergência ${div.toFixed(1)}% — normal` });
            }
          }
        }
      }

      // R5: Tendência Descendente
      {
        const sorted = fHist.slice().sort((a, b) => a.mes_ano.localeCompare(b.mes_ano));
        const idx = sorted.findIndex((f) => f.mes_ano === mes_ano);
        if (idx >= 6) {
          const janela = sorted.slice(idx - 5, idx + 1);
          const n = janela.length;
          const xs = janela.map((_, i) => i);
          const ys = janela.map((f) => f.kwh_faturado);
          const sumX = xs.reduce((s, x) => s + x, 0);
          const sumY = ys.reduce((s, y) => s + y, 0);
          const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
          const sumX2 = xs.reduce((s, x) => s + x * x, 0);
          const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
          let meses = 0;
          for (let i = janela.length - 1; i > 0; i--) {
            if (janela[i].kwh_faturado < janela[i - 1].kwh_faturado) meses++;
            else break;
          }
          if (slope < limiares.limiar_slope_tendencia && meses >= 3) {
            const pts = Math.min(10, Math.round(Math.abs(slope - limiares.limiar_slope_tendencia) * 0.8));
            score_base += pts;
            regras.push({ regra: "R5", pontos: pts, descricao: `Slow bleed: ${slope.toFixed(1)} kWh/mês por ${meses} meses`, valor: slope, threshold: limiares.limiar_slope_tendencia });
          } else {
            regras.push({ regra: "R5", pontos: 0, descricao: "Sem tendência descendente persistente" });
          }
        }
      }

      // R6: Rácio CVE/kWh
      {
        if (fAtual.kwh > 0 && sigmaRacio > 0) {
          const racio = fAtual.cve / fAtual.kwh;
          const desvio = Math.abs(racio - mediaRacio) / sigmaRacio;
          if (desvio > limiares.limiar_ratio_racio) {
            const pts = Math.min(5, Math.round((desvio - limiares.limiar_ratio_racio) * 2));
            score_base += pts;
            regras.push({ regra: "R6", pontos: pts, descricao: `Rácio CVE/kWh anómalo (${racio.toFixed(2)} vs ${mediaRacio.toFixed(2)})`, valor: desvio, threshold: limiares.limiar_ratio_racio });
          } else {
            regras.push({ regra: "R6", pontos: 0, descricao: "Rácio CVE/kWh normal" });
          }
        }
      }

      // R7: Reincidência
      {
        const nAlertas = alertasPorCliente[cliente.id] ?? 0;
        if (nAlertas > 0) {
          score_base += 5;
          regras.push({ regra: "R7", pontos: 5, descricao: `${nAlertas} alerta(s) anterior(es) confirmado(s) — reincidente`, valor: nAlertas });
        } else {
          regras.push({ regra: "R7", pontos: 0, descricao: "Sem reincidência" });
        }
      }

      // R8: Pico Histórico vs Atual
      {
        const sorted = fHist.slice().sort((a, b) => a.mes_ano.localeCompare(b.mes_ano));
        const idx = sorted.findIndex((f) => f.mes_ano === mes_ano);
        if (idx >= 6) {
          // Bound the historic peak to the last 24 months — avoids permanently
          // penalising a customer who legitimately downsized years ago.
          const hist = sorted.slice(Math.max(0, idx - 24), idx);
          const pico = Math.max(...hist.map((f) => f.kwh_faturado));
          const atual = sorted[idx].kwh_faturado;
          if (pico > 0) {
            const ratio = atual / pico;
            if (ratio < limiares.limiar_pico_ratio) {
              const pts = Math.min(5, Math.round((limiares.limiar_pico_ratio - ratio) * 20));
              score_base += pts;
              regras.push({ regra: "R8", pontos: pts, descricao: `Atual é ${(ratio * 100).toFixed(1)}% do pico histórico (${pico} kWh)`, valor: ratio, threshold: limiares.limiar_pico_ratio });
            } else {
              regras.push({ regra: "R8", pontos: 0, descricao: `Atual é ${(ratio * 100).toFixed(1)}% do pico — normal` });
            }
          }
        }
      }

      // R9: Aplicar multiplicador de zona
      const score_final = Math.min(100, Math.round(score_base * multiplicador_zona));

      if (score_final >= 50) {
        alertasParaInserir.push({
          id_cliente: cliente.id,
          score_risco: score_final,
          motivo: regras,
          status: "Pendente" as const,
          mes_ano,
        });
      }
    }

    // 6. Inserir novos alertas; actualizar score/motivo apenas em alertas ainda Pendente
    // Nunca sobrescrever status de alertas já em Notificado_SMS, Pendente_Inspecao ou Inspecionado
    let inseridos = 0;
    let actualizados = 0;
    if (alertasParaInserir.length > 0) {
      const clienteIds = alertasParaInserir.map((a) => a.id_cliente);

      // Verificar estado actual dos alertas existentes para este mês
      const { data: existentes } = await supabase
        .from("alertas_fraude")
        .select("id_cliente, status")
        .eq("mes_ano", mes_ano)
        .in("id_cliente", clienteIds);

      const existentesMap = new Map((existentes ?? []).map((e) => [e.id_cliente, e.status]));

      const novos = alertasParaInserir.filter((a) => !existentesMap.has(a.id_cliente));
      const actualizaveis = alertasParaInserir.filter((a) => existentesMap.get(a.id_cliente) === "Pendente");

      // INSERT novos alertas — pedir count exato para reportar bem ao admin
      if (novos.length > 0) {
        const { error, count } = await supabase
          .from("alertas_fraude")
          .insert(novos, { count: "exact" });
        if (!error) inseridos += count ?? novos.length;
        else console.error("Erro ao inserir novos alertas:", error);
      }

      // UPDATE score e motivo apenas em alertas ainda Pendente (não actuados)
      for (const a of actualizaveis) {
        const { error, count } = await supabase
          .from("alertas_fraude")
          .update({ score_risco: a.score_risco, motivo: a.motivo }, { count: "exact" })
          .eq("id_cliente", a.id_cliente)
          .eq("mes_ano", mes_ano)
          .eq("status", "Pendente");
        if (!error && (count ?? 0) > 0) actualizados++;
      }

    }

    const duracao_ms = Date.now() - start;

    return new Response(
      JSON.stringify({
        subestacao_id,
        mes_ano,
        kwh_injetado,
        kwh_faturado_total: totalFaturado,
        perda_pct: perda_pct.toFixed(2),
        zona_vermelha,
        multiplicador_zona: multiplicador_zona.toFixed(3),
        clientes_analisados: clientes.length,
        alertas_gerados: alertasParaInserir.length,
        alertas_inseridos: inseridos,
        alertas_actualizados: actualizados,
        duracao_ms,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro no scoring engine:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
