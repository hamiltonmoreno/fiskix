"use client";

import { useState, useMemo } from "react";
import { Shield, KeyRound, CheckCircle, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";

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

const inputClass = "w-full px-4 py-2.5 bg-surface-container-low text-on-surface rounded-xl text-sm border-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-on-surface-variant/50";

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
    <div className="min-h-screen bg-background px-8 pt-8 pb-12">

      {/* Page hero with avatar */}
      <div className="flex items-center gap-6 mb-10">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center flex-shrink-0">
          <span className="text-xl font-bold text-white">
            {getInitials(nome || profileInicial.nome_completo)}
          </span>
        </div>
        <div>
          <p className="text-xs font-bold text-primary uppercase tracking-[0.15em] mb-1">
            Perfil
          </p>
          <h1 className="text-[2.5rem] font-bold tracking-tighter text-on-surface leading-none">
            {nome || profileInicial.nome_completo}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-bold uppercase">
              {ROLE_LABELS[profileInicial.role]}
            </span>
            <span className="px-2.5 py-0.5 bg-surface-container-high text-on-surface-variant rounded-full text-[10px] font-bold uppercase">
              {profileInicial.id_zona?.replace(/_/g, " ") ?? "Acesso Global"}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
              profileInicial.ativo ? "bg-emerald-100 text-emerald-700" : "bg-surface-container-high text-on-surface-variant"
            }`}>
              {profileInicial.ativo ? "Ativo" : "Inativo"}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-xl space-y-4">

        {/* Personal info */}
        <div className="bg-surface-container-lowest rounded-[1.5rem] p-6 shadow-sm border border-outline-variant/10">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
            Informação Pessoal
          </p>

          <form onSubmit={handleGuardarNome} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">
                Nome completo
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => { setNome(e.target.value); setFeedbackNome(null); }}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                disabled
                className={inputClass + " opacity-50 cursor-not-allowed"}
              />
            </div>

            {feedbackNome && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-xs ${
                feedbackNome.type === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-[#ffdad6]/30 text-[#ba1a1a]"
              }`}>
                {feedbackNome.type === "success"
                  ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                {feedbackNome.message}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingNome || !nome.trim() || nome.trim() === profileInicial.nome_completo}
                className="px-5 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-40 text-white rounded-full text-xs font-bold transition-opacity cursor-pointer touch-manipulation"
              >
                {savingNome ? "A guardar..." : "Guardar alterações"}
              </button>
            </div>
          </form>
        </div>

        {/* Security */}
        <div className="bg-surface-container-lowest rounded-[1.5rem] p-6 shadow-sm border border-outline-variant/10">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="w-4 h-4 text-on-surface-variant" />
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Segurança
            </p>
          </div>

          <form onSubmit={handleMudarPassword} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">
                Nova password
              </label>
              <input
                type="password"
                value={novaPassword}
                onChange={(e) => { setNovaPassword(e.target.value); setFeedbackPassword(null); }}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">
                Confirmar password
              </label>
              <input
                type="password"
                value={confirmarPassword}
                onChange={(e) => { setConfirmarPassword(e.target.value); setFeedbackPassword(null); }}
                placeholder="Repetir password"
                autoComplete="new-password"
                className={inputClass}
              />
            </div>

            {feedbackPassword && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-xs ${
                feedbackPassword.type === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-[#ffdad6]/30 text-[#ba1a1a]"
              }`}>
                {feedbackPassword.type === "success"
                  ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                {feedbackPassword.message}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingPassword || !novaPassword || !confirmarPassword}
                className="px-5 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-40 text-white rounded-full text-xs font-bold transition-opacity cursor-pointer touch-manipulation"
              >
                {savingPassword ? "A mudar..." : "Mudar password"}
              </button>
            </div>
          </form>
        </div>

        {/* System info */}
        <div className="bg-surface-container-lowest rounded-[1.5rem] p-6 shadow-sm border border-outline-variant/10">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
            Informações do Sistema
          </p>
          <dl className="space-y-3">
            <div className="flex items-center justify-between">
              <dt className="text-xs text-on-surface-variant">Conta criada em</dt>
              <dd className="text-xs font-bold text-on-surface">{formatDate(profileInicial.criado_em)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-xs text-on-surface-variant">Última atualização</dt>
              <dd className="text-xs font-bold text-on-surface">{formatDate(profileInicial.atualizado_em)}</dd>
            </div>
            {profileInicial.role === "admin_fiskix" && (
              <div className="flex items-center justify-between">
                <dt className="text-xs text-on-surface-variant flex items-center gap-1.5">
                  <Shield className="w-3 h-3" /> ID de utilizador
                </dt>
                <dd className="text-[10px] font-mono text-on-surface-variant/60">{profileInicial.id}</dd>
              </div>
            )}
          </dl>
        </div>

      </div>
    </div>
  );
}
