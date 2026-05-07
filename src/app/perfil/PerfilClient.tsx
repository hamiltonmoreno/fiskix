"use client";

import { useEffect, useMemo, useState } from "react";
import { Shield, CheckCircle, AlertCircle, ClipboardList, Bell, Calendar, LogIn } from "lucide-react";
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
  admin_fiskix:  "Administrador",
  diretor:       "Diretor",
  gestor_perdas: "Gestor de Perdas",
  supervisor:    "Supervisor",
  fiscal:        "Fiscal",
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin_fiskix:  "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20",
  diretor:       "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/20",
  gestor_perdas: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
  supervisor:    "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
  fiscal:        "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
};

const AVATAR_COLORS: Record<UserRole, string> = {
  admin_fiskix:  "from-red-600 to-rose-700",
  diretor:       "from-violet-600 to-purple-700",
  gestor_perdas: "from-blue-600 to-indigo-700",
  supervisor:    "from-amber-500 to-orange-600",
  fiscal:        "from-emerald-500 to-teal-600",
};

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

type FeedbackState = { type: "success" | "error"; message: string } | null;

const inputClass =
  "w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700/60 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all duration-200 placeholder:text-gray-400";

interface Stats {
  inspecoes: number;
  alertasGerados: number;
  ultimaInspecao: string | null;
}

