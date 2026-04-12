import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { Breadcrumb } from "@/components/Breadcrumb";

export default async function AlertasLayout({
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

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar profile={profile} />
      <div className="flex-1 min-w-0 lg:pl-0 pt-14 lg:pt-0">
        <div className="px-6 py-2.5 border-b border-border bg-card no-print">
          <Breadcrumb />
        </div>
        {children}
      </div>
    </div>
  );
}
