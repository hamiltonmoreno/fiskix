import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuditoriaClient } from "./AuditoriaClient";

const ALLOWED_ROLES = ["admin_fiskix", "diretor"];

export default async function AuditoriaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("perfis")
    .select("role, nome_completo")
    .eq("id", user.id)
    .single();

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) redirect("/dashboard");

  return <AuditoriaClient />;
}
