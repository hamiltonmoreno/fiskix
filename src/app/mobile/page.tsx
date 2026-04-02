import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoteiroDia } from "@/modules/mobile/components/RoteiroDia";

export default async function MobilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("perfis")
    .select("role, nome_completo, id_zona")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "fiscal") {
    redirect("/dashboard");
  }

  return <RoteiroDia fiscalId={user.id} zona={profile.id_zona} nomeFiscal={profile.nome_completo} />;
}
