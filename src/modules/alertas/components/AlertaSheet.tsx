"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/ui/score-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { MessageSquare, ClipboardList, MapPin } from "lucide-react";

export interface AlertaSheetData {
  id: string;
  score_risco: number;
  status: string;
  mes_ano: string;
  resultado: string | null;
  motivo: Array<{ regra: string; pontos: number; descricao: string }>;
  cliente: {
    numero_contador: string;
    nome_titular: string;
    morada: string;
    tipo_tarifa: string;
    telemovel: string | null;
  };
  subestacao: { nome: string; zona_bairro: string };
}

interface AlertaSheetProps {
  alerta: AlertaSheetData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnviarSMS?: (alertaId: string) => Promise<void>;
  onGerarOrdem?: (alertaId: string) => Promise<void>;
  actionLoading?: string | null;
}

export function AlertaSheet({
  alerta,
  open,
  onOpenChange,
  onEnviarSMS,
  onGerarOrdem,
  actionLoading,
}: AlertaSheetProps) {
  if (!alerta) return null;

  const motivosPontuados = alerta.motivo.filter((m) => m.pontos > 0);
  const podeEnviarSMS = alerta.cliente.telemovel && alerta.status === "Pendente";
  const podeGerarOrdem = !["Inspecionado", "Fraude_Confirmada", "Anomalia_Tecnica", "Falso_Positivo"].includes(alerta.status);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[420px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-base">{alerta.cliente.nome_titular}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Contador #{alerta.cliente.numero_contador} · {alerta.subestacao.zona_bairro.replace(/_/g, " ")}
          </p>
        </SheetHeader>

        {/* Score + Status */}
        <div className="flex items-center gap-2 mb-5">
          <ScoreBadge score={alerta.score_risco} showScore />
          <StatusBadge status={alerta.status} />
        </div>

        {/* Informação do cliente */}
        <div className="space-y-1 mb-5">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Cliente
          </h4>
          <p className="text-sm text-foreground flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
            {alerta.cliente.morada}
          </p>
          <p className="text-sm text-muted-foreground">
            Tarifa: {alerta.cliente.tipo_tarifa}
          </p>
          {alerta.cliente.telemovel && (
            <p className="text-sm text-muted-foreground">
              Tel: {alerta.cliente.telemovel}
            </p>
          )}
        </div>

        {/* Motivos de scoring */}
        <div className="mb-5">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Motivos de Scoring
          </h4>
          {motivosPontuados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem motivos registados</p>
          ) : (
            <ul className="space-y-2">
              {motivosPontuados.map((m) => (
                <li key={m.regra} className="flex items-start gap-2 text-sm">
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                    {m.regra}
                  </span>
                  <span className="text-foreground">{m.descricao}</span>
                  <span className="ml-auto text-muted-foreground shrink-0">+{m.pontos}pts</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Resultado se inspecionado */}
        {alerta.resultado && (
          <div className="mb-5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Resultado da Inspeção
            </h4>
            <StatusBadge status={alerta.resultado} />
          </div>
        )}

        {/* Acções */}
        {(podeEnviarSMS || podeGerarOrdem) && (
          <div className="space-y-2 pt-4 border-t border-border">
            {podeGerarOrdem && onGerarOrdem && (
              <Button
                className="w-full"
                onClick={() => onGerarOrdem(alerta.id)}
                disabled={actionLoading === alerta.id}
              >
                <ClipboardList className="w-4 h-4 mr-2" />
                {actionLoading === alerta.id ? "A criar..." : "Criar Ordem de Inspeção"}
              </Button>
            )}
            {podeEnviarSMS && onEnviarSMS && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onEnviarSMS(alerta.id)}
                disabled={actionLoading === alerta.id}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Enviar SMS
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
