"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body className="antialiased">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-semibold mb-2">Algo correu mal</h2>
            <button
              onClick={reset}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
