/**
 * Fiskix Send Email — Edge Function (Resend)
 * Envia alertas de fraude por email ao cliente (canal paralelo ao SMS).
 * Dois templates: Amarelo (dissuasão) e Vermelho (alerta firme).
 *
 * POST /send-email
 * Body: { alerta_id: string, tipo: 'amarelo' | 'vermelho' }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type UserRole = "admin_fiskix" | "diretor" | "gestor_perdas" | "supervisor" | "fiscal";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EMAIL_ALLOWED_ROLES: UserRole[] = [
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

function getEmailTemplate(
  tipo: "amarelo" | "vermelho",
  nomeTitular: string,
  numeroContador: string
): { subject: string; html: string } {
  if (tipo === "amarelo") {
    return {
      subject: "Electra: Irregularidade detetada na sua instalação",
      html: `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:#0ea5e9;padding:24px 32px;">
          <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">⚡ Electra</p>
          <p style="margin:4px 0 0;color:#bae6fd;font-size:13px;">Sistemas de Energia de Cabo Verde</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#1e293b;font-size:16px;font-weight:600;">Caro/a ${nomeTitular},</p>
          <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
            Os nossos sistemas detetaram uma <strong>quebra anormal de consumo</strong> na sua instalação com o contador <strong>${numeroContador}</strong>.
          </p>
          <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
            Para garantir que não se trata de uma avaria, o seu local foi marcado para <strong>inspeção técnica de rotina</strong>.
          </p>
          <div style="background:#fef9c3;border-left:4px solid #eab308;border-radius:4px;padding:16px;margin:20px 0;">
            <p style="margin:0;color:#713f12;font-size:13px;font-weight:600;">⚠️ Recomendamos que:</p>
            <ul style="margin:8px 0 0;padding-left:20px;color:#713f12;font-size:13px;">
              <li>Verifique se a sua instalação elétrica está regularizada.</li>
              <li>Evite multas e coimas mantendo o contador em conformidade.</li>
            </ul>
          </div>
          <p style="margin:0;color:#94a3b8;font-size:12px;">
            Para esclarecimentos, contacte a Electra pelo número <strong>261 56 56</strong>.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:11px;">
            Este é um email automático da Electra — Sistemas de Energia de Cabo Verde. Não responda a esta mensagem.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    };
  }

  return {
    subject: "AVISO URGENTE Electra: Ação imediata requerida",
    html: `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:#dc2626;padding:24px 32px;">
          <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">⚡ Electra — AVISO URGENTE</p>
          <p style="margin:4px 0 0;color:#fca5a5;font-size:13px;">Sistemas de Energia de Cabo Verde</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#1e293b;font-size:16px;font-weight:600;">Caro/a ${nomeTitular},</p>
          <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
            A anomalia detetada no seu contador <strong>${numeroContador}</strong> persiste após notificação prévia.
          </p>
          <div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;padding:16px;margin:20px 0;">
            <p style="margin:0;color:#991b1b;font-size:14px;font-weight:700;">🚨 Informamos que:</p>
            <ul style="margin:8px 0 0;padding-left:20px;color:#991b1b;font-size:13px;line-height:1.6;">
              <li>Uma equipa de <strong>fiscalização anti-fraude</strong> foi destacada para o seu endereço nas próximas 48 horas.</li>
              <li>A manipulação ou adulteração de contadores é <strong>crime punível por lei</strong> (art. 221º e 287º do Código Penal).</li>
              <li>A regularização voluntária antes da inspeção resulta em penalizações menores.</li>
            </ul>
          </div>
          <p style="margin:0;color:#94a3b8;font-size:12px;">
            Para regularizar a sua situação, contacte urgentemente a Electra pelo número <strong>261 56 56</strong>.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:11px;">
            Este é um email automático da Electra — Sistemas de Energia de Cabo Verde. Não responda a esta mensagem.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
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

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: perfil } = await supabase
      .from("perfis")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!perfil?.role || !EMAIL_ALLOWED_ROLES.includes(perfil.role as UserRole)) {
      return jsonResponse({ error: "Sem permissão para enviar email" }, 403);
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
          id, numero_contador, nome_titular, email
        )
      `)
      .eq("id", alerta_id)
      .single();

    if (alertaError || !alerta) {
      return jsonResponse({ error: "Alerta não encontrado" }, 404);
    }

    const cliente = alerta.clientes as {
      email: string | null;
      numero_contador: string;
      nome_titular: string;
    } | null;

    if (!cliente?.email) {
      return jsonResponse({ error: "Cliente sem endereço de email", alerta_id }, 422);
    }

    // Buscar API key do Resend em configuracoes
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@electra.cv";

    if (!resendApiKey) {
      return jsonResponse({ error: "RESEND_API_KEY não configurada" }, 500);
    }

    const { subject, html } = getEmailTemplate(tipo, cliente.nome_titular, cliente.numero_contador);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Electra <${fromEmail}>`,
        to: [cliente.email],
        subject,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.json().catch(() => ({}));
      console.error("Resend error:", errBody);
      return jsonResponse({
        alerta_id,
        tipo,
        email: cliente.email.replace(/(?<=.{2}).(?=.*@)/g, "*"),
        mensagem_enviada: false,
        erro: errBody.message ?? "Erro ao enviar email",
      }, 502);
    }

    const resendData = await resendRes.json();

    return jsonResponse({
      alerta_id,
      tipo,
      email: cliente.email.replace(/(?<=.{2}).(?=.*@)/g, "*"),
      mensagem_enviada: true,
      id: resendData.id,
    });
  } catch (error) {
    console.error("Erro ao enviar email:", error);
    return jsonResponse({ error: String(error) }, 500);
  }
});
