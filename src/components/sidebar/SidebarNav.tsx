import Link from "next/link";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/Icon";
import { NavGroup } from "./NavGroup";
import { NavLink } from "./NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { haptics } from "@/lib/haptics";
import type { NavItem } from "./types";

const MONITORAMENTO: NavItem[] = [
  { label: "Dashboard",  href: "/dashboard",  icon: "dashboard" },
  { label: "Alertas",    href: "/alertas",    icon: "notifications_active" },
  { label: "Clientes",   href: "/clientes",   icon: "groups" },
  { label: "Balanço",    href: "/balanco",    icon: "query_stats" },
  { label: "Relatórios", href: "/relatorios", icon: "insert_chart" },
];

const OPERACOES: NavItem[] = [
  { label: "Inspeções",        href: "/inspecoes",       icon: "fact_check" },
  { label: "Notificações SMS", href: "/notificacoes",    icon: "sms" },
  { label: "Recuperação",      href: "/recuperacao",     icon: "savings" },
  { label: "Motor de Scoring", href: "/admin/scoring",   icon: "analytics" },
];

const CONFIGURACOES: NavItem[] = [
  { label: "Importar Dados", href: "/admin/importar",     icon: "upload_file" },
  { label: "Utilizadores",   href: "/admin/utilizadores", icon: "group",    superAdminOnly: true },
  { label: "Configuração",   href: "/admin/configuracao", icon: "settings", superAdminOnly: true },
  { label: "API Keys",       href: "/admin/api-keys",     icon: "key",      superAdminOnly: true },
];

const ROLE_LABELS: Record<string, string> = {
  admin_fiskix:  "Administrador",
  gestor_perdas: "Gestor de Perdas",
  supervisor:    "Supervisor",
  fiscal:        "Fiscal",
  diretor:       "Diretor",
};

interface SidebarNavProps {
  profile: { role: string; nome_completo: string };
  collapsed: boolean;
  isActive: (href: string) => boolean;
  onToggleCollapsed: () => void;
  onSignOut: () => void;
}

export function SidebarNav({ profile, collapsed, isActive, onToggleCollapsed, onSignOut }: SidebarNavProps) {
  const isAdmin      = ["admin_fiskix", "gestor_perdas"].includes(profile.role);
  const isSuperAdmin = profile.role === "admin_fiskix";
  const isRelatorios = ["admin_fiskix", "diretor", "gestor_perdas"].includes(profile.role);
  const hasOps       = ["admin_fiskix", "diretor", "gestor_perdas", "supervisor"].includes(profile.role);
  const hasFinance   = ["admin_fiskix", "diretor", "gestor_perdas"].includes(profile.role);

  return (
    <div className="flex flex-col h-full mosaic-scrollbar">

      {/* ── Logo / Workspace Header ── */}
      <div className={cn(
        "flex items-center gap-3 h-16 flex-shrink-0 border-b border-gray-200 dark:border-gray-700/60",
        collapsed ? "justify-center px-2" : "px-5"
      )}>
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-sm">
          <Icon name="bolt" size="sm" filled className="text-white" />
        </div>
        <div className={cn(
          "overflow-hidden transition-[width,opacity] duration-300 min-w-0",
          collapsed ? "w-0 opacity-0" : "w-40 opacity-100"
        )}>
          <p className="font-bold text-gray-800 dark:text-gray-100 leading-tight whitespace-nowrap text-sm">
            Fiskix Energy
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-tight whitespace-nowrap">
            Cabo Verde
          </p>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-4 space-y-6 pb-4">
        <NavGroup
          label="Monitoramento"
          items={MONITORAMENTO.filter((item) => {
            if (item.href === "/relatorios" || item.href === "/balanco") return isRelatorios;
            if (item.href === "/clientes") return hasOps;
            return true;
          })}
          collapsed={collapsed}
          isActive={isActive}
        />
        {hasOps && (
          <NavGroup
            label="Operações"
            items={OPERACOES.filter((item) => {
              if (item.href === "/admin/scoring") return isAdmin;
              if (item.href === "/recuperacao") return hasFinance;
              return true;
            })}
            collapsed={collapsed}
            isActive={isActive}
          />
        )}
        {isAdmin && (
          <NavGroup
            label="Configurações"
            items={CONFIGURACOES.filter((i) => !i.superAdminOnly || isSuperAdmin)}
            collapsed={collapsed}
            isActive={isActive}
          />
        )}
      </nav>

      {/* ── CTA Button ── */}
      {!collapsed && (
        <div className="px-4 pb-3">
          <Link
            href="/relatorios"
            className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium text-sm shadow-sm transition-colors active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
          >
            <Icon name="summarize" size="sm" className="text-white" />
            Relatório Diário
          </Link>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="border-t border-gray-200 dark:border-gray-700/60 pt-3 pb-4 mt-auto space-y-1 px-3">
        {/* Theme toggle */}
        <ThemeToggle collapsed={collapsed} />

        {/* User profile link */}
        <NavLink
          href="/perfil"
          icon="account_circle"
          label={collapsed ? "" : profile.nome_completo}
          sub={collapsed ? undefined : (ROLE_LABELS[profile.role] ?? profile.role)}
          active={isActive("/perfil")}
          collapsed={collapsed}
        />

        {/* Sign out */}
        <button
          onClick={() => {
            haptics.heavy();
            onSignOut();
          }}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium cursor-pointer touch-manipulation",
            "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20",
            collapsed && "justify-center px-2"
          )}
          aria-label="Terminar sessão"
        >
          <Icon name="logout" size="sm" className="flex-shrink-0" />
          <span className={cn(
            "overflow-hidden transition-[width,opacity] duration-300 whitespace-nowrap",
            collapsed ? "w-0 opacity-0" : "w-full opacity-100"
          )}>
            Sair
          </span>
        </button>

        {/* Expand/Collapse toggle (desktop only) */}
        <button
          onClick={() => {
            haptics.light();
            onToggleCollapsed();
          }}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          className="hidden lg:flex w-full items-center justify-center p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
        >
          <Icon name={collapsed ? "chevron_right" : "chevron_left"} size="sm" />
        </button>
      </div>
    </div>
  );
}
