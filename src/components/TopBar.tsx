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
  admin_fiskix:  "Admin Fiskix",
  gestor_perdas: "Gestor de Perdas",
  supervisor:    "Supervisor",
  fiscal:        "Fiscal",
  diretor:       "Diretor",
};

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
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
        "sticky top-0 z-40 h-14 flex items-center justify-between px-6 gap-4",
        "bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl",
        "border-b border-slate-100/60 dark:border-white/8",
        "shadow-sm shadow-blue-900/4 no-print"
      )}
    >
      {/* ── Left ── */}
      {isDashboard ? (
        /* Dashboard: search bar */
        <div className="relative group flex-1 max-w-sm">
          <Icon
            name="search"
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors pointer-events-none"
          />
          <input
            type="search"
            placeholder="Pesquisar medidores, bairros ou O.S..."
            className="w-full pl-9 pr-4 py-2 bg-surface-container-low border-none rounded-full text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
      ) : (
        /* Other pages: breadcrumb */
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
                <span className="text-foreground font-semibold truncate" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="text-muted-foreground hover:text-foreground transition-colors truncate">
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* ── Right ── */}
      <div className="flex items-center gap-3 flex-shrink-0">

        {/* "Monitoramento Ao Vivo" pill — dashboard only */}
        {isDashboard && (
          <button className="hidden sm:flex items-center gap-2 px-4 py-1.5 text-primary bg-primary/8 hover:bg-primary/12 rounded-full text-xs font-bold transition-colors cursor-pointer">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />
            Monitoramento Ao Vivo
          </button>
        )}

        {/* Bell */}
        <button
          className="relative p-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
          aria-label="Notificações"
        >
          <Icon name="notifications" size="sm" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#ba1a1a] rounded-full border-2 border-white dark:border-slate-950" aria-hidden="true" />
        </button>

        {/* Help */}
        <button
          className="p-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
          aria-label="Ajuda"
        >
          <Icon name="help_outline" size="sm" />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-border" />

        {/* User profile */}
        <Link
          href="/perfil"
          className="flex items-center gap-2.5 pl-1 rounded-lg hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <div className="hidden md:flex flex-col items-end leading-none">
            <span className="text-[12px] font-bold text-slate-900 dark:text-white truncate max-w-[120px]">
              {profile.nome_completo.split(" ").slice(0, 2).join(" ")}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">
              {ROLE_LABELS[profile.role] ?? profile.role}
            </span>
          </div>
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 border-2 border-white shadow-sm">
            {getInitials(profile.nome_completo)}
          </div>
        </Link>
      </div>
    </div>
  );
}
