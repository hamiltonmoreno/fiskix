"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AlertaTabela } from "../types";

interface UseAlertasOptions {
  mesAno: string;
  zona?: string;
  statusFilter?: string;
  page?: number;
  pageSize?: number;
}

export function useAlertas({
  mesAno,
  zona,
  statusFilter,
  page = 0,
  pageSize = 20,
}: UseAlertasOptions) {
  const [data, setData] = useState<AlertaTabela[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("alertas_fraude")
      .select(
        `
        id, score_risco, status, mes_ano, resultado, motivo,
        clientes!inner (
          numero_contador, nome_titular, morada, tipo_tarifa, telemovel,
          subestacoes!inner (nome, zona_bairro)
        )
        `,
        { count: "exact" }
      )
      .eq("mes_ano", mesAno)
      .gte("score_risco", 50)
      .order("score_risco", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (statusFilter && statusFilter !== "todos") {
      query = query.eq("status", statusFilter as "Pendente" | "Notificado_SMS" | "Pendente_Inspecao" | "Inspecionado");
    }

    const { data: rows, count } = await query;

    const alertas: AlertaTabela[] = (rows ?? []).map((r) => {
      const cliente = r.clientes as {
        numero_contador: string;
        nome_titular: string;
        morada: string;
        tipo_tarifa: string;
        telemovel: string | null;
        subestacoes: { nome: string; zona_bairro: string };
      };

      return {
        id: r.id,
        score_risco: r.score_risco,
        status: r.status,
        mes_ano: r.mes_ano,
        resultado: r.resultado,
        motivo: (r.motivo as AlertaTabela["motivo"]) ?? [],
        cliente: {
          numero_contador: cliente.numero_contador,
          nome_titular: cliente.nome_titular,
          morada: cliente.morada,
          tipo_tarifa: cliente.tipo_tarifa,
          telemovel: cliente.telemovel,
        },
        subestacao: {
          nome: cliente.subestacoes.nome,
          zona_bairro: cliente.subestacoes.zona_bairro,
        },
      };
    });

    const filtrados = zona
      ? alertas.filter((a) => a.subestacao.zona_bairro === zona)
      : alertas;

    setData(filtrados);
    setTotal(count ?? 0);
    setLoading(false);
  }, [mesAno, zona, statusFilter, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  async function enviarSMS(alertaId: string, tipo: "amarelo" | "vermelho") {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-sms`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ alerta_id: alertaId, tipo }),
      }
    );
    return res.json();
  }

  async function gerarOrdem(alertaId: string) {
    const { error } = await supabase
      .from("alertas_fraude")
      .update({ status: "Pendente_Inspecao" })
      .eq("id", alertaId);

    if (!error) {
      await load();
    }
    return { error };
  }

  return { data, total, loading, reload: load, enviarSMS, gerarOrdem };
}
