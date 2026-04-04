"use client";

import { useState } from "react";
import { Shield, User, Clock, KeyRound, CheckCircle, AlertCircle } from "lucide-react";
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
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type FeedbackState = { type: "success" | "error"; message: string } | null;

export function PerfilClient({ profile: profileInicial, email }: Props) {
  const supabase = createClient();

  // Informação pessoal
  const [nome, setNome] = useState(profileInicial.nome_completo);
  const [savingNome, setSavingNome] = useState(false);
  const [feedbackNome, setFeedbackNome] = useState<FeedbackState>(null);

  // Segurança
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

    if (error) {
      setFeedbackNome({ type: "error", message: "Erro ao guardar: " + error.message });
    } else {
      setFeedbackNome({ type: "success", message: "Nome atualizado com sucesso." });
    }
    setSavingNome(false);
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

    if (error) {
      setFeedbackPassword({ type: "error", message: "Erro ao mudar password: " + error.message });
    } else {
      setFeedbackPassword({ type: "success", message: "Password alterada com sucesso." });
      setNovaPassword("");
      setConfirmarPassword("");
    }
    setSavingPassword(false);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="font-bold text-slate-900">Meu Perfil</h1>
        <p className="text-sm text-slate-400">Gerencie as suas informações pessoais e segurança</p>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-6">

        {/* Card: Informação Pessoal */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="font-semibold text-slate-900">Informação Pessoal</h2>
          </div>

          {/* Avatar + badges */}
          <div className="flex items-start gap-5 mb-6">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-blue-700">
                {getInitials(nome || profileInicial.nome_completo)}
              </span>
            </div>
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  {ROLE_LABELS[profileInicial.role]}
                </span>
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                  {profileInicial.id_zona?.replace(/_/g, " ") ?? "Acesso Global"}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    profileInicial.ativo
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {profileInicial.ativo ? "Ativo" : "Inativo"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Conta criada em {formatDate(profileInicial.criado_em)}
              </p>
            </div>
          </div>

          <form onSubmit={handleGuardarNome} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Nome completo
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => { setNome(e.target.value); setFeedbackNome(null); }}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
              />
            </div>

            {feedbackNome && (
              <div
                className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                  feedbackNome.type === "success"
                    ? "bg-green-50 border border-green-200 text-green-700"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}
              >
                {feedbackNome.type === "success" ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                {feedbackNome.message}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingNome || !nome.trim() || nome.trim() === profileInicial.nome_completo}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {savingNome ? "A guardar..." : "Guardar alterações"}
              </button>
            </div>
          </form>
        </div>

        {/* Card: Segurança */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-amber-600" />
            </div>
            <h2 className="font-semibold text-slate-900">Segurança</h2>
          </div>

          <form onSubmit={handleMudarPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Nova password
              </label>
              <input
                type="password"
                value={novaPassword}
                onChange={(e) => { setNovaPassword(e.target.value); setFeedbackPassword(null); }}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Confirmar nova password
              </label>
              <input
                type="password"
                value={confirmarPassword}
                onChange={(e) => { setConfirmarPassword(e.target.value); setFeedbackPassword(null); }}
                placeholder="Repetir password"
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {feedbackPassword && (
              <div
                className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                  feedbackPassword.type === "success"
                    ? "bg-green-50 border border-green-200 text-green-700"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}
              >
                {feedbackPassword.type === "success" ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                {feedbackPassword.message}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingPassword || !novaPassword || !confirmarPassword}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {savingPassword ? "A mudar..." : "Mudar password"}
              </button>
            </div>
          </form>
        </div>

        {/* Card: Informações do Sistema */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-slate-500" />
            </div>
            <h2 className="font-semibold text-slate-900">Informações do Sistema</h2>
          </div>

          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <dt className="text-slate-500">Conta criada em</dt>
              <dd className="text-slate-700 font-medium">{formatDate(profileInicial.criado_em)}</dd>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <dt className="text-slate-500">Última atualização</dt>
              <dd className="text-slate-700 font-medium">{formatDate(profileInicial.atualizado_em)}</dd>
            </div>
            {profileInicial.role === "admin_fiskix" && (
              <div className="flex items-center justify-between py-2">
                <dt className="text-slate-500 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> ID de utilizador
                </dt>
                <dd className="text-slate-400 font-mono text-xs">{profileInicial.id}</dd>
              </div>
            )}
          </dl>
        </div>

      </main>
    </div>
  );
}
