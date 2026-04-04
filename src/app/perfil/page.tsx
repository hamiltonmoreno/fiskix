import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PerfilClient } from "./PerfilClient";

export default async function PerfilPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("perfis")
    .select("id, role, nome_completo, id_zona, ativo, criado_em, atualizado_em")
    .eq("id", user.id)
    .single();

  if (error || !profile) redirect("/login");

  return <PerfilClient profile={profile} email={user.email ?? ""} />;
}
