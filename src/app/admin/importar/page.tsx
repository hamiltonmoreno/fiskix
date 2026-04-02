import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ImportarDados } from "@/modules/ingestao/components/ImportarDados";

export default async function ImportarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("perfis")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin_fiskix", "gestor_perdas"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const { data: historico } = await supabase
    .from("importacoes")
    .select("id, tipo, nome_ficheiro, total_registos, registos_sucesso, registos_erro, criado_em")
    .order("criado_em", { ascending: false })
    .limit(10);

  return <ImportarDados historico={historico ?? []} />;
}
