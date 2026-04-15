import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  if (!profile) redirect("/login");

  if (!["admin_fiskix", "gestor_perdas"].includes(profile.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar profile={profile} />
      <div className="flex-1 min-w-0 pt-14 lg:pt-0">
        <TopBar profile={profile} />
        {children}
      </div>
    </div>
  );
}
