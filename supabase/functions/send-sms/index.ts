/**
 * Fiskix Send SMS — Edge Function
 * Estratégia 2 passos: Amarelo (dissuasão) e Vermelho (alerta firme)
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
  fromNumber: string
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({
    To: telemovel,
    From: fromNumber,
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
    return { ok: true, sid: data.sid };
  }

  const errorData = await response.json();
  return { ok: false, error: errorData.message ?? "Twilio error" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const cliente = alerta.clientes as { telemovel: string | null; numero_contador: string; nome_titular: string } | null;

    if (!cliente?.telemovel) {
      return new Response(
        JSON.stringify({ error: "Cliente sem número de telemóvel", alerta_id }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mensagem = getTemplate(tipo, cliente.numero_contador);

    // Tentar Twilio
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");

    let resultado = { ok: false, error: "SMS não enviado — credenciais em falta" };

    if (twilioSid && twilioToken && twilioFrom) {
      resultado = await enviarTwilio(
        cliente.telemovel,
        mensagem,
        twilioSid,
        twilioToken,
        twilioFrom
      );
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
        telemovel: cliente.telemovel.replace(/\d(?=\d{4})/g, "*"), // mascarar número
        mensagem_enviada: resultado.ok,
        sid: resultado.ok ? resultado.sid : undefined,
        erro: resultado.ok ? undefined : resultado.error,
        status_atualizado: resultado.ok ? "Notificado_SMS" : "Pendente",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro ao enviar SMS:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
