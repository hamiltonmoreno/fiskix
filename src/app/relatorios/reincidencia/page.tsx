import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReincidenciaClient } from "./ReincidenciaClient";

const ALLOWED_ROLES = ["admin_fiskix", "diretor", "gestor_perdas"];

export default async function ReincidenciaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("perfis").select("role").eq("id", user.id).single();

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) redirect("/dashboard");

  return <ReincidenciaClient />;
}
