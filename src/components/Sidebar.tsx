"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
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

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const toggleCollapsed = useCallback(() => {
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
      {/* Mobile top bar */}
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
        <div className="lg:hidden fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
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
        <div className="h-[calc(100%-3.5rem)]">
          <SidebarNav {...navProps} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden lg:flex flex-col fixed top-0 left-0 bottom-0 z-40 no-print",
        "bg-[#f9f9fe] dark:bg-[#1a1c22]",
        "border-r border-slate-200/60 dark:border-white/8",
        "transition-[width] duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}>
        <SidebarNav {...navProps} />
      </aside>

      {/* Spacer */}
      <div className={cn(
        "hidden lg:block flex-shrink-0 transition-[width] duration-300 ease-in-out no-print",
        collapsed ? "w-16" : "w-64"
      )} />
    </>
  );
}
