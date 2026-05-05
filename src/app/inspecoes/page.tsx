import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InspecoesClient } from "./InspecoesClient";

const ALLOWED_ROLES = ["admin_fiskix", "diretor", "gestor_perdas", "supervisor"];

export default async function InspecoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("perfis")
    .select("role, nome_completo, id_zona")
    .eq("id", user.id)
    .single();

  if (error || !profile) redirect("/login");
  if (!ALLOWED_ROLES.includes(profile.role)) redirect("/dashboard");

  return <InspecoesClient profile={profile} />;
}
