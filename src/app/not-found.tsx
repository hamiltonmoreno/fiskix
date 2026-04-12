import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-slate-200 mb-4">404</h1>
        <p className="text-slate-600 mb-6">Página não encontrada.</p>
        <Link href="/dashboard" className="text-indigo-600 hover:underline text-sm font-medium">
          Voltar ao Dashboard →
        </Link>
      </div>
    </div>
  );
}
