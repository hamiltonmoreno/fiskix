import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UtilizadoresClient } from "./UtilizadoresClient";

export default async function UtilizadoresPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("perfis")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin_fiskix") redirect("/admin");

  const { data: utilizadores } = await supabase
    .from("perfis")
    .select("id, nome_completo, role, id_zona, ativo, criado_em")
    .order("criado_em", { ascending: false });

  return <UtilizadoresClient utilizadores={utilizadores ?? []} />;
}
