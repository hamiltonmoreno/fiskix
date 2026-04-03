import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FichaInteligencia } from "@/modules/mobile/components/FichaInteligencia";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FichaPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Carregar alerta + dados do cliente
  const { data: alerta } = await supabase
    .from("alertas_fraude")
    .select(
      `
      id, score_risco, status, mes_ano, motivo,
      clientes!inner (
        id, numero_contador, nome_titular, morada, tipo_tarifa, telemovel, lat, lng,
        subestacoes!inner (nome, zona_bairro)
      )
      `
    )
    .eq("id", id)
    .single();

  if (!alerta) redirect("/mobile");

  // Histórico de faturação (últimos 12 meses)
  const cliente = alerta.clientes as unknown as { id: string; [key: string]: unknown };
  const { data: faturacao } = await supabase
    .from("faturacao_clientes")
    .select("mes_ano, kwh_faturado")
    .eq("id_cliente", cliente.id)
    .order("mes_ano", { ascending: false })
    .limit(12);

  // Mediana do cluster (mesmo tipo tarifa, mesma subestação)
  const c = alerta.clientes as {
    id: string;
    tipo_tarifa: string;
    subestacoes: { nome: string; zona_bairro: string };
  };

  return (
    <FichaInteligencia
      alertaId={id}
      alerta={alerta as unknown as Parameters<typeof FichaInteligencia>[0]["alerta"]}
      faturacaoHistorico={(faturacao ?? []).reverse()}
    />
  );
}
