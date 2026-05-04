import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="text-xs font-bold text-primary uppercase tracking-[0.15em] mb-4">
          Erro 404
        </p>
        <h1 className="text-[4rem] font-bold tracking-tighter text-on-surface leading-none mb-4">
          Página não encontrada
        </h1>
        <p className="text-sm text-on-surface-variant mb-8">
          A página que procura não existe ou foi movida.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
        >
          Voltar ao Dashboard
        </Link>
      </div>
    </div>
  );
}
