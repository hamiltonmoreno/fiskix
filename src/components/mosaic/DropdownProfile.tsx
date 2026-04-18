"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

interface DropdownProfileProps {
  profile: {
    role: string;
    nome_completo: string;
  };
  onSignOut: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin_fiskix:  "Administrador",
  gestor_perdas: "Gestor de Perdas",
  supervisor:    "Supervisor",
  fiscal:        "Fiscal",
  diretor:       "Diretor",
};

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

export function DropdownProfile({ profile, onSignOut }: DropdownProfileProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        className="inline-flex justify-center items-center group cursor-pointer"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => { 
          e.stopPropagation(); 
          if (!open) haptics.light();
          setOpen(!open); 
        }}
      >
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {getInitials(profile.nome_completo)}
        </div>
        <div className="flex items-center truncate">
          <span className="truncate ml-2 text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-gray-100 hidden md:block">
            {profile.nome_completo.split(" ").slice(0, 2).join(" ")}
          </span>
          <svg className="w-3 h-3 shrink-0 ml-1 fill-current text-gray-400" viewBox="0 0 12 12">
            <path d="M5.9 11.4L.5 6l1.4-1.4 4 4 4-4L11.3 6z" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="origin-top-right z-10 absolute top-full right-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 rounded-lg shadow-xl py-1.5 mosaic-dropdown-enter">
          <div className="px-4 pt-1.5 pb-3 border-b border-gray-200 dark:border-gray-700/60">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {profile.nome_completo}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {ROLE_LABELS[profile.role] ?? profile.role}
            </p>
          </div>
          <ul>
            <li>
              <Link
                href="/perfil"
                className="flex items-center px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors"
                onClick={() => setOpen(false)}
              >
                Definições
              </Link>
            </li>
            <li>
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors cursor-pointer"
                onClick={() => {
                  haptics.heavy();
                  setOpen(false);
                  onSignOut();
                }}
              >
                Terminar Sessão
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
