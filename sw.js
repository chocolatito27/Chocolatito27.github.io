/**
 * sw.js — Service Worker de ChocolatitoWeb
 * Protege páginas privadas sin tocar su HTML.
 * Intercepta cada navegación y redirige al login si no hay sesión.
 */

const PROTECTED = [
  "chocolatitoAI.html",
  "juegos.html",
  "entretenimiento.html",
];

const AUTH_CACHE = "cw-auth-v1";
const AUTH_FLAG  = "/__cw_auth__";

/* ── Instalación y activación inmediata ─────────────────────────── */
self.addEventListener("install",  () => self.skipWaiting());
self.addEventListener("activate", e  => e.waitUntil(self.clients.claim()));

/* ── Intercepta navegaciones ────────────────────────────────────── */
self.addEventListener("fetch", event => {
  if (event.request.mode !== "navigate") return;

  const url  = new URL(event.request.url);
  const page = url.pathname.split("/").pop() || "index.html";

  if (!PROTECTED.includes(page)) return;

  event.respondWith(
    caches.open(AUTH_CACHE).then(async cache => {
      const flag = await cache.match(AUTH_FLAG);
      if (!flag) {
        /* Sin sesión → redirigir al login */
        return Response.redirect(url.origin + "/login.html?next=" + encodeURIComponent(url.pathname), 302);
      }
      /* Con sesión → cargar la página normalmente */
      return fetch(event.request);
    })
  );
});

/* ── Mensajes desde las páginas ─────────────────────────────────── */
self.addEventListener("message", async event => {
  if (event.data === "CW_LOGIN") {
    const cache = await caches.open(AUTH_CACHE);
    await cache.put(AUTH_FLAG, new Response("1"));
  }
  if (event.data === "CW_LOGOUT") {
    await caches.delete(AUTH_CACHE);
  }
});
