import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  Pendente: { label: "Pendente", className: "bg-slate-100 text-slate-700" },
  Notificado_SMS: { label: "SMS Enviado", className: "bg-blue-100 text-blue-700" },
  Pendente_Inspecao: { label: "Em Inspeção", className: "bg-amber-100 text-amber-700" },
  Inspecionado: { label: "Inspecionado", className: "bg-green-100 text-green-700" },
  Fraude_Confirmada: { label: "Fraude Confirmada", className: "bg-red-100 text-red-700" },
  Anomalia_Tecnica: { label: "Anomalia Técnica", className: "bg-orange-100 text-orange-700" },
  Falso_Positivo: { label: "Falso Positivo", className: "bg-slate-100 text-slate-400" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: "bg-slate-100 text-slate-600" };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
