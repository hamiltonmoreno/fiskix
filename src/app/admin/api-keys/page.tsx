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
    <div className="min-h-screen bg-background px-8 pt-8 pb-12">

      {/* Page hero */}
      <div className="mb-8">
        <p className="text-xs font-bold text-primary uppercase tracking-[0.15em] mb-2">
          Administração · Integração
        </p>
        <h1 className="text-[2.5rem] font-bold tracking-tighter text-on-surface leading-none">
          API Keys
        </h1>
        <p className="text-sm text-on-surface-variant mt-2">
          Acesso externo à API REST pública do Fiskix
        </p>
      </div>

      <div className="max-w-3xl space-y-4">

        {/* Endpoints */}
        <div className="bg-surface-container-lowest rounded-[1.5rem] p-6 shadow-sm border border-outline-variant/10">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
            Endpoints Disponíveis
          </p>
          <div className="space-y-2">
            {[
              { path: "/api/v1/alertas", params: "?mes_ano= &status= &min_score= &subestacao_id=" },
              { path: "/api/v1/alertas/:id", params: "detalhe com motivo e dados do cliente" },
              { path: "/api/v1/balanco", params: "?mes_ano= &subestacao_id=" },
              { path: "/api/v1/predicoes", params: "?mes_ano= &min_score_ml=" },
            ].map((ep) => (
              <div key={ep.path} className="flex items-center gap-3 font-mono text-xs">
                <span className="text-emerald-600 font-bold w-10 flex-shrink-0">GET</span>
                <span className="text-on-surface font-bold">{ep.path}</span>
                <span className="text-on-surface-variant">{ep.params}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-on-surface-variant mt-4 bg-surface-container-low rounded-lg px-3 py-2 font-mono">
            Authorization: Bearer &lt;api_key&gt; · Limite: 60 req/min
          </p>
        </div>

        {/* Keys list */}
        <div className="bg-surface-container-lowest rounded-[1.5rem] shadow-sm overflow-hidden border border-outline-variant/10">
          <div className="px-6 py-5 border-b border-surface-container-low">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Chaves</p>
            <p className="font-bold text-on-surface">Chaves Ativas</p>
          </div>
          <div className="divide-y divide-surface-container-low">
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
                  <div key={k.chave} className="px-6 py-5 flex items-start gap-4 hover:bg-surface-container-low/30 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Key className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-on-surface capitalize">{clienteNome}</p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">{k.descricao}</p>
                      <p className="text-[11px] text-on-surface-variant/50 mt-1 font-mono">
                        Actualizada em {dataActualizada}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase rounded-full">
                        Ativa
                      </span>
                      <p className="text-[10px] text-on-surface-variant mt-2 font-mono">
                        Revogar: substituir<br />
                        <code className="bg-surface-container-low px-1 rounded">{k.chave}</code>
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-surface-container-lowest rounded-[1.5rem] p-6 shadow-sm border border-amber-200/40">
          <p className="text-[11px] font-bold text-amber-600 uppercase tracking-widest mb-3">
            Como gerar uma nova chave
          </p>
          <p className="text-xs text-on-surface-variant mb-3">
            Execute no terminal e guarde o resultado no Supabase SQL Editor:
          </p>
          <pre className="bg-surface-container-low rounded-xl p-4 text-[11px] font-mono text-on-surface overflow-x-auto">
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
