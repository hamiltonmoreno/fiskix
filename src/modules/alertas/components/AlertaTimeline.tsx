"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  MessageSquare,
  ClipboardList,
  Camera,
  CheckCircle2,
  Wrench,
  XCircle,
} from "lucide-react";

interface AlertaTimelineProps {
  alertaId: string;
  // Dados do alerta já carregados na sheet
  criado_em?: string;
  status: string;
  resultado: string | null;
}

interface TimelineEvent {
  key: string;
  iconKey: "detected" | "sms" | "ordem" | "inspection" | "fraud" | "tech" | "false";
  label: string;
  ts: string | null;
  detail?: string | null;
}

const ICON_MAP = {
  detected: AlertTriangle,
  sms: MessageSquare,
  ordem: ClipboardList,
  inspection: Camera,
  fraud: CheckCircle2,
  tech: Wrench,
  false: XCircle,
} as const;

const ICON_TONE: Record<TimelineEvent["iconKey"], string> = {
  detected: "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
  sms: "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  ordem: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  inspection: "bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400",
  fraud: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400",
  tech: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  false: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
} as const;

const RESULTADO_ICON: Record<string, TimelineEvent["iconKey"]> = {
  Fraude_Confirmada: "fraud",
  Anomalia_Tecnica: "tech",
  Falso_Positivo: "false",
};

const RESULTADO_LABEL: Record<string, string> = {
  Fraude_Confirmada: "Fraude confirmada",
  Anomalia_Tecnica: "Anomalia técnica",
  Falso_Positivo: "Falso positivo",
};

interface RelatorioRow {
  criado_em: string;
  resultado: string;
  observacoes: string | null;
  perfis: { nome: string } | null;
}

export function AlertaTimeline({ alertaId, criado_em, status, resultado }: AlertaTimelineProps) {
  const [relatorio, setRelatorio] = useState<RelatorioRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("relatorios_inspecao")
          .select("criado_em, resultado, observacoes, perfis:id_fiscal(nome)")
          .eq("id_alerta", alertaId)
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled) {
          setRelatorio((data as unknown as RelatorioRow) ?? null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [alertaId]);

  // Reconstroi a cronologia a partir do que sabemos
  const events: TimelineEvent[] = [];
  events.push({
    key: "detected",
    iconKey: "detected",
    label: "Alerta detectado",
    ts: criado_em ?? null,
    detail: "Motor de scoring atribuiu pontuação de risco",
  });
  // SMS / Ordem inferidos a partir do estado actual (sem log dedicado)
  if (status === "Notificado_SMS") {
    events.push({ key: "sms", iconKey: "sms", label: "SMS enviado", ts: null, detail: "Notificação ao cliente" });
  } else if (
    status === "Pendente_Inspecao" ||
    status === "Inspecionado"
  ) {
    events.push({
      key: "ordem",
      iconKey: "ordem",
      label: "Ordem de inspeção criada",
      ts: null,
      detail: "Aguardava acção do fiscal",
    });
  }
  if (relatorio) {
    events.push({
      key: "inspection",
      iconKey: "inspection",
      label: "Inspecionado no terreno",
      ts: relatorio.criado_em,
      detail: relatorio.perfis?.nome ? `Por ${relatorio.perfis.nome}` : null,
    });
    if (relatorio.observacoes) {
      events.push({
        key: "obs",
        iconKey: "inspection",
        label: "Observações",
        ts: null,
        detail: relatorio.observacoes,
      });
    }
  }
  if (resultado && RESULTADO_LABEL[resultado]) {
    events.push({
      key: `result-${resultado}`,
      iconKey: RESULTADO_ICON[resultado] ?? "false",
      label: RESULTADO_LABEL[resultado],
      ts: relatorio?.criado_em ?? null,
      detail: "Caso encerrado",
    });
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <ol className="relative space-y-4 ml-1">
      {events.map((ev, i) => {
        const Icon = ICON_MAP[ev.iconKey];
        const isLast = i === events.length - 1;
        return (
          <li key={ev.key} className="flex gap-3 relative">
            {!isLast && (
              <span
                aria-hidden
                className="absolute left-4 top-8 -bottom-4 w-px bg-border"
              />
            )}
            <span
              className={`relative z-[1] flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${ICON_TONE[ev.iconKey]}`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-sm font-semibold text-foreground">{ev.label}</p>
              {ev.ts && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatDateTime(ev.ts)}
                </p>
              )}
              {ev.detail && (
                <p className="text-xs text-muted-foreground mt-0.5">{ev.detail}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
