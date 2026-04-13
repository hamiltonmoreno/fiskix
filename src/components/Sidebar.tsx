"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/Icon";

interface SidebarProps {
  profile: {
    role: string;
    nome_completo: string;
    id_zona: string | null;
  };
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
  superAdminOnly?: boolean;
}

/* ── Nav groups ──────────────────────────────────────── */
const MONITORAMENTO: NavItem[] = [
  { label: "Dashboard",  href: "/dashboard", icon: "dashboard" },
  { label: "Alertas",    href: "/alertas",   icon: "notifications_active" },
  { label: "Relatórios", href: "/relatorios", icon: "insert_chart" },
];

const OPERACOES: NavItem[] = [
  { label: "Motor de Scoring", href: "/admin/scoring",   icon: "analytics" },
];

const CONFIGURACOES: NavItem[] = [
  { label: "Importar Dados", href: "/admin/importar",    icon: "upload_file" },
  { label: "Utilizadores",   href: "/admin/utilizadores", icon: "group",   superAdminOnly: true },
  { label: "Configuração",   href: "/admin/configuracao", icon: "settings", superAdminOnly: true },
  { label: "API Keys",       href: "/admin/api-keys",    icon: "key",      superAdminOnly: true },
];

const ROLE_LABELS: Record<string, string> = {
  admin_fiskix:  "Administrador",
  gestor_perdas: "Gestor de Perdas",
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

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [collapsed,  setCollapsed]  = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin      = ["admin_fiskix", "gestor_perdas"].includes(profile.role);
  const isSuperAdmin = profile.role === "admin_fiskix";
  const isRelatorios = ["admin_fiskix", "diretor", "gestor_perdas"].includes(profile.role);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) setCollapsed(saved === "true");
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  }

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  /* ── Sidebar content (shared between desktop + mobile drawer) ── */
  const sidebarContent = (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Logo / Workspace Header ── */}
      <div className={cn(
        "flex items-center gap-3 px-6 py-6",
        collapsed && "justify-center px-3"
      )}>
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
            onClick={toggleCollapsed}
            title="Recolher menu"
            aria-label="Recolher menu lateral"
            className="ml-auto p-1 text-slate-400 hover:text-slate-700 hidden lg:flex cursor-pointer touch-manipulation flex-shrink-0 transition-colors"
          >
            <Icon name="chevron_left" size="sm" />
          </button>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-6 pb-4">

        {/* MONITORAMENTO */}
        <NavGroup
          label="Monitoramento"
          items={MONITORAMENTO.filter((item) =>
            item.href !== "/relatorios" || isRelatorios
          )}
          collapsed={collapsed}
          isActive={isActive}
        />

        {/* OPERAÇÕES — admin only */}
        {isAdmin && (
          <NavGroup
            label="Operações"
            items={OPERACOES}
            collapsed={collapsed}
            isActive={isActive}
          />
        )}

        {/* CONFIGURAÇÕES — admin only */}
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

      {/* ── Footer ── */}
      <div className={cn(
        "border-t border-slate-200/60 dark:border-white/8 pt-2 pb-4 mt-2 space-y-0.5 px-2",
      )}>
        {/* Ajuda */}
        <NavLink
          href="/perfil"
          icon="account_circle"
          label={collapsed ? "" : profile.nome_completo}
          sub={collapsed ? undefined : (ROLE_LABELS[profile.role] ?? profile.role)}
          active={isActive("/perfil")}
          collapsed={collapsed}
        />

        <button
          onClick={handleSignOut}
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
            onClick={toggleCollapsed}
            aria-label="Expandir menu lateral"
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-slate-200/50 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <Icon name="chevron_right" size="sm" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-100/60 flex items-center px-4 gap-3 no-print">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-sidebar-drawer"
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 touch-manipulation cursor-pointer"
        >
          <Icon name="menu" size="md" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shadow-sm">
            <Icon name="bolt" size="xs" filled className="text-white" />
          </div>
          <span className="font-bold text-[#1a1c1f] dark:text-white">Fiskix</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        id="mobile-sidebar-drawer"
        className={cn(
          "lg:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-[#f9f9fe] dark:bg-[#1a1c22]",
          "border-r border-slate-200/60 dark:border-white/8 shadow-2xl",
          "transition-transform duration-300 ease-in-out no-print",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-14 px-6 border-b border-slate-200/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Icon name="bolt" size="xs" filled className="text-white" />
            </div>
            <span className="font-bold text-[#1a1c1f] dark:text-white">Fiskix</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 touch-manipulation cursor-pointer"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
        <div className="h-[calc(100%-3.5rem)]">{sidebarContent}</div>
      </div>

      {/* ── Desktop sidebar ── */}
      <aside
        className={cn(
          "hidden lg:flex flex-col fixed top-0 left-0 bottom-0 z-40 no-print",
          "bg-[#f9f9fe] dark:bg-[#1a1c22]",
          "border-r border-slate-200/60 dark:border-white/8",
          "transition-[width] duration-300 ease-in-out",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Spacer */}
      <div className={cn(
        "hidden lg:block flex-shrink-0 transition-[width] duration-300 ease-in-out no-print",
        collapsed ? "w-16" : "w-64"
      )} />
    </>
  );
}

/* ── NavGroup ──────────────────────────────────────── */
function NavGroup({
  label,
  items,
  collapsed,
  isActive,
}: {
  label: string;
  items: NavItem[];
  collapsed: boolean;
  isActive: (href: string) => boolean;
}) {
  return (
    <div>
      <div className={cn(
        "overflow-hidden transition-[max-height,opacity] duration-300",
        collapsed ? "max-h-0 opacity-0" : "max-h-10 opacity-100"
      )}>
        <p className="px-4 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
          {label}
        </p>
      </div>
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            badge={item.badge}
            active={isActive(item.href)}
            collapsed={collapsed}
          />
        ))}
      </div>
    </div>
  );
}

