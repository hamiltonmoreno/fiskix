"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AlertaTabela } from "../types";
import type { AlertaStatus, InspecaoResultado } from "@/types/database";

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
    try {
    let query = supabase
      .from("alertas_fraude")
      .select(
        `
        id, id_cliente, score_risco, status, mes_ano, resultado, motivo,
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

    const ESTADOS_FINAIS: InspecaoResultado[] = [
      "Fraude_Confirmada",
      "Anomalia_Tecnica",
      "Falso_Positivo",
    ];

    if (statusFilter && statusFilter !== "todos") {
      if (ESTADOS_FINAIS.includes(statusFilter as InspecaoResultado)) {
        query = query
          .eq("status", "Inspecionado" as AlertaStatus)
          .eq("resultado", statusFilter as InspecaoResultado);
      } else {
        query = query.eq("status", statusFilter as AlertaStatus);
      }
    }

    if (zona) {
      query = query.eq("clientes.subestacoes.zona_bairro", zona);
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
        id_cliente: r.id_cliente,
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

    setData(alertas);
    setTotal(count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [mesAno, zona, statusFilter, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("alertas-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alertas_fraude" },
        () => { load(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
