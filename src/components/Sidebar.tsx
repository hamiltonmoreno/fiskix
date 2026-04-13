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
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Alertas", href: "/alertas", icon: "notifications_active" },
];

const ADMIN_ITEMS: NavItem[] = [
  { label: "Importar Dados", href: "/admin/importar", icon: "upload_file" },
  { label: "Motor de Scoring", href: "/admin/scoring", icon: "analytics" },
  { label: "Utilizadores", href: "/admin/utilizadores", icon: "group", superAdminOnly: true },
  { label: "Configuração", href: "/admin/configuracao", icon: "settings", superAdminOnly: true },
  { label: "API Keys", href: "/admin/api-keys", icon: "key", superAdminOnly: true },
];

const ROLE_LABELS: Record<string, string> = {
  admin_fiskix: "Administrador",
  gestor_perdas: "Gestor de Perdas",
  supervisor: "Supervisor",
  fiscal: "Fiscal",
  diretor: "Diretor",
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
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = ["admin_fiskix", "gestor_perdas"].includes(profile.role);
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

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function isActive(href: string) {
    if (href.includes("#")) return pathname === href.split("#")[0];
    return pathname === href || pathname.startsWith(href + "/");
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className={cn(
          "flex items-center h-16 px-4",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <Icon name="bolt" className="text-white" size="md" />
          </div>
          <div
            className={cn(
              "overflow-hidden transition-[width,opacity] duration-300",
              collapsed ? "w-0 opacity-0" : "w-36 opacity-100"
            )}
          >
            <p className="font-bold text-foreground leading-tight whitespace-nowrap text-[15px]">
              Fiskix
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">
              Electra Cabo Verde
            </p>
          </div>
        </Link>
        {!collapsed && (
          <button
            onClick={toggleCollapsed}
            aria-label="Recolher menu lateral"
            title="Recolher menu"
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors hidden lg:flex cursor-pointer touch-manipulation"
          >
            <Icon name="chevron_left" size="sm" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {/* Main */}
        <div className={cn("mb-1", collapsed ? "hidden" : "block")}>
          <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest px-3 py-1.5">
            Principal
          </p>
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} active={isActive(item.href)} />
        ))}

        {isRelatorios && (
          <NavLink
            item={{ label: "Relatórios", href: "/relatorios", icon: "insert_chart" }}
            collapsed={collapsed}
            active={isActive("/relatorios")}
          />
        )}

        {/* Admin section */}
        {isAdmin && (
          <>
            <div
              className={cn(
                "overflow-hidden transition-[max-height,opacity] duration-300",
                collapsed ? "max-h-0 opacity-0" : "max-h-10 opacity-100"
              )}
            >
              <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest px-3 pt-4 pb-1.5">
                Administração
              </p>
            </div>
            {collapsed && <div className="my-3 border-t border-border" />}
            {ADMIN_ITEMS.filter((i) => !i.superAdminOnly || isSuperAdmin).map((item) => (
              <NavLink
                key={item.href}
                item={item}
                collapsed={collapsed}
                active={isActive(item.href)}
              />
            ))}
          </>
        )}
      </nav>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div className="px-2 pb-2 hidden lg:block">
          <button
            onClick={toggleCollapsed}
            aria-label="Expandir menu lateral"
            className="w-full flex items-center justify-center p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer touch-manipulation"
          >
            <Icon name="chevron_right" size="sm" />
          </button>
        </div>
      )}

      {/* User footer */}
      <div className={cn(
        "border-t border-border p-3",
        collapsed ? "flex flex-col items-center gap-2" : ""
      )}>
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <Link
              href="/perfil"
              className="flex items-center gap-3 flex-1 min-w-0 rounded-xl p-1.5 hover:bg-muted transition-colors cursor-pointer"
              title="Meu perfil"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 ring-2 ring-primary/20">
                <span className="text-xs font-bold text-primary">
                  {getInitials(profile.nome_completo)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate leading-tight">
                  {profile.nome_completo}
                </p>
                <p className="text-xs text-muted-foreground leading-tight">
                  {ROLE_LABELS[profile.role] ?? profile.role}
                </p>
              </div>
            </Link>
            <button
              onClick={handleSignOut}
              aria-label="Terminar sessão"
              className="p-1.5 rounded-xl hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0 cursor-pointer touch-manipulation"
              title="Terminar sessão"
            >
              <Icon name="logout" size="sm" />
            </button>
          </div>
        ) : (
          <>
            <div className="relative group">
              <Link
                href="/perfil"
                className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center hover:ring-2 hover:ring-primary/40 transition-[box-shadow] cursor-pointer"
                title="Meu perfil"
              >
                <span className="text-xs font-bold text-primary">
                  {getInitials(profile.nome_completo)}
                </span>
              </Link>
              <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 bg-foreground text-background text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-[opacity,transform] duration-150">
                Meu perfil
                <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-foreground" />
              </div>
            </div>
            <button
              onClick={handleSignOut}
              aria-label="Terminar sessão"
              className="p-1.5 rounded-xl hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors cursor-pointer touch-manipulation"
              title="Terminar sessão"
            >
              <Icon name="logout" size="sm" />
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-background/80 backdrop-blur-xl border-b border-border flex items-center px-4 gap-3 no-print">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-sidebar-drawer"
          className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer touch-manipulation"
        >
          <Icon name="menu" size="md" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <Icon name="bolt" className="text-white" size="sm" />
          </div>
          <span className="font-bold text-foreground">Fiskix</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <div
        id="mobile-sidebar-drawer"
        className={cn(
          "lg:hidden fixed top-0 left-0 bottom-0 z-50 w-64 bg-background/95 backdrop-blur-xl border-r border-border shadow-2xl transition-transform duration-300 ease-in-out no-print",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Icon name="bolt" className="text-white" size="sm" />
            </div>
            <span className="font-bold text-foreground">Fiskix</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
            className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground transition-colors cursor-pointer touch-manipulation"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
        <div className="h-[calc(100%-3.5rem)]">{sidebarContent}</div>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col fixed top-0 left-0 bottom-0 z-40",
          "bg-card/80 backdrop-blur-xl border-r border-border",
          "shadow-[4px_0_24px_rgba(0,0,0,0.04)]",
          "transition-[width] duration-300 ease-in-out no-print",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Spacer */}
      <div
        className={cn(
          "hidden lg:block flex-shrink-0 transition-[width] duration-300 ease-in-out no-print",
          collapsed ? "w-16" : "w-60"
        )}
      />
    </>
  );
}

