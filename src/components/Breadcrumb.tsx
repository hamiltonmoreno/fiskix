"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  admin: "Administração",
  importar: "Importar Dados",
  scoring: "Motor de Scoring",
  utilizadores: "Utilizadores",
  configuracao: "Configuração",
  mobile: "Mobile",
  report: "Relatório",
};

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // Don't render on root-level pages (e.g. /dashboard)
  if (segments.length <= 1) return null;

  const crumbs = segments.map((seg, i) => ({
    label: SEGMENT_LABELS[seg] ?? seg,
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      <Link
        href="/dashboard"
        className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded"
        aria-label="Início"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1">
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          {crumb.isLast ? (
            <span className="text-slate-700 font-medium">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
