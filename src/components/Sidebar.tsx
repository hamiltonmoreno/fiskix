"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Icon } from "@/components/Icon";
import { SidebarNav } from "@/components/sidebar/SidebarNav";

interface SidebarProps {
  profile: {
    role: string;
    nome_completo: string;
    id_zona: string | null;
  };
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [collapsed,  setCollapsed]  = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) setCollapsed(saved === "true");
  }, []);

  useEffect(() => {
    if (mobileOpen) setMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = useCallback(() => {
    haptics.light();
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  }, [collapsed]);

  const handleSignOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      router.push("/login");
    }
  }, [supabase, router]);

  const isActive = useCallback(
    (href: string) => pathname === href || pathname.startsWith(href + "/"),
    [pathname]
  );

  const navProps = { profile, collapsed, isActive, onToggleCollapsed: toggleCollapsed, onSignOut: handleSignOut };

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-700/60 flex items-center px-4 gap-3 no-print">
        <button
          onClick={() => {
            haptics.drawerOpen();
            setMobileOpen(true);
          }}
          aria-label="Abrir menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-sidebar-drawer"
          className="p-2 rounded-lg text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 touch-manipulation cursor-pointer"
        >
          <Icon name="menu" size="md" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shadow-sm">
            <Icon name="bolt" size="xs" filled className="text-white" />
          </div>
          <span className="font-bold text-gray-800 dark:text-gray-100">Fiskix</span>
        </div>
      </div>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-gray-900/30 backdrop-blur-sm transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <div
        id="mobile-sidebar-drawer"
        className={cn(
          "lg:hidden fixed top-0 left-0 bottom-0 z-50 w-64",
          "bg-white dark:bg-gray-800",
          "shadow-2xl",
          "transition-transform duration-300 ease-in-out no-print",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b border-gray-200 dark:border-gray-700/60">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Icon name="bolt" size="xs" filled className="text-white" />
            </div>
            <span className="font-bold text-gray-800 dark:text-gray-100">Fiskix</span>
          </div>
          <button
            onClick={() => {
              haptics.light();
              setMobileOpen(false);
            }}
            aria-label="Fechar menu"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700/50 touch-manipulation cursor-pointer"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
        <div className="h-[calc(100%-4rem)]">
          <SidebarNav {...navProps} />
        </div>
      </div>

      {/* ── Desktop sidebar ── */}
      <aside className={cn(
        "hidden lg:flex flex-col fixed top-0 left-0 bottom-0 z-40 no-print",
        "bg-white dark:bg-gray-800",
        "border-r border-gray-200 dark:border-gray-700/60",
        "transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[4.5rem]" : "w-64"
      )}>
        <SidebarNav {...navProps} />
      </aside>

      {/* ── Spacer (prevents content from going under fixed sidebar) ── */}
      <div className={cn(
        "hidden lg:block flex-shrink-0 transition-[width] duration-300 ease-in-out no-print",
        collapsed ? "w-[4.5rem]" : "w-64"
      )} />
    </>
  );
}
