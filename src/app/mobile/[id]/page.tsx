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
        id, id_subestacao, numero_contador, nome_titular, morada, tipo_tarifa, telemovel, lat, lng,
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
    id_subestacao: string;
    tipo_tarifa: string;
    subestacoes: { nome: string; zona_bairro: string };
  };

  // Buscar IDs de clientes do mesmo cluster (mesmo tipo_tarifa + subestação)
  const { data: clusterClientes } = await supabase
    .from("clientes")
    .select("id")
    .eq("id_subestacao", c.id_subestacao)
    .eq("tipo_tarifa", c.tipo_tarifa as "Residencial" | "Comercial" | "Industrial" | "Servicos_Publicos")
    .neq("id", cliente.id);

  const clusterIds = (clusterClientes ?? []).map((cc) => cc.id);

  // Buscar última faturação disponível do cluster
  const { data: clusterFaturacao } = clusterIds.length > 0
    ? await supabase
        .from("faturacao_clientes")
        .select("kwh_faturado")
        .in("id_cliente", clusterIds)
        .eq("mes_ano", alerta.mes_ano)
    : { data: [] };

  // Calcular mediana do kWh do cluster
  const clusterKwh = (clusterFaturacao ?? []).map((r) => r.kwh_faturado).sort((a, b) => a - b);
  const medianaCluster =
    clusterKwh.length === 0
      ? null
      : clusterKwh.length % 2 === 0
      ? (clusterKwh[clusterKwh.length / 2 - 1] + clusterKwh[clusterKwh.length / 2]) / 2
      : clusterKwh[Math.floor(clusterKwh.length / 2)];

  return (
    <FichaInteligencia
      alertaId={id}
      alerta={alerta as unknown as Parameters<typeof FichaInteligencia>[0]["alerta"]}
      faturacaoHistorico={(faturacao ?? []).reverse()}
      medianaCluster={medianaCluster}
    />
  );
}
