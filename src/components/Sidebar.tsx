"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { Icon } from "@/components/Icon";
import { SidebarNav } from "@/components/sidebar/SidebarNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DropdownNotifications } from "@/components/mosaic/DropdownNotifications";
import { DropdownProfile } from "@/components/mosaic/DropdownProfile";
import { ModalSearch } from "@/components/mosaic/ModalSearch";

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

  const [collapsed,      setCollapsed]      = useState(false);
  const [mobileOpen,     setMobileOpen]     = useState(false);
  const [searchOpen,     setSearchOpen]     = useState(false);
  const [criticalCount,  setCriticalCount]  = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) setCollapsed(saved === "true");
  }, []);

  useEffect(() => {
    if (mobileOpen) setMobileOpen(false);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime badge: count of Pendente critical alerts (score >= 75)
  useEffect(() => {
    let cancelled = false;
    async function fetchCount() {
      const { count } = await supabase
        .from("alertas_fraude")
        .select("id", { count: "exact", head: true })
        .eq("status", "Pendente")
        .gte("score_risco", 75);
      if (!cancelled) setCriticalCount(count ?? 0);
    }
    fetchCount();

    const channel = supabase
      .channel("sidebar-critical-alertas")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alertas_fraude" },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase]);

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

  const navProps = {
    profile,
    collapsed,
    isActive,
    onToggleCollapsed: toggleCollapsed,
    onSignOut: handleSignOut,
    criticalCount,
  };

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-700/60 flex items-center px-3 gap-2 no-print">
        {/* Hamburger */}
        <button
          onClick={() => {
            haptics.drawerOpen();
            setMobileOpen(true);
          }}
          aria-label="Abrir menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-sidebar-drawer"
          className="p-2 rounded-lg text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 touch-manipulation cursor-pointer shrink-0"
        >
          <Icon name="menu" size="sm" />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shadow-sm">
            <Icon name="bolt" size="xs" filled className="text-white" />
          </div>
          <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">Fiskix</span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action icons */}
        <button
          onClick={() => { haptics.light(); setSearchOpen(true); }}
          className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
          aria-label="Pesquisar"
        >
          <Icon name="search" size="sm" />
        </button>

        <DropdownNotifications />
        <ThemeToggle variant="header" />

        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700/60 shrink-0 mx-0.5" />

        <DropdownProfile profile={profile} onSignOut={handleSignOut} />
      </div>

      {/* Search modal (mobile) */}
      <ModalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

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
          "lg:hidden fixed top-0 left-0 bottom-0 z-50 w-64 max-w-[85vw]",
          "bg-white dark:bg-gray-800",
          "shadow-2xl",
          "transition-transform duration-300 ease-in-out no-print",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200 dark:border-gray-700/60">
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Navegação</span>
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
        <div className="h-[calc(100%-3.5rem)]">
          <SidebarNav {...navProps} hideHeader />
        </div>
      </div>

      {/* ── Desktop sidebar ── */}
      <aside className={cn(
        "hidden lg:flex flex-col fixed top-0 left-0 bottom-0 z-40 no-print",
        "bg-white dark:bg-gray-800",
        "border-r border-gray-200 dark:border-gray-700/60",
        "transition-[width] duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}>
        <SidebarNav {...navProps} />
      </aside>

      {/* ── Spacer (prevents content from going under fixed sidebar) ── */}
      <div className={cn(
        "hidden lg:block flex-shrink-0 transition-[width] duration-300 ease-in-out no-print",
        collapsed ? "w-16" : "w-64"
      )} />
    </>
  );
}
