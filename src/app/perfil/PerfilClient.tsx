"use client";

import { useMemo, useState } from "react";
import { Shield, KeyRound, CheckCircle, AlertCircle, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";
import { haptics } from "@/lib/haptics";
import { Icon } from "@/components/Icon";

interface Profile {
  id: string;
  role: UserRole;
  nome_completo: string;
  id_zona: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

interface Props {
  profile: Profile;
  email: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin_fiskix: "Administrador",
  diretor: "Diretor",
  gestor_perdas: "Gestor de Perdas",
  supervisor: "Supervisor",
  fiscal: "Fiscal",
};

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

type FeedbackState = { type: "success" | "error"; message: string } | null;

const inputClass = "w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all duration-200 placeholder:text-gray-400";

export function PerfilClient({ profile: profileInicial, email }: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [nome, setNome] = useState(profileInicial.nome_completo);
  const [savingNome, setSavingNome] = useState(false);
  const [feedbackNome, setFeedbackNome] = useState<FeedbackState>(null);

  const [novaPassword, setNovaPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [feedbackPassword, setFeedbackPassword] = useState<FeedbackState>(null);

  async function handleGuardarNome(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSavingNome(true);
    setFeedbackNome(null);
    haptics.medium();

    const { error } = await supabase
      .from("perfis")
      .update({ nome_completo: nome.trim() })
      .eq("id", profileInicial.id);

    setSavingNome(false);
    if (error) {
      setFeedbackNome({ type: "error", message: "Erro ao guardar: " + error.message });
    } else {
      setFeedbackNome({ type: "success", message: "Nome atualizado com sucesso." });
    }
  }

  async function handleMudarPassword(e: React.FormEvent) {
    e.preventDefault();
    setFeedbackPassword(null);
    haptics.medium();

    if (novaPassword.length < 8) {
      setFeedbackPassword({ type: "error", message: "A password deve ter pelo menos 8 caracteres." });
      return;
    }
    if (novaPassword !== confirmarPassword) {
      setFeedbackPassword({ type: "error", message: "As passwords não coincidem." });
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: novaPassword });
    setSavingPassword(false);

    if (error) {
      setFeedbackPassword({ type: "error", message: "Erro ao mudar password: " + error.message });
    } else {
      setFeedbackPassword({ type: "success", message: "Password alterada com sucesso." });
      setNovaPassword("");
      setConfirmarPassword("");
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-10">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center flex-shrink-0 animate-in fade-in zoom-in duration-500 shadow-lg shadow-blue-500/20">
          <span className="text-2xl font-bold text-white tracking-widest">
            {getInitials(nome || profileInicial.nome_completo)}
          </span>
        </div>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            {nome || profileInicial.nome_completo}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 rounded text-[11px] font-bold uppercase">
              {ROLE_LABELS[profileInicial.role]}
            </span>
            <span className="px-2.5 py-1 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded text-[11px] font-bold uppercase">
              {profileInicial.id_zona?.replace(/_/g, " ") ?? "Acesso Global"}
            </span>
            <span className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase border animate-pulse ${
              profileInicial.ativo ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" : "bg-gray-100 text-gray-500 border-gray-200"
            }`}>
              {profileInicial.ativo ? "Online" : "Inativo"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-5xl">
        <div className="lg:col-span-7 space-y-6">
          {/* Personal info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700/60 mosaic-card-hover">
            <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">
              Configurações de Conta
            </h2>

            <form onSubmit={handleGuardarNome} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => { setNome(e.target.value); setFeedbackNome(null); }}
                  onFocus={() => haptics.light()}
                  required
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Email Institucional
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className={inputClass + " bg-gray-100 dark:bg-gray-900 border-gray-100 dark:border-gray-800 opacity-60 cursor-not-allowed"}
                />
              </div>

              {feedbackNome && (
                <div className={`flex items-center gap-3 p-4 rounded-lg text-sm font-medium animate-in slide-in-from-top-2 duration-300 ${
                  feedbackNome.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20"
                    : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-500/20"
                }`}>
                  {feedbackNome.type === "success"
                    ? <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                  {feedbackNome.message}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingNome || !nome.trim() || nome.trim() === profileInicial.nome_completo}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-all shadow-sm shadow-blue-100 dark:shadow-none"
                >
                  {savingNome ? "A guardar..." : "Guardar Alterações"}
                </button>
              </div>
            </form>
          </div>

          {/* Security */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700/60 transition-all duration-300">
            <div className="flex items-center gap-2 mb-6">
              <Icon name="keys" size="xs" className="text-gray-400" />
              <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                Segurança & Credenciais
              </h2>
            </div>

            <form onSubmit={handleMudarPassword} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Nova Password
                </label>
                <input
                  type="password"
                  value={novaPassword}
                  onChange={(e) => { setNovaPassword(e.target.value); setFeedbackPassword(null); }}
                  onFocus={() => haptics.light()}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Confirmar Password
                </label>
                <input
                  type="password"
                  value={confirmarPassword}
                  onChange={(e) => { setConfirmarPassword(e.target.value); setFeedbackPassword(null); }}
                  onFocus={() => haptics.light()}
                  placeholder="Repetir password"
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>

              {feedbackPassword && (
                <div className={`flex items-center gap-3 p-4 rounded-lg text-sm font-medium animate-in slide-in-from-top-2 duration-300 ${
                  feedbackPassword.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20"
                    : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-500/20"
                }`}>
                  {feedbackPassword.type === "success"
                    ? <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                  {feedbackPassword.message}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingPassword || !novaPassword || !confirmarPassword}
                  className="px-6 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold text-sm rounded-lg hover:bg-gray-800 dark:hover:bg-white transition-colors"
                >
                  {savingPassword ? "A mudar..." : "Alterar Password"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          {/* Metadata */}
          <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700/60 sticky top-8">
            <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6 border-b border-gray-200 dark:border-gray-700/60 pb-3">
              Informações Técnicas
            </h2>
            <div className="space-y-6">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">Conta Registada</span>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{formatDate(profileInicial.criado_em)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">Última Atividade</span>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{formatDate(profileInicial.atualizado_em)}</span>
              </div>
              {profileInicial.role === "admin_fiskix" && (
                <div className="flex flex-col gap-1.5 pt-4 border-t border-gray-200 dark:border-gray-700/60">
                   <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">
                    <Shield className="w-3 h-3" /> UID de Segurança
                  </div>
                  <code className="text-[10px] bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700/60 text-gray-500 break-all select-all">
                    {profileInicial.id}
                  </code>
                </div>
              )}
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700/60">
                <p className="text-[10px] text-gray-400 leading-tight">
                  Os dados do seu perfil são partilhados apenas com administradores da plataforma para gestão de acessos e auditoria.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
