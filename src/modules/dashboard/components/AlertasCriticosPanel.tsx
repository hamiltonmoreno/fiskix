"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreBadge } from "@/components/ui/score-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { AlertTriangle, ChevronRight } from "lucide-react";
import type { KPIData } from "../types";

interface AlertasCriticosPanelProps {
  alertas: KPIData["alertas_criticos"] | undefined;
  loading: boolean;
  mesAno: string;
}

export function AlertasCriticosPanel({ alertas, loading, mesAno }: AlertasCriticosPanelProps) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          Alertas Críticos
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))
        ) : !alertas || alertas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Sem alertas críticos este mês
          </p>
        ) : (
          alertas.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 py-2 border-b border-border last:border-0"
            >
              <ScoreBadge score={a.score_risco} showScore className="shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {a.cliente.nome_titular}
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.subestacao.zona_bairro.replace(/_/g, " ")}
                </p>
              </div>
              <StatusBadge status={a.status} className="shrink-0" />
            </div>
          ))
        )}
        <Link
          href={`/alertas?mes=${mesAno}&min_score=75`}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 pt-1 font-medium"
        >
          Ver todos <ChevronRight className="w-3 h-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
