import { cn } from "@/lib/utils";
import { NavGroup } from "./NavGroup";
import { SidebarProfileMenu } from "./SidebarProfileMenu";
import { Icon } from "@/components/Icon";
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
  { label: "Inspeções",        href: "/inspecoes",    icon: "fact_check" },
  { label: "Notificações SMS", href: "/notificacoes", icon: "sms" },
  { label: "Recuperação",      href: "/recuperacao",  icon: "savings" },
  { label: "Motor de Scoring", href: "/admin/scoring", icon: "analytics" },
];

const CONFIGURACOES: NavItem[] = [
  { label: "Importar Dados", href: "/admin/importar",     icon: "upload_file" },
  { label: "Utilizadores",   href: "/admin/utilizadores", icon: "group",    superAdminOnly: true },
  { label: "Configuração",   href: "/admin/configuracao", icon: "settings", superAdminOnly: true },
  { label: "API Keys",       href: "/admin/api-keys",     icon: "key",      superAdminOnly: true },
];

interface SidebarNavProps {
  profile: { role: string; nome_completo: string };
  collapsed: boolean;
  isActive: (href: string) => boolean;
  onToggleCollapsed: () => void;
  onSignOut: () => void;
  criticalCount?: number;
}

export function SidebarNav({ profile, collapsed, isActive, onToggleCollapsed, onSignOut, criticalCount = 0 }: SidebarNavProps) {
  const isAdmin      = ["admin_fiskix", "gestor_perdas"].includes(profile.role);
  const isSuperAdmin = profile.role === "admin_fiskix";
  const isRelatorios = ["admin_fiskix", "diretor", "gestor_perdas"].includes(profile.role);
  const hasOps       = ["admin_fiskix", "diretor", "gestor_perdas", "supervisor"].includes(profile.role);
  const hasFinance   = ["admin_fiskix", "diretor", "gestor_perdas"].includes(profile.role);

  // Build monitored items with live badge on Alertas
  const monitoramentoItems = MONITORAMENTO.filter((item) => {
    if (item.href === "/relatorios" || item.href === "/balanco") return isRelatorios;
    if (item.href === "/clientes") return hasOps;
    return true;
  }).map((item) =>
    item.href === "/alertas" && criticalCount > 0
      ? { ...item, badge: criticalCount }
      : item
  );

  const operacoesItems = OPERACOES.filter((item) => {
    if (item.href === "/admin/scoring") return isAdmin;
    if (item.href === "/recuperacao")   return hasFinance;
    return hasOps;
  });

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
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 pt-4 pb-4">
        <div className="space-y-0.5">
          <NavGroup
            label="Monitoramento"
            items={monitoramentoItems}
            collapsed={collapsed}
            isActive={isActive}
          />
        </div>

        {operacoesItems.length > 0 && (
          <div className="mt-6">
            <NavGroup
              label="Operações"
              items={operacoesItems}
              collapsed={collapsed}
              isActive={isActive}
            />
          </div>
        )}

        {isAdmin && (
          <div className="mt-6">
            <NavGroup
              label="Configurações"
              items={CONFIGURACOES.filter((i) => !i.superAdminOnly || isSuperAdmin)}
              collapsed={collapsed}
              isActive={isActive}
            />
          </div>
        )}
      </nav>

      {/* ── Footer ── */}
      <div className="border-t border-gray-200 dark:border-gray-700/60 pt-2 pb-3 mt-auto px-3 space-y-1">
        <SidebarProfileMenu
          profile={profile}
          collapsed={collapsed}
          onSignOut={onSignOut}
        />

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
