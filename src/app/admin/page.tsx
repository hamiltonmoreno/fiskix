import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Users, Upload, Settings, BarChart3 } from "lucide-react";
// Link is used for admin cards below

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("perfis")
    .select("role, nome_completo")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin_fiskix", "gestor_perdas"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const isAdmin = profile.role === "admin_fiskix";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-lg font-bold text-slate-900">Administração</h1>
        <p className="text-sm text-slate-400">{profile.nome_completo} · {profile.role}</p>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/admin/importar"
            className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
                <Upload className="w-6 h-6 text-blue-700" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Importar Dados</p>
                <p className="text-sm text-slate-400 mt-0.5">CSV e Excel de faturação e injeção</p>
              </div>
            </div>
          </Link>

          {isAdmin && (
            <Link
              href="/admin/utilizadores"
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-violet-100 rounded-xl group-hover:bg-violet-200 transition-colors">
                  <Users className="w-6 h-6 text-violet-700" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Utilizadores</p>
                  <p className="text-sm text-slate-400 mt-0.5">Gerir perfis, roles e zonas</p>
                </div>
              </div>
            </Link>
          )}

          {isAdmin && (
            <Link
              href="/admin/configuracao"
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 rounded-xl group-hover:bg-amber-200 transition-colors">
                  <Settings className="w-6 h-6 text-amber-700" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Configuração</p>
                  <p className="text-sm text-slate-400 mt-0.5">Limiares do motor de scoring</p>
                </div>
              </div>
            </Link>
          )}

          <Link
            href="/admin/scoring"
            className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-xl group-hover:bg-green-200 transition-colors">
                <BarChart3 className="w-6 h-6 text-green-700" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Executar Scoring</p>
                <p className="text-sm text-slate-400 mt-0.5">Calcular scores de risco por subestação</p>
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
