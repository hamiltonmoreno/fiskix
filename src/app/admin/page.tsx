import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Users, Upload, Settings, BarChart3, Key } from "lucide-react";
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
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      <div className="sm:flex sm:justify-between sm:items-center mb-8">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
            Administração
          </h1>
          <p className="text-sm text-gray-500 mt-1 uppercase tracking-wider font-semibold">
            Configurações e Gestão
          </p>
        </div>
      </div>

      <div className="max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/admin/importar"
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-6 mosaic-card-hover group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 transition-colors">
                <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-gray-100">Importar Dados</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">CSV e Excel de faturação e injeção</p>
              </div>
            </div>
          </Link>

          {isAdmin && (
            <Link
              href="/admin/utilizadores"
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-6 mosaic-card-hover group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20 transition-colors">
                  <Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-gray-100">Utilizadores</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Gerir perfis e zonas associadas</p>
                </div>
              </div>
            </Link>
          )}

          {isAdmin && (
            <Link
              href="/admin/configuracao"
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-6 mosaic-card-hover group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl group-hover:bg-amber-100 dark:group-hover:bg-amber-500/20 transition-colors">
                  <Settings className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-gray-100">Configuração</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Limiares do motor de scoring</p>
                </div>
              </div>
            </Link>
          )}

          <Link
            href="/admin/scoring"
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-6 mosaic-card-hover group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-teal-50 dark:bg-teal-500/10 rounded-xl group-hover:bg-teal-100 dark:group-hover:bg-teal-500/20 transition-colors">
                <BarChart3 className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-gray-100">Executar Scoring</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Calcular scores de risco</p>
              </div>
            </div>
          </Link>

          {isAdmin && (
            <Link
              href="/admin/api-keys"
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-6 mosaic-card-hover group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-xl group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors">
                  <Key className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-gray-100">API Keys</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Acesso externo à API REST</p>
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