function NavLink({
  item,
  collapsed,
  active,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
}) {
  return (
    <div className="relative group">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex items-center gap-3 py-2.5 rounded-xl transition-[background-color,color,box-shadow] duration-150 text-sm font-medium overflow-hidden cursor-pointer",
          collapsed ? "justify-center px-3" : "px-3",
          active
            ? "bg-primary/10 text-primary shadow-none"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {/* Active indicator bar */}
        <span
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-full bg-primary transition-[height,opacity] duration-200",
            active ? "h-5 opacity-100" : "h-0 opacity-0"
          )}
        />
        <Icon
          name={item.icon}
          size="sm"
          filled={active}
          className={cn(
            "flex-shrink-0 transition-colors",
            active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
          )}
        />
        <span
          className={cn(
            "overflow-hidden transition-[width,opacity] duration-300 whitespace-nowrap",
            collapsed ? "w-0 opacity-0" : "w-full opacity-100"
          )}
        >
          {item.label}
        </span>
      </Link>

      {collapsed && (
        <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 bg-foreground text-background text-xs font-medium px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg opacity-0 -translate-x-1 scale-95 group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100 transition-[opacity,transform] duration-150 ease-out">
          {item.label}
          <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-foreground" />
        </div>
      )}
    </div>
  );
}
