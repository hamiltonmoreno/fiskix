import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Key } from "lucide-react";

export default async function ApiKeysPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("perfis")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin_fiskix") redirect("/dashboard");

  const { data: keys } = await supabase
    .from("configuracoes")
    .select("chave, descricao, atualizado_em")
    .like("chave", "api_key_%")
    .order("atualizado_em", { ascending: false });

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      {/* Page hero */}
      <div className="sm:flex sm:justify-between sm:items-center mb-8">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
            API Keys
          </h1>
          <p className="text-sm text-gray-500 mt-1 uppercase tracking-wider font-semibold">
            Acesso externo à API REST pública do Fiskix
          </p>
        </div>
      </div>

      <div className="max-w-4xl space-y-6">

        {/* Endpoints */}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-6 border border-gray-200 dark:border-gray-700/60 transition-all duration-300">
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-5">
            Endpoints Disponíveis
          </p>
          <div className="space-y-3">
            {[
              { path: "/api/v1/alertas", params: "?mes_ano= &status= &min_score= &subestacao_id=" },
              { path: "/api/v1/alertas/:id", params: "detalhe com motivo e dados do cliente" },
              { path: "/api/v1/balanco", params: "?mes_ano= &subestacao_id=" },
              { path: "/api/v1/predicoes", params: "?mes_ano= &min_score_ml=" },
            ].map((ep) => (
              <div key={ep.path} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 font-mono text-[13px]">
                <div className="flex items-center gap-3">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold w-10 flex-shrink-0">GET</span>
                  <span className="text-gray-900 dark:text-gray-100 font-semibold">{ep.path}</span>
                </div>
                <span className="text-gray-500 dark:text-gray-400 text-xs sm:text-[13px]">{ep.params}</span>
              </div>
            ))}
          </div>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-3 font-mono border border-gray-200 dark:border-gray-700/60">
            Authorization: Bearer &lt;api_key&gt; · Limite: 60 req/min
          </p>
        </div>

        {/* Keys list */}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden transition-all duration-300">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700/60">
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Chaves</p>
            <p className="font-bold text-gray-900 dark:text-gray-100">Chaves Ativas</p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {(keys ?? []).length === 0 ? (
              <p className="px-6 py-10 text-center text-on-surface-variant text-sm">
                Nenhuma chave configurada.
              </p>
            ) : (
              (keys ?? []).map((k) => {
                const clienteNome = k.chave.replace("api_key_", "");
                const dataActualizada = new Date(k.atualizado_em).toLocaleDateString("pt-CV", {
                  day: "2-digit", month: "short", year: "numeric",
                });
                return (
                  <div key={k.chave} className="px-6 py-5 flex items-start gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">{clienteNome}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{k.descricao}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 font-mono">
                        Actualizada em {dataActualizada}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded text-[11px] font-semibold uppercase">
                        Ativa
                      </span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3 font-mono">
                        Revogar: substituir<br />
                        <code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded ml-1 text-gray-800 dark:text-gray-200">{k.chave}</code>
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-6 shadow-sm border border-amber-200 dark:border-amber-500/20">
          <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-3">
            Como gerar uma nova chave
          </p>
          <p className="text-[13px] text-amber-800 dark:text-amber-300 mb-4 font-semibold">
            Execute no terminal e guarde o resultado no Supabase SQL Editor:
          </p>
          <pre className="bg-amber-100/50 dark:bg-gray-900/50 rounded-lg p-4 text-[13px] font-mono text-amber-900 dark:text-amber-100 overflow-x-auto border border-amber-200/50 dark:border-amber-500/20 shadow-inner">
{`openssl rand -hex 32

UPDATE configuracoes
SET valor = '<nova_chave>'
WHERE chave = 'api_key_electra';`}
          </pre>
        </div>

      </div>
    </div>
  );
}
