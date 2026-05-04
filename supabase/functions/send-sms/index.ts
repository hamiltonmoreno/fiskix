/**
 * Fiskix Send SMS — Edge Function
 * Estratégia 2 passos: Amarelo (dissuasão) e Vermelho (alerta firme)
 * Remetente: Alphanumeric "Electra" com fallback para número EUA
 *
 * POST /send-sms
 * Body: { alerta_id: string, tipo: 'amarelo' | 'vermelho' }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type UserRole = "admin_fiskix" | "diretor" | "gestor_perdas" | "supervisor" | "fiscal";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SMS_ALLOWED_ROLES: UserRole[] = [
  "admin_fiskix",
  "diretor",
  "gestor_perdas",
  "supervisor",
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: "Configuração de ambiente incompleta" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Não autenticado" }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Token inválido" }, 401);
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const { data: perfil } = await supabase
      .from("perfis")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!perfil?.role || !SMS_ALLOWED_ROLES.includes(perfil.role as UserRole)) {
      return jsonResponse({ error: "Sem permissão para enviar SMS" }, 403);
    }

    const { alerta_id, tipo } = await req.json();

    if (!alerta_id || !tipo || !["amarelo", "vermelho"].includes(tipo)) {
      return jsonResponse({ error: "alerta_id e tipo (amarelo|vermelho) são obrigatórios" }, 400);
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
      return jsonResponse({ error: "Alerta não encontrado" }, 404);
    }

    // Throttle: não reenviar SMS se já está notificado (evitar duplicados por duplo-clique)
    if (alerta.status === "Notificado_SMS" && tipo === "amarelo") {
      return jsonResponse({ error: "SMS amarelo já enviado para este alerta", alerta_id }, 409);
    }

    const cliente = alerta.clientes as {
      telemovel: string | null;
      numero_contador: string;
      nome_titular: string;
    } | null;

    if (!cliente?.telemovel) {
      return jsonResponse({ error: "Cliente sem número de telemóvel", alerta_id }, 422);
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

    return jsonResponse(
      {
        alerta_id,
        tipo,
        telemovel: cliente.telemovel.replace(/\d(?=\d{4})/g, "*"),
        remetente: resultado.from,
        mensagem_enviada: resultado.ok,
        sid: resultado.ok ? resultado.sid : undefined,
        erro: resultado.ok ? undefined : resultado.error,
        error: resultado.ok ? undefined : resultado.error,
        status_atualizado: resultado.ok ? "Notificado_SMS" : "Pendente",
      },
      // 502 when Twilio rejected: the caller (browser) typically only checks
      // res.ok and would otherwise treat a failed send as success.
      resultado.ok ? 200 : 502,
    );
  } catch (error) {
    console.error("Erro ao enviar SMS:", error);
    return jsonResponse({ error: String(error) }, 500);
  }
});
