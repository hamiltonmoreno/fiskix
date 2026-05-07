import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { InspecaoDetalheClient } from "./InspecaoDetalheClient";

export default async function InspecaoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("relatorios_inspecao")
    .select(`id, resultado, tipo_fraude, observacoes, foto_url, lat_foto, lng_foto, criado_em,
      alertas_fraude!inner(id, score_risco, mes_ano, motivo, status, resultado,
        clientes!inner(nome_titular, numero_contador, morada, tipo_tarifa,
          subestacoes!inner(nome, zona_bairro))),
      perfis!inner(nome_completo, role)`)
    .eq("id", id)
    .single();
  if (!data) notFound();
  return <InspecaoDetalheClient inspecao={data as never} />;
}
