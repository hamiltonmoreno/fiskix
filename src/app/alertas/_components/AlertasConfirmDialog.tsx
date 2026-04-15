"use client";

import type { InspecaoResultado } from "@/types/database";

interface PendingUpdate {
  alertaId: string;
  novoStatus: InspecaoResultado;
  label: string;
}

interface AlertasConfirmDialogProps {
  pending: PendingUpdate;
  onConfirm: (alertaId: string, novoStatus: InspecaoResultado) => Promise<void>;
  onCancel: () => void;
}

export function AlertasConfirmDialog({ pending, onConfirm, onCancel }: AlertasConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-[1.5rem] bg-surface-container-lowest shadow-xl p-6">
        <h2 className="text-base font-bold text-on-surface">Confirmar atualização</h2>
        <p className="text-sm text-on-surface-variant mt-2">
          Marcar este alerta como{" "}
          <strong className="text-on-surface">{pending.label}</strong>?
        </p>
        <div className="mt-6 flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-full bg-surface-container-low text-on-surface-variant text-sm font-bold hover:bg-surface-container transition-colors cursor-pointer touch-manipulation"
          >
            Cancelar
          </button>
          <button
            onClick={async () => {
              await onConfirm(pending.alertaId, pending.novoStatus);
            }}
            className="px-4 py-2 rounded-full bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors cursor-pointer touch-manipulation"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
