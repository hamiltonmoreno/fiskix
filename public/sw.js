/**
 * Fiskix Service Worker — Offline Support
 * Cache-first para assets estáticos
 * Network-first para dados da API
 */

const CACHE_NAME = "fiskix-v2";
const STATIC_ASSETS = [
  "/mobile",
  "/login",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Só fazer cache de pedidos GET — nunca cachear POST/PUT/PATCH/DELETE
  if (event.request.method !== "GET") return;

  // Network-first para API Supabase (dados em tempo real)
  if (url.hostname.includes("supabase.co")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: "Offline — dados da API não disponíveis" }),
          { headers: { "Content-Type": "application/json" } }
        );
      })
    );
    return;
  }

  // Cache-first para assets estáticos (_next/static e ícones)
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return (
          cached ||
          fetch(event.request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            return response;
          })
        );
      })
    );
    return;
  }

  // Network-first com fallback cache para páginas /mobile
  if (url.pathname.startsWith("/mobile") || url.pathname === "/login") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            return cached || new Response("Offline", { status: 503 });
          });
        })
    );
  }
});
