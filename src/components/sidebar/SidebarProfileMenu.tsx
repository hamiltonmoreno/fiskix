"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/Icon";
import { haptics } from "@/lib/haptics";

const ROLE_LABELS: Record<string, string> = {
  admin_fiskix:  "Administrador",
  gestor_perdas: "Gestor de Perdas",
  supervisor:    "Supervisor",
  fiscal:        "Fiscal",
  diretor:       "Diretor",
};

interface SidebarProfileMenuProps {
  profile: { nome_completo: string; role: string };
  collapsed: boolean;
  onSignOut: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function SidebarProfileMenu({ profile, collapsed, onSignOut }: SidebarProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const initials  = getInitials(profile.nome_completo);
  const roleLabel = ROLE_LABELS[profile.role] ?? profile.role;
  const isDark    = resolvedTheme === "dark";

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => { haptics.light(); setOpen((v) => !v); }}
        aria-expanded={open}
        aria-label="Menu do utilizador"
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer touch-manipulation",
          "hover:bg-primary/5 dark:hover:bg-primary/10",
          collapsed && "justify-center px-2"
        )}
      >
        {/* Avatar with initials */}
        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
          {initials}
        </div>

        {/* Name + role */}
        <div className={cn(
          "overflow-hidden transition-[width,opacity] duration-300 min-w-0 flex-1 text-left",
          collapsed ? "w-0 opacity-0" : "opacity-100"
        )}>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate leading-tight">
            {profile.nome_completo}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate leading-tight">
            {roleLabel}
          </p>
        </div>

        {!collapsed && (
          <Icon
            name={open ? "expand_less" : "expand_more"}
            size="xs"
            className="flex-shrink-0 text-gray-400"
          />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className={cn(
          "absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-xl shadow-lg py-1 min-w-[184px]",
          collapsed
            ? "left-full bottom-0 ml-3"
            : "bottom-full left-0 right-0 mb-2"
        )}>
          <Link
            href="/perfil"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 mx-1 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors"
          >
            <Icon name="account_circle" size="sm" className="text-gray-400" />
            O Meu Perfil
          </Link>

          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="w-full flex items-center gap-2.5 px-3 py-2 mx-1 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition-colors cursor-pointer"
            style={{ width: "calc(100% - 0.5rem)" }}
          >
            <Icon name={isDark ? "light_mode" : "dark_mode"} size="sm" className="text-gray-400" />
            {isDark ? "Modo Claro" : "Modo Escuro"}
          </button>

          <div className="mx-3 my-1 border-t border-gray-200 dark:border-gray-700/60" />

          <button
            onClick={() => { haptics.heavy(); setOpen(false); onSignOut(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 mx-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
            style={{ width: "calc(100% - 0.5rem)" }}
          >
            <Icon name="logout" size="sm" />
            Terminar sessão
          </button>
        </div>
      )}
    </div>
  );
}
