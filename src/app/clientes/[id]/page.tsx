import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FichaClienteClient } from "./FichaClienteClient";

const ALLOWED_ROLES = ["admin_fiskix", "diretor", "gestor_perdas", "supervisor"];

export default async function FichaClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("perfis")
    .select("role, nome_completo, id_zona")
    .eq("id", user.id)
    .single();

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) redirect("/dashboard");

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nome_titular, numero_contador, morada, tipo_tarifa, telemovel, lat, lng, ativo, subestacoes(nome, zona_bairro, ilha)")
    .eq("id", id)
    .single();

  if (!cliente) notFound();

  const { data: faturacao } = await supabase
    .from("faturacao_clientes")
    .select("mes_ano, kwh_faturado, valor_cve")
    .eq("id_cliente", id)
    .order("mes_ano", { ascending: false })
    .limit(24);

  const { data: alertas } = await supabase
    .from("alertas_fraude")
    .select("id, mes_ano, score_risco, status, resultado, motivo, criado_em")
    .eq("id_cliente", id)
    .order("criado_em", { ascending: false })
    .limit(20);

  const { data: mlPredicoes } = await supabase
    .from("ml_predicoes")
    .select("mes_ano, score_ml, modelo_versao, features_json")
    .eq("id_cliente", id)
    .order("mes_ano", { ascending: false })
    .limit(12);

  return (
    <FichaClienteClient
      cliente={cliente as never}
      faturacao={faturacao ?? []}
      alertas={alertas ?? []}
      mlPredicoes={mlPredicoes ?? []}
    />
  );
}
