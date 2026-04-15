"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";

interface TopBarProps {
  profile: {
    role: string;
    nome_completo: string;
    id_zona: string | null;
  };
}

const SEGMENT_LABELS: Record<string, string> = {
  dashboard:    "Dashboard",
  alertas:      "Alertas",
  admin:        "Administração",
  importar:     "Importar Dados",
  scoring:      "Motor de Scoring",
  utilizadores: "Utilizadores",
  configuracao: "Configuração",
  "api-keys":   "API Keys",
  perfil:       "O Meu Perfil",
  relatorios:   "Relatórios",
  mobile:       "Mobile",
  report:       "Relatório",
};

const ROLE_LABELS: Record<string, string> = {
  admin_fiskix:  "Admin",
  gestor_perdas: "Gestor",
  supervisor:    "Supervisor",
  fiscal:        "Fiscal",
  diretor:       "Diretor",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function TopBar({ profile }: TopBarProps) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const isDashboard = pathname === "/dashboard";

  const crumbs = segments.map((seg, i) => ({
    label: SEGMENT_LABELS[seg] ?? seg,
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  return (
    <div
      className={cn(
        "sticky top-0 z-30 h-14 flex items-center justify-between px-6 gap-4",
        "bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl",
        "border-b border-slate-100/60 dark:border-white/8",
        "shadow-sm shadow-blue-900/4 no-print"
      )}
    >
      {/* ── Left: Breadcrumb ── */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm min-w-0">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded flex-shrink-0"
          aria-label="Início"
        >
          <Icon name="home" size="xs" />
        </Link>
        {crumbs.map((crumb) => (
          <span key={crumb.href} className="flex items-center gap-1 min-w-0">
            <Icon name="chevron_right" size="xs" className="text-border flex-shrink-0" />
            {crumb.isLast ? (
              <span
                className="text-foreground font-semibold truncate"
                aria-current="page"
              >
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-muted-foreground hover:text-foreground transition-colors truncate"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* ── Right: Actions + User ── */}
      <div className="flex items-center gap-2 flex-shrink-0">

        {/* "Monitoramento Ao Vivo" pill — dashboard only */}
        {isDashboard && (
          <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-[#007AFF] bg-[#d8e2ff]/40 rounded-full text-xs font-semibold select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] animate-pulse" />
            Ao Vivo
          </span>
        )}

        {/* Notification bell */}
        <button
          className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
          aria-label="Notificações"
        >
          <Icon name="notifications" size="sm" />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#ba1a1a] rounded-full border-2 border-white dark:border-slate-950"
            aria-hidden="true"
          />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-border mx-1" />

        {/* User info */}
        <Link
          href="/perfil"
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
            {getInitials(profile.nome_completo)}
          </div>
          <div className="hidden md:flex flex-col items-start leading-none">
            <span className="text-[12px] font-semibold text-foreground truncate max-w-[120px]">
              {profile.nome_completo.split(" ")[0]}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {ROLE_LABELS[profile.role] ?? profile.role}
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}
