"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";


interface ModalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const RECENT_SEARCHES = [
  { icon: "person_search", label: "Medidor #CV-2847", href: "/alertas" },
  { icon: "location_on", label: "Zona Palmarejo", href: "/dashboard" },
  { icon: "warning", label: "Alertas críticos", href: "/alertas?status=critico" },
  { icon: "analytics", label: "Motor de Scoring", href: "/admin/scoring" },
];

export function ModalSearch({ isOpen, onClose }: ModalSearchProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useLayoutEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredSearches = query
    ? RECENT_SEARCHES.filter((s) => s.label.toLowerCase().includes(query.toLowerCase()))
    : RECENT_SEARCHES;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-gray-900/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
        <div
          className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700/60 mosaic-dropdown-enter overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-gray-200 dark:border-gray-700/60">
            <Icon name="search" size="sm" className="text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="search"
              placeholder="Pesquisar medidores, bairros ou O.S..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full py-3.5 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none"
            />
            <button
              onClick={onClose}
              className="flex-shrink-0 text-xs text-gray-400 border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              ESC
            </button>
          </div>

          {/* Results */}
          <div className="max-h-72 overflow-y-auto mosaic-scrollbar py-2">
            {filteredSearches.length > 0 ? (
              <>
                <p className="px-4 py-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  {query ? "Resultados" : "Pesquisas recentes"}
                </p>
                {filteredSearches.map((item) => (
                  <button
                    key={item.href + item.label}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors text-left cursor-pointer"
                    onClick={() => {
                      onClose();
                      router.push(item.href);
                    }}
                  >
                    <Icon name={item.icon} size="sm" className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-200">{item.label}</span>
                  </button>
                ))}
              </>
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Nenhum resultado para &ldquo;{query}&rdquo;
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
