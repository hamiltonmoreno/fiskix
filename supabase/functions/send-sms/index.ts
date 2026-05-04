/**
 * Fiskix Send SMS — Edge Function
 * Estratégia 2 passos: Amarelo (dissuasão) e Vermelho (alerta firme)
 * Remetente: Alphanumeric "Electra" com fallback para número EUA
 *
 * POST /send-sms
 * Body: { alerta_id: string, tipo: 'amarelo' | 'vermelho' }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getTemplate(tipo: "amarelo" | "vermelho", numeroContador: string): string {
  if (tipo === "amarelo") {
    return `Electra Informa: Detetámos uma quebra anormal de consumo no seu contador (Instalação Nº ${numeroContador}). Para garantir que não há avarias, o seu local foi marcado para inspeção técnica de rotina. Evite multas mantendo a instalação regularizada.`;
  }
  return `Aviso Electra: A anomalia no seu contador persiste. Uma equipa de fiscalização anti-fraude foi destacada para o seu endereço nas próximas 48h. A manipulação de contadores é crime punível por lei.`;
}

async function enviarTwilio(
  telemovel: string,
  mensagem: string,
  accountSid: string,
  authToken: string,
  from: string
): Promise<{ ok: boolean; sid?: string; error?: string; from?: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({
    To: telemovel,
    From: from,
    Body: mensagem,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
    },
    body: body.toString(),
  });

  if (response.ok) {
    const data = await response.json();
    return { ok: true, sid: data.sid, from };
  }

  const errorData = await response.json();
  return { ok: false, error: errorData.message ?? "Twilio error", from };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate the caller using the anon-key client + the JWT they sent.
    // Without this any anonymous request with a forged alerta_id could trigger
    // an SMS to any client (Twilio bill + reputational risk).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabaseAuth.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: profile } = await supabaseAuth
      .from("perfis")
      .select("role")
      .eq("id", userData.user.id)
      .single();
    if (!profile || !["admin_fiskix", "gestor_perdas"].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Sem permissão para enviar SMS" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { alerta_id, tipo } = await req.json();

    if (!alerta_id || !tipo || !["amarelo", "vermelho"].includes(tipo)) {
      return new Response(
        JSON.stringify({ error: "alerta_id e tipo (amarelo|vermelho) são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar alerta + dados do cliente
    const { data: alerta, error: alertaError } = await supabase
      .from("alertas_fraude")
      .select(`
        id, status, score_risco, mes_ano,
        clientes (
          id, numero_contador, nome_titular, telemovel
        )
      `)
      .eq("id", alerta_id)
      .single();

    if (alertaError || !alerta) {
      return new Response(
        JSON.stringify({ error: "Alerta não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cliente = alerta.clientes as {
      telemovel: string | null;
      numero_contador: string;
      nome_titular: string;
    } | null;

    if (!cliente?.telemovel) {
      return new Response(
        JSON.stringify({ error: "Cliente sem número de telemóvel", alerta_id }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mensagem = getTemplate(tipo, cliente.numero_contador);

    // Normalizar número para E.164
    let tel = cliente.telemovel.replace(/[^\d+]/g, "");
    if (!tel.startsWith("+")) tel = "+" + tel;
    const telemovelNormalizado = tel;

    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER"); // fallback numérico
    // Alphanumeric Sender ID — máx 11 chars, sem espaços
    const alphaFrom = Deno.env.get("TWILIO_ALPHA_SENDER") ?? "Electra";

    let resultado = { ok: false, error: "Credenciais em falta", from: "" };

    if (twilioSid && twilioToken) {
      // 1ª tentativa: Alphanumeric Sender ID ("Electra")
      resultado = await enviarTwilio(
        telemovelNormalizado,
        mensagem,
        twilioSid,
        twilioToken,
        alphaFrom
      );

      // 2ª tentativa: fallback para número EUA se alpha falhou
      if (!resultado.ok && twilioPhone) {
        console.log(`Alpha sender falhou (${resultado.error}), a tentar número ${twilioPhone}`);
        resultado = await enviarTwilio(
          telemovelNormalizado,
          mensagem,
          twilioSid,
          twilioToken,
          twilioPhone
        );
      }
    }

    // Atualizar status do alerta
    if (resultado.ok) {
      await supabase
        .from("alertas_fraude")
        .update({ status: "Notificado_SMS" })
        .eq("id", alerta_id);
    }

    return new Response(
      JSON.stringify({
        alerta_id,
        tipo,
        telemovel: cliente.telemovel.replace(/\d(?=\d{4})/g, "*"),
        remetente: resultado.from,
        mensagem_enviada: resultado.ok,
        sid: resultado.ok ? resultado.sid : undefined,
        erro: resultado.ok ? undefined : resultado.error,
        error: resultado.ok ? undefined : resultado.error,
        status_atualizado: resultado.ok ? "Notificado_SMS" : "Pendente",
      }),
      {
        // 502 when Twilio rejected: the caller (browser) typically only checks
        // res.ok and would otherwise treat a failed send as success.
        status: resultado.ok ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro ao enviar SMS:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
