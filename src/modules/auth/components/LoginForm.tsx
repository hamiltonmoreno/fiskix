"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, AlertCircle } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError("Email ou password incorretos.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-stretch">
      {/* Left panel — decorativo */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 bg-sidebar px-10 py-12 relative overflow-hidden"
        aria-hidden="true"
      >
        {/* Grid de fundo */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.04]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Círculo decorativo */}
        <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
        <div className="absolute top-20 -left-20 w-60 h-60 rounded-full bg-indigo-500/5 blur-2xl pointer-events-none" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/40">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-lg leading-tight">Fiskix</p>
            <p className="text-[11px] text-slate-400 leading-tight">Electra Cabo Verde</p>
          </div>
        </div>

        {/* Tagline */}
        <div className="relative space-y-4">
          <h2 className="font-heading text-4xl text-white leading-tight [text-wrap:balance]">
            Fiscalização
            <br />
            <span className="text-indigo-400">Inteligente</span>
            <br />
            de Energia
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
            Motor de scoring com 9 regras. Deteção de fraudes e perdas comerciais em tempo real.
          </p>
        </div>

        {/* Stats decorativos */}
        <div className="relative grid grid-cols-2 gap-3">
          {[
            { label: "Regras de scoring", value: "9" },
            { label: "Zonas monitorizadas", value: "4" },
            { label: "Precisão do motor", value: "94%" },
            { label: "Alertas gerados", value: "∞" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/5 rounded-xl p-3 border border-white/8">
              <p className="font-heading text-2xl text-white tabular-nums">{stat.value}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — formulário */}
      <div className="flex-1 flex flex-col items-center justify-center bg-background px-6 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-10">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Zap className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <p className="font-bold text-foreground text-lg leading-tight">Fiskix</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Electra Cabo Verde</p>
          </div>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="font-heading text-3xl text-foreground">Entrar</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Acesso restrito a utilizadores autorizados
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-sm font-medium text-foreground"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3.5 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent transition-shadow"
                placeholder="gestor@electra.cv"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3.5 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent transition-shadow"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2.5 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-medium rounded-lg text-sm transition-[background-color,transform] active:scale-[0.98] touch-manipulation"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                  A entrar…
                </span>
              ) : (
                "Entrar na plataforma"
              )}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground/60 mt-10">
            Fiskix © 2026 · CONFIDENCIAL
          </p>
        </div>
      </div>
    </div>
  );
}
