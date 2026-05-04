"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DropdownNotifications } from "@/components/mosaic/DropdownNotifications";
import { DropdownHelp } from "@/components/mosaic/DropdownHelp";
import { DropdownProfile } from "@/components/mosaic/DropdownProfile";
import { ModalSearch } from "@/components/mosaic/ModalSearch";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

interface TopBarProps {
  profile: {
    role: string;
    nome_completo: string;
    id_zona: string | null;
  };
}

export function TopBar({ profile }: TopBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const handleSignOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      router.push("/login");
    }
  }, [supabase, router]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30 no-print",
          "before:absolute before:inset-0 before:backdrop-blur-md",
          "before:bg-white/90 dark:before:bg-gray-800/90",
          "before:-z-10",
          "border-b border-gray-200 dark:border-gray-700/60"
        )}
      >
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* ── Left: Search trigger ── */}
            <div className="flex items-center">
              <button
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer",
                  "hover:bg-gray-100 dark:hover:bg-gray-700/50",
                  searchOpen && "bg-gray-200 dark:bg-gray-700"
                )}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  haptics.light();
                  setSearchOpen(true); 
                }}
                aria-controls="search-modal"
              >
                <span className="sr-only">Pesquisar</span>
                <Icon name="search" size="sm" className="text-gray-500/80 dark:text-gray-400/80" />
              </button>
            </div>

            {/* ── Right: Actions ── */}
            <div className="flex items-center gap-3">
              <DropdownNotifications />
              <DropdownHelp />
              <ThemeToggle variant="header" />

              {/* Divider */}
              <hr className="w-px h-6 bg-gray-200 dark:bg-gray-700/60 border-none" />

              <DropdownProfile profile={profile} onSignOut={handleSignOut} />
            </div>

          </div>
        </div>
      </header>

      {/* Search modal */}
      <ModalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