export function PerfilClient({ profile: profileInicial, email }: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [nome, setNome] = useState(profileInicial.nome_completo);
  const [savingNome, setSavingNome] = useState(false);
  const [feedbackNome, setFeedbackNome] = useState<FeedbackState>(null);

  const [novaPassword, setNovaPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [feedbackPassword, setFeedbackPassword] = useState<FeedbackState>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [stats, setStats] = useState<Stats>({ inspecoes: 0, alertasGerados: 0, ultimaInspecao: null });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingStats(true);
      try {
        const [inspecoesRes, alertasRes, ultimaInsp] = await Promise.all([
          supabase
            .from("relatorios_inspecao")
            .select("id", { count: "exact", head: true })
            .eq("id_fiscal", profileInicial.id),
          supabase
            .from("alertas_fraude")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("relatorios_inspecao")
            .select("criado_em")
            .eq("id_fiscal", profileInicial.id)
            .order("criado_em", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        if (!cancelled) {
          setStats({
            inspecoes: inspecoesRes.count ?? 0,
            alertasGerados: alertasRes.count ?? 0,
            ultimaInspecao: ultimaInsp.data?.criado_em ?? null,
          });
        }
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, profileInicial.id]);

  async function handleGuardarNome(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSavingNome(true);
    setFeedbackNome(null);
    haptics.medium();
    try {
      const { error } = await supabase
        .from("perfis")
        .update({ nome_completo: nome.trim() })
        .eq("id", profileInicial.id);
      setFeedbackNome(
        error
          ? { type: "error", message: "Erro ao guardar: " + error.message }
          : { type: "success", message: "Nome atualizado com sucesso." }
      );
    } finally {
      setSavingNome(false);
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
    try {
      const { error } = await supabase.auth.updateUser({ password: novaPassword });
      if (error) {
        setFeedbackPassword({ type: "error", message: "Erro ao mudar password: " + error.message });
      } else {
        setFeedbackPassword({ type: "success", message: "Password alterada com sucesso." });
        setNovaPassword("");
        setConfirmarPassword("");
      }
    } finally {
      setSavingPassword(false);
    }
  }

  const avatarGradient = AVATAR_COLORS[profileInicial.role] ?? "from-blue-600 to-indigo-700";
  const nomeAlterado = nome.trim() !== profileInicial.nome_completo && nome.trim().length > 0;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">

      {/* ── Profile Hero ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700/60 shadow-sm p-6 sm:p-8 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center flex-shrink-0 shadow-lg`}>
            <span className="text-2xl font-bold text-white tracking-wide">
              {getInitials(nome || profileInicial.nome_completo)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 truncate">
              {nome || profileInicial.nome_completo}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${ROLE_COLORS[profileInicial.role]}`}>
                {ROLE_LABELS[profileInicial.role]}
              </span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                {profileInicial.id_zona?.replace(/_/g, " ") ?? "Acesso global"}
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                profileInicial.ativo
                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${profileInicial.ativo ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
                {profileInicial.ativo ? "Conta ativa" : "Inativa"}
              </span>
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1 text-right shrink-0">
            <span className="text-xs text-gray-400 dark:text-gray-500">Membro desde</span>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{formatDate(profileInicial.criado_em)}</span>
          </div>
        </div>
      </div>

      {/* ── Activity Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard icon={ClipboardList} label="Inspeções realizadas" value={loadingStats ? "—" : String(stats.inspecoes)} tone="emerald" />
        <StatCard icon={Bell} label="Alertas no sistema" value={loadingStats ? "—" : String(stats.alertasGerados)} tone="amber" />
        <StatCard icon={Calendar} label="Conta criada" value={formatDate(profileInicial.criado_em)} tone="blue" small />
        <StatCard icon={LogIn} label="Última atualização" value={formatDate(profileInicial.atualizado_em)} tone="violet" small />
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left: editable fields */}
        <div className="lg:col-span-7 space-y-6">

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700/60">
            <div className="flex items-center gap-2 mb-5">
              <Icon name="person" size="xs" className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Informações pessoais</h2>
            </div>

            <form onSubmit={handleGuardarNome} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Nome completo</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => { setNome(e.target.value); setFeedbackNome(null); }}
                  onFocus={() => haptics.light()}
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Email institucional</label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    disabled
                    className={inputClass + " opacity-60 cursor-not-allowed pr-10"}
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <Icon name="lock" size="xs" className="text-gray-400" />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">O email só pode ser alterado pelo administrador.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Perfil / Função</label>
                  <input type="text" value={ROLE_LABELS[profileInicial.role]} disabled className={inputClass + " opacity-60 cursor-not-allowed"} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Zona de atuação</label>
                  <input type="text" value={profileInicial.id_zona?.replace(/_/g, " ") ?? "Acesso global"} disabled className={inputClass + " opacity-60 cursor-not-allowed"} />
                </div>
              </div>

              {feedbackNome && <Feedback state={feedbackNome} />}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={savingNome || !nomeAlterado}
                  className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-40 text-white rounded-lg font-medium text-sm transition-colors shadow-sm cursor-pointer"
                >
                  {savingNome ? "A guardar…" : "Guardar nome"}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700/60">
            <div className="flex items-center gap-2 mb-5">
              <Icon name="lock" size="xs" className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Segurança e credenciais</h2>
            </div>

            <form onSubmit={handleMudarPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Nova password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={novaPassword}
                    onChange={(e) => { setNovaPassword(e.target.value); setFeedbackPassword(null); }}
                    onFocus={() => haptics.light()}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                    className={inputClass + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <Icon name={showPassword ? "visibility_off" : "visibility"} size="xs" />
                  </button>
                </div>
                {novaPassword.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className={`h-1 flex-1 rounded-full transition-colors ${novaPassword.length >= 8 ? "bg-emerald-500" : "bg-red-400"}`} />
                    <span className={`text-[10px] font-medium ${novaPassword.length >= 8 ? "text-emerald-600" : "text-red-500"}`}>
                      {novaPassword.length >= 8 ? "Forte" : `${8 - novaPassword.length} caracteres em falta`}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Confirmar password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmarPassword}
                    onChange={(e) => { setConfirmarPassword(e.target.value); setFeedbackPassword(null); }}
                    onFocus={() => haptics.light()}
                    placeholder="Repetir password"
                    autoComplete="new-password"
                    className={inputClass + " pr-10"}
                  />
                  {confirmarPassword.length > 0 && (
                    <div className="absolute inset-y-0 right-3 flex items-center">
                      {confirmarPassword === novaPassword
                        ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                        : <AlertCircle className="w-4 h-4 text-red-500" />}
                    </div>
                  )}
                </div>
              </div>

              {feedbackPassword && <Feedback state={feedbackPassword} />}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={savingPassword || !novaPassword || !confirmarPassword}
                  className="px-5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium text-sm rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {savingPassword ? "A mudar…" : "Alterar password"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right: metadata */}
        <div className="lg:col-span-5 space-y-4">

          {stats.ultimaInspecao && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700/60">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Última inspeção</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                {formatDateShort(stats.ultimaInspecao)}
              </p>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700/60">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="manage_accounts" size="xs" className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Detalhes da conta</h3>
            </div>
            <div className="space-y-0">
              <InfoRow label="ID de utilizador" value={profileInicial.id.slice(0, 8) + "…"} mono />
              <InfoRow label="Criado em" value={formatDate(profileInicial.criado_em)} />
              <InfoRow label="Última modificação" value={formatDate(profileInicial.atualizado_em)} />
              <InfoRow label="Estado" value={profileInicial.ativo ? "Ativa" : "Inativa"} />
            </div>
          </div>

          {profileInicial.role === "admin_fiskix" && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700/60">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">UID de segurança</h3>
              </div>
              <code className="block text-[10px] bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 break-all select-all font-mono">
                {profileInicial.id}
              </code>
            </div>
          )}

          <p className="text-[11px] text-gray-400 dark:text-gray-500 px-1 leading-relaxed">
            Os dados do seu perfil são partilhados apenas com administradores da plataforma para gestão de acessos e auditoria interna.
          </p>
        </div>
      </div>
    </div>
  );
}

function Feedback({ state }: { state: { type: "success" | "error"; message: string } }) {
  return (
    <div className={`flex items-center gap-2.5 p-3.5 rounded-lg text-sm font-medium ${
      state.type === "success"
        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20"
        : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-500/20"
    }`}>
      {state.type === "success"
        ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
        : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      {state.message}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  small,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: "emerald" | "amber" | "blue" | "violet";
  small?: boolean;
}) {
  const palettes = {
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
    amber:   "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
    blue:    "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
    violet:  "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400",
  };
  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{label}</span>
        <div className={`p-1.5 rounded-lg ${palettes[tone]} shrink-0`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className={`font-bold text-gray-900 dark:text-gray-100 ${small ? "text-sm" : "text-2xl"}`}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 dark:border-gray-700/40 last:border-0">
      <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
      <span className={`text-xs font-medium text-gray-700 dark:text-gray-200 text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
