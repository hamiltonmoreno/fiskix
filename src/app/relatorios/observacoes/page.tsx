import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ObservacoesClient } from "./ObservacoesClient";

export default async function ObservacoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <ObservacoesClient />;
}
