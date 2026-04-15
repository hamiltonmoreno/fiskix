import Link from "next/link";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/Icon";
import { NavGroup } from "./NavGroup";
import { NavLink } from "./NavLink";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
  superAdminOnly?: boolean;
}

const MONITORAMENTO: NavItem[] = [
  { label: "Dashboard",  href: "/dashboard",  icon: "dashboard" },
  { label: "Alertas",    href: "/alertas",    icon: "notifications_active" },
  { label: "Relatórios", href: "/relatorios", icon: "insert_chart" },
];

const OPERACOES: NavItem[] = [
  { label: "Motor de Scoring", href: "/admin/scoring", icon: "analytics" },
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

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Logo / Workspace Header */}
      <div className={cn("flex items-center gap-3 px-6 py-6", collapsed && "justify-center px-3")}>
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-primary/20">
          <Icon name="bolt" size="md" filled className="text-white" />
        </div>
        <div className={cn(
          "overflow-hidden transition-[width,opacity] duration-300 min-w-0",
          collapsed ? "w-0 opacity-0" : "w-44 opacity-100"
        )}>
          <p className="font-bold text-[#1a1c1f] dark:text-white leading-tight whitespace-nowrap text-[15px]">
            Fiskix Energy
          </p>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-tight whitespace-nowrap">
            Cabo Verde Operations
          </p>
        </div>
        {!collapsed && (
          <button
            onClick={onToggleCollapsed}
            title="Recolher menu"
            aria-label="Recolher menu lateral"
            className="ml-auto p-1 text-slate-400 hover:text-slate-700 hidden lg:flex cursor-pointer touch-manipulation flex-shrink-0 transition-colors"
          >
            <Icon name="chevron_left" size="sm" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-6 pb-4">
        <NavGroup
          label="Monitoramento"
          items={MONITORAMENTO.filter((item) => item.href !== "/relatorios" || isRelatorios)}
          collapsed={collapsed}
          isActive={isActive}
        />
        {isAdmin && (
          <NavGroup label="Operações" items={OPERACOES} collapsed={collapsed} isActive={isActive} />
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

      {/* CTA Button */}
      {!collapsed && (
        <div className="px-4 pb-2">
          <Link
            href="/relatorios"
            className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-sm shadow-lg shadow-primary/15 transition-[opacity] active:scale-95 flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
          >
            <Icon name="summarize" size="sm" className="text-white" />
            Relatório Diário
          </Link>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-slate-200/60 dark:border-white/8 pt-2 pb-4 mt-2 space-y-0.5 px-2">
        <NavLink
          href="/perfil"
          icon="account_circle"
          label={collapsed ? "" : profile.nome_completo}
          sub={collapsed ? undefined : (ROLE_LABELS[profile.role] ?? profile.role)}
          active={isActive("/perfil")}
          collapsed={collapsed}
        />
        <button
          onClick={onSignOut}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-2.5 text-[#ba1a1a] hover:opacity-80 rounded-lg transition-colors text-sm cursor-pointer touch-manipulation",
            collapsed && "justify-center px-3"
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
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div className="px-2 pb-4 hidden lg:block">
          <button
            onClick={onToggleCollapsed}
            aria-label="Expandir menu lateral"
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-slate-200/50 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <Icon name="chevron_right" size="sm" />
          </button>
        </div>
      )}
    </div>
  );
}