/* ── NavLink ───────────────────────────────────────── */
function NavLink({
  href,
  icon,
  label,
  sub,
  badge,
  active,
  collapsed,
}: {
  href: string;
  icon: string;
  label: string;
  sub?: string;
  badge?: number;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <div className="relative group">
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-lg mx-2 transition-all duration-150 text-sm font-medium cursor-pointer",
          collapsed && "justify-center px-3 mx-1",
          active
            ? "bg-white dark:bg-slate-900 text-[#007AFF] shadow-sm"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
        )}
      >
        <Icon
          name={icon}
          size="sm"
          filled={active}
          className={cn(
            "flex-shrink-0",
            active ? "text-[#007AFF]" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200"
          )}
        />
        {sub ? (
          <div className={cn(
            "overflow-hidden transition-[width,opacity] duration-300 min-w-0 flex-1",
            collapsed ? "w-0 opacity-0" : "opacity-100"
          )}>
            <p className="text-sm font-semibold text-[#1a1c1f] dark:text-white truncate leading-tight">{label}</p>
            <p className="text-[11px] text-slate-500 leading-tight truncate">{sub}</p>
          </div>
        ) : (
          <span className={cn(
            "overflow-hidden transition-[width,opacity] duration-300 whitespace-nowrap flex-1",
            collapsed ? "w-0 opacity-0" : "opacity-100"
          )}>
            {label}
          </span>
        )}
        {badge !== undefined && !collapsed && (
          <span className="ml-auto bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none">
            {badge}
          </span>
        )}
      </Link>

      {/* Tooltip when collapsed */}
      {collapsed && (
        <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 bg-[#1a1c1f] text-white text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg opacity-0 -translate-x-1 scale-95 group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100 transition-[opacity,transform] duration-150">
          {label}
          <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1a1c1f]" />
        </div>
      )}
    </div>
  );
}
