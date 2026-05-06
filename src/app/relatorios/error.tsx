"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function RelatoriosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Relatorios Error]", error);
  }, [error]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-16 w-full max-w-9xl mx-auto">
      <div className="max-w-md mx-auto text-center">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-red-500 text-2xl">error</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Erro ao carregar o relatório
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Não foi possível carregar os dados. Verifique a ligação e tente novamente.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Tentar novamente
          </button>
          <Link
            href="/relatorios"
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Voltar aos Relatórios
          </Link>
        </div>
      </div>
    </div>
  );
}
