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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-lg font-bold text-slate-900">API Keys</h1>
        <p className="text-sm text-slate-400">Acesso externo à API REST pública do Fiskix</p>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Endpoints disponíveis */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Endpoints disponíveis</h2>
          <div className="space-y-2 font-mono text-xs text-slate-600">
            <div className="flex gap-3">
              <span className="text-emerald-600 font-semibold w-12">GET</span>
              <span>/api/v1/alertas</span>
              <span className="text-slate-400">?mes_ano= &status= &min_score= &subestacao_id=</span>
            </div>
            <div className="flex gap-3">
              <span className="text-emerald-600 font-semibold w-12">GET</span>
              <span>/api/v1/alertas/:id</span>
              <span className="text-slate-400">detalhe com motivo e dados do cliente</span>
            </div>
            <div className="flex gap-3">
              <span className="text-emerald-600 font-semibold w-12">GET</span>
              <span>/api/v1/balanco</span>
              <span className="text-slate-400">?mes_ano= &subestacao_id=</span>
            </div>
            <div className="flex gap-3">
              <span className="text-emerald-600 font-semibold w-12">GET</span>
              <span>/api/v1/predicoes</span>
              <span className="text-slate-400">?mes_ano= &min_score_ml=</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Autenticação: <code className="bg-slate-100 px-1.5 py-0.5 rounded">Authorization: Bearer &lt;api_key&gt;</code> · Limite: 60 req/min
          </p>
        </div>

        {/* Lista de chaves */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Chaves Ativas</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {(keys ?? []).length === 0 ? (
              <p className="px-5 py-8 text-center text-slate-400 text-sm">Nenhuma chave configurada.</p>
            ) : (
              (keys ?? []).map((k) => {
                const clienteNome = k.chave.replace("api_key_", "");
                const dataActualizada = new Date(k.atualizado_em).toLocaleDateString("pt-CV", {
                  day: "2-digit", month: "short", year: "numeric",
                });
                return (
                  <div key={k.chave} className="px-5 py-4 flex items-start gap-4">
                    <div className="p-2 bg-slate-100 rounded-lg mt-0.5">
                      <Key className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 capitalize">{clienteNome}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{k.descricao}</p>
                      <p className="text-xs text-slate-300 mt-1">Actualizada em {dataActualizada}</p>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">Ativa</span>
                      <p className="text-xs text-slate-400 mt-2">
                        Para revogar: substituir o valor em<br />
                        <code className="text-xs bg-slate-100 px-1 rounded">{k.chave}</code>
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Instruções */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-700">
          <p className="font-semibold mb-1">Como gerar uma nova chave segura</p>
          <p>Execute no terminal e guarde o resultado no Supabase SQL Editor:</p>
          <code className="block mt-2 bg-amber-100 rounded p-2 text-xs font-mono">
            openssl rand -hex 32<br /><br />
            UPDATE configuracoes SET valor = &apos;&lt;nova_chave&gt;&apos; WHERE chave = &apos;api_key_electra&apos;;
          </code>
        </div>
      </main>
    </div>
  );
}
