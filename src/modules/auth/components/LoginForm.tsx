"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

/* ── Energy grid topology ─────────────────────────────── */
const NODES = [
  { x: 55,  y: 105, r: 4 },
  { x: 195, y: 58,  r: 5 },
  { x: 358, y: 118, r: 3 },
  { x: 95,  y: 248, r: 6 },
  { x: 265, y: 205, r: 5 },
  { x: 390, y: 285, r: 4 },
  { x: 148, y: 378, r: 4 },
  { x: 312, y: 435, r: 5 },
  { x: 82,  y: 448, r: 3 },
  { x: 232, y: 520, r: 4 },
];

const EDGES: [number, number][] = [
  [0, 1], [1, 2], [0, 3], [1, 4], [2, 5],
  [3, 4], [4, 5], [3, 6], [4, 7], [6, 8],
  [7, 9], [8, 9], [3, 8], [1, 3],
];

const inputClass =
  "w-full px-4 py-2.5 bg-surface-container-low text-on-surface rounded-xl text-sm " +
  "border-none focus:outline-none focus:ring-2 focus:ring-primary/30 " +
  "placeholder:text-on-surface-variant/40 transition-shadow";

export function LoginForm() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
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

      {/* ── LEFT PANEL ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 relative overflow-hidden"
        style={{ background: "#07102e" }}
        aria-hidden="true"
      >
        {/* Energy grid SVG */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 420 600"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="ambient" cx="55%" cy="45%" r="60%">
              <stop offset="0%" stopColor="#0058bc" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#07102e"  stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Ambient glow */}
          <rect width="420" height="600" fill="url(#ambient)" />

          {/* Static base edges */}
          {EDGES.map(([from, to], i) => (
            <line
              key={`base-${i}`}
              x1={NODES[from].x} y1={NODES[from].y}
              x2={NODES[to].x}   y2={NODES[to].y}
              stroke="#0058bc"
              strokeWidth="1"
              strokeOpacity="0.22"
            />
          ))}

          {/* Animated pulse edges */}
          {EDGES.map(([from, to], i) => (
            <line
              key={`pulse-${i}`}
              x1={NODES[from].x} y1={NODES[from].y}
              x2={NODES[to].x}   y2={NODES[to].y}
              stroke="#60a5fa"
              strokeWidth="1.5"
              strokeLinecap="round"
              filter="url(#line-glow)"
              style={{
                animation: `energy-pulse ${2.2 + (i % 5) * 0.5}s ease-in-out ${i * 0.28}s infinite`,
              }}
            />
          ))}

          {/* Nodes */}
          {NODES.map((n, i) => (
            <g key={i} filter="url(#node-glow)">
              {/* Expanding ring */}
              <circle
                cx={n.x} cy={n.y} r={n.r + 4}
                fill="none"
                stroke="#0058bc"
                strokeWidth="1"
                style={{
                  animation: `node-ring ${3 + i * 0.25}s ease-out ${i * 0.35}s infinite`,
                  transformOrigin: `${n.x}px ${n.y}px`,
                }}
              />
              {/* Core dot */}
              <circle
                cx={n.x} cy={n.y} r={n.r}
                fill="#93c5fd"
              />
            </g>
          ))}
        </svg>

        {/* Logo */}
        <div className="relative z-10 px-10 pt-12 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0"
            style={{ background: "#0058bc", boxShadow: "0 8px 24px rgba(0,88,188,0.4)" }}
          >
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
              <path d="M13 3L4 14h7l-1 7 9-11h-7z" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-white text-[15px] leading-tight">Fiskix Energy</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest leading-tight">
              Cabo Verde Operations
            </p>
          </div>
        </div>

        {/* Hero text + stats */}
        <div className="relative z-10 px-10 pb-12 space-y-7">
          <div>
            <p className="text-[10px] font-bold text-[#60a5fa] uppercase tracking-[0.2em] mb-4">
              Sistema de Fiscalização
            </p>
            <h2 className="text-[2.5rem] font-bold tracking-tighter text-white leading-none">
              Deteção de
              <br />
              <span style={{ color: "#60a5fa" }}>Fraudes</span>
              <br />
              em Energia
            </h2>
            <p className="text-sm text-slate-400 mt-4 leading-relaxed max-w-[260px]">
              Motor de scoring com 9 regras. Perdas comerciais detectadas em tempo real.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Regras de scoring", value: "9" },
              { label: "Zonas activas",     value: "4" },
              { label: "Precisão do motor", value: "94%" },
              { label: "Uptime",            value: "99.9%" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl p-3.5"
                style={{
                  background: "rgba(0,88,188,0.1)",
                  border: "1px solid rgba(0,88,188,0.2)",
                }}
              >
                <p className="text-2xl font-bold text-white tabular-nums leading-none">
                  {stat.value}
                </p>
                <p className="text-[10px] text-slate-500 mt-1 leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-8 py-12">

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#0058bc" }}
          >
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
              <path d="M13 3L4 14h7l-1 7 9-11h-7z" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-on-surface text-[15px] leading-tight">Fiskix</p>
            <p className="text-[10px] text-on-surface-variant leading-tight">Electra Cabo Verde</p>
          </div>
        </div>

        <div className="w-full max-w-sm">

          {/* Form header */}
          <div className="mb-8">
            <p className="text-xs font-bold text-primary uppercase tracking-[0.15em] mb-2">
              Plataforma de Gestão
            </p>
            <h1 className="text-[2.5rem] font-bold tracking-tighter text-on-surface leading-none">
              Entrar
            </h1>
            <p className="text-sm text-on-surface-variant mt-2">
              Acesso restrito a utilizadores autorizados
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1.5"
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
                className={inputClass}
                placeholder="gestor@electra.cv"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1.5"
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
                className={inputClass}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#ffdad6]/30">
                <AlertCircle className="w-4 h-4 text-[#ba1a1a] flex-shrink-0" />
                <p className="text-sm text-[#ba1a1a]">{error}</p>
              </div>
            )}

            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-full text-sm font-bold transition-opacity cursor-pointer touch-manipulation"
              >
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
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
            </div>
          </form>

          <p className="text-center text-xs text-on-surface-variant/30 mt-10">
            Fiskix © 2026 · CONFIDENCIAL
          </p>
        </div>
      </div>
    </div>
  );
}
