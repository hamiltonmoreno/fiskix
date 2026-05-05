import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CalendarioClient } from "./CalendarioClient";

export default async function CalendarioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <CalendarioClient />;
}
