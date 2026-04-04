import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fiskix Fiscal",
  description: "App de fiscalização para agentes de campo",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fiskix Fiscal",
  },
};

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Registar Service Worker */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js', { scope: '/mobile' })
                  .catch(function(err) {
                    console.warn('[Fiskix SW] Registo falhou:', err);
                  });
              });
            }
          `,
        }}
      />
      {children}
    </>
  );
}
