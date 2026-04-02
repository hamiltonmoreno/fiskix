import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RelatorioInspecao } from "@/modules/mobile/components/RelatorioInspecao";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RelatorioPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("perfis")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "fiscal") redirect("/dashboard");

  const { data: alerta } = await supabase
    .from("alertas_fraude")
    .select("id, score_risco, clientes!inner(nome_titular, numero_contador)")
    .eq("id", id)
    .single();

  if (!alerta) redirect("/mobile");

  return (
    <RelatorioInspecao
      alertaId={id}
      fiscalId={user.id}
      nomeCliente={(alerta.clientes as { nome_titular: string }).nome_titular}
      numeroContador={(alerta.clientes as { numero_contador: string }).numero_contador}
    />
  );
}
