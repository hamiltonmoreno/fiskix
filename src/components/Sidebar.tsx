"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Zap,
  LayoutDashboard,
  Upload,
  Users,
  Settings,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Bell,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
  icon: React.ElementType;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Alertas", href: "/alertas", icon: Bell },
];

const ADMIN_ITEMS: NavItem[] = [
  { label: "Importar Dados", href: "/admin/importar", icon: Upload },
  { label: "Motor de Scoring", href: "/admin/scoring", icon: BarChart3 },
  { label: "Utilizadores", href: "/admin/utilizadores", icon: Users, superAdminOnly: true },
  { label: "Configuração", href: "/admin/configuracao", icon: Settings, superAdminOnly: true },
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
  const supabase = createClient();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = ["admin_fiskix", "gestor_perdas"].includes(profile.role);
  const isSuperAdmin = profile.role === "admin_fiskix";

  // Persist collapse state
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) setCollapsed(saved === "true");
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  }

  // Close mobile sidebar on navigation
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
        className={`flex items-center h-16 px-4 border-b border-slate-100 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div
            className={`overflow-hidden transition-all duration-300 ${
              collapsed ? "w-0 opacity-0" : "w-36 opacity-100"
            }`}
          >
            <p className="font-bold text-slate-900 leading-tight whitespace-nowrap">Fiskix</p>
            <p className="text-[10px] text-slate-400 leading-tight whitespace-nowrap">
              Electra Cabo Verde
            </p>
          </div>
        </Link>
        {!collapsed && (
          <button
            onClick={toggleCollapsed}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors hidden lg:flex"
            title="Recolher menu"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {/* Main nav */}
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} active={isActive(item.href)} />
        ))}

        {/* Admin section */}
        {isAdmin && (
          <>
            <div
              className={`overflow-hidden transition-all duration-300 ${
                collapsed ? "max-h-0 opacity-0" : "max-h-10 opacity-100"
              }`}
            >
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 pt-5 pb-1">
                Administração
              </p>
            </div>
            {collapsed && <div className="my-3 border-t border-slate-100" />}
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
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title="Expandir menu"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* User footer */}
      <div className={`border-t border-slate-100 p-3 ${collapsed ? "flex flex-col items-center gap-2" : ""}`}>
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <Link
              href="/perfil"
              className="flex items-center gap-3 flex-1 min-w-0 rounded-lg p-1 hover:bg-slate-50 transition-colors"
              title="Meu perfil"
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-blue-700">
                  {getInitials(profile.nome_completo)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate leading-tight">
                  {profile.nome_completo}
                </p>
                <p className="text-xs text-slate-400 leading-tight">
                  {ROLE_LABELS[profile.role] ?? profile.role}
                </p>
              </div>
            </Link>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
              title="Terminar sessão"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="relative group">
              <Link
                href="/perfil"
                className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center hover:ring-2 hover:ring-blue-300 transition-all"
                title="Meu perfil"
              >
                <span className="text-xs font-semibold text-blue-700">
                  {getInitials(profile.nome_completo)}
                </span>
              </Link>
              {/* Tooltip */}
              <div
                className="
                  pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50
                  bg-slate-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-md
                  whitespace-nowrap shadow-lg
                  opacity-0 -translate-x-1 scale-95
                  group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100
                  transition-all duration-150 ease-out
                "
              >
                Meu perfil
                <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
              title="Terminar sessão"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-700 rounded-lg flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-slate-900">Fiskix</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <div
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-50 w-64 bg-white shadow-xl transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-700 rounded-lg flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-slate-900">Fiskix</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="h-[calc(100%-3.5rem)]">{sidebarContent}</div>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed top-0 left-0 bottom-0 z-40 bg-white border-r border-slate-200 transition-all duration-300 ease-in-out ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Spacer to push content right on desktop */}
      <div
        className={`hidden lg:block flex-shrink-0 transition-all duration-300 ease-in-out ${
          collapsed ? "w-16" : "w-60"
        }`}
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
  const Icon = item.icon;
  return (
    <div className="relative group">
      <Link
        href={item.href}
        className={`relative flex items-center gap-3 py-2.5 rounded-lg transition-all duration-150 text-sm font-medium overflow-hidden ${
          collapsed ? "justify-center px-3" : "px-3"
        } ${
          active
            ? "bg-blue-50 text-blue-700"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        {/* Active left bar indicator */}
        <span
          className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-full transition-all duration-200 ${
            active ? "h-5 bg-blue-600 opacity-100" : "h-0 opacity-0"
          }`}
        />
        <Icon
          className={`w-4 h-4 flex-shrink-0 transition-colors ${
            active ? "text-blue-700" : "text-slate-500 group-hover:text-slate-700"
          }`}
        />
        {/* Label with smooth fade */}
        <span
          className={`overflow-hidden transition-all duration-300 whitespace-nowrap ${
            collapsed ? "w-0 opacity-0" : "w-full opacity-100"
          }`}
        >
          {item.label}
        </span>
      </Link>

      {/* Tooltip when collapsed */}
      {collapsed && (
        <div
          className="
            pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50
            bg-slate-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-md
            whitespace-nowrap shadow-lg
            opacity-0 -translate-x-1 scale-95
            group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100
            transition-all duration-150 ease-out
          "
        >
          {item.label}
          {/* Arrow */}
          <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
        </div>
      )}
    </div>
  );
}
