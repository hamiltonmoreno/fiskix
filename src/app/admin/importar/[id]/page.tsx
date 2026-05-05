import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ImportacaoDetalheClient } from "./ImportacaoDetalheClient";

export default async function ImportacaoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("perfis").select("role").eq("id", user.id).single();

  if (!profile || !["admin_fiskix", "gestor_perdas"].includes(profile.role)) redirect("/dashboard");

  const { data: importacao } = await supabase
    .from("importacoes")
    .select("id, tipo, nome_ficheiro, total_registos, registos_sucesso, registos_erro, erros_json, criado_em, perfis(nome_completo)")
    .eq("id", id)
    .single();

  if (!importacao) notFound();

  return <ImportacaoDetalheClient importacao={importacao as never} />;
}
