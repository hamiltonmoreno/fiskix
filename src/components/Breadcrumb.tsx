"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  alertas: "Alertas",
  balanco: "Balanço",
  clientes: "Clientes",
  inspecoes: "Inspeções",
  recuperacao: "Recuperação",
  notificacoes: "Notificações",
  admin: "Administração",
  importar: "Importar Dados",
  scoring: "Motor de Scoring",
  utilizadores: "Utilizadores",
  configuracao: "Configuração",
  "api-keys": "API Keys",
  perfil: "O Meu Perfil",
  relatorios: "Relatórios",
  mobile: "Mobile",
  report: "Relatório",
};

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length < 1) return null;

  const crumbs = segments.map((seg, i) => ({
    label: SEGMENT_LABELS[seg] ?? seg,
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      <Link
        href="/dashboard"
        className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-lg"
        aria-label="Início"
      >
        <Icon name="home" size="xs" />
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1">
          <Icon name="chevron_right" size="xs" className="text-border" />
          {crumb.isLast ? (
            <span className="text-foreground font-semibold" aria-current="page">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
