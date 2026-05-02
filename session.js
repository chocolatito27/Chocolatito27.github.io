/**
 * session.js — Incluye este archivo en TODAS las páginas de chocolatito.store
 *
 * Uso básico (solo mostrar widget):
 *   <script src="session.js"></script>
 *
 * Para proteger una página (redirige a login si no hay sesión):
 *   <script>const CW_PROTECTED = true;</script>
 *   <script src="session.js"></script>
 *
 * ¡NUEVO! También registra el Service Worker que protege
 * automáticamente todas las páginas privadas sin tocar su HTML.
 */
(function () {
  "use strict";

  const API_BASE  = "https://385fd47d-e4b4-4453-981e-7afca555f923-00-9lnnok86qrfn.picard.replit.dev/api";
  const LOGIN_PAGE = "login.html";

  /* ══════════════════════════════════════════════════════════════
     SERVICE WORKER — se registra en todas las páginas
     Una vez instalado, protege el sitio entero sin tocar cada HTML
  ══════════════════════════════════════════════════════════════ */
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }

  /* ── Notificar al SW cuando hay sesión activa ─────────────────── */
  function swMessage(msg) {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then(reg => {
      if (reg.active) reg.active.postMessage(msg);
    }).catch(() => {});
  }

  /* ── Leer sesión guardada ─────────────────────────────────────── */
  function getToken() { return localStorage.getItem("cw_token"); }
  function getUser()  {
    try { return JSON.parse(localStorage.getItem("cw_user") || "null"); }
    catch { return null; }
  }
  function clearSession() {
    localStorage.removeItem("cw_token");
    localStorage.removeItem("cw_user");
    swMessage("CW_LOGOUT");
  }

  /* ── Si la página está protegida y no hay sesión → login ──────── */
  const isProtected = (typeof window.CW_PROTECTED !== "undefined" && window.CW_PROTECTED);
  if (isProtected && !getToken()) {
    sessionStorage.setItem("cw_redirect", window.location.href);
    window.location.replace(LOGIN_PAGE);
    return;
  }

  /* ── Si hay sesión, avisar al SW para que la reconozca ─────────── */
  if (getToken()) swMessage("CW_LOGIN");

  /* ══════════════════════════════════════════════════════════════
     WIDGET DE USUARIO
  ══════════════════════════════════════════════════════════════ */
  const STYLE = `
    #cw-widget {
      position: fixed;
      top: 14px; right: 16px;
      z-index: 2000;
      display: flex; align-items: center; gap: 8px;
      background: rgba(0,0,0,0.78);
      border: 1px solid rgba(51,255,255,0.35);
      border-radius: 999px;
      padding: 5px 12px 5px 8px;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 0.8rem; color: #fff;
      backdrop-filter: blur(6px);
      box-shadow: 0 2px 12px rgba(0,0,0,0.4);
      cursor: default; user-select: none;
      animation: cw-fadein 0.3s ease;
    }
    @keyframes cw-fadein {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    #cw-widget .cw-avatar {
      width: 26px; height: 26px; border-radius: 50%;
      background: linear-gradient(135deg, #6c8df5, #33FFFF);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: #000; flex-shrink: 0;
    }
    #cw-widget .cw-info { line-height: 1.3; }
    #cw-widget .cw-name { font-weight: 700; color: #33FFFF; font-size: 0.78rem; }
    #cw-widget .cw-meta { color: rgba(255,255,255,0.65); font-size: 0.7rem; letter-spacing: 0.03em; }
    #cw-widget .cw-meta span { color: #4ade80; font-weight: 700; }
    #cw-widget .cw-logout {
      background: none; border: none;
      color: rgba(255,255,255,0.45); cursor: pointer;
      font-size: 13px; padding: 0 0 0 4px; transition: color 0.2s;
    }
    #cw-widget .cw-logout:hover { color: #ff5470; }

    #cw-login-btn {
      position: fixed; top: 14px; right: 16px; z-index: 2000;
      background: rgba(0,0,0,0.75);
      border: 1px solid rgba(51,255,255,0.35);
      border-radius: 999px; padding: 6px 16px;
      color: #33FFFF;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 0.8rem; font-weight: 700; cursor: pointer;
      backdrop-filter: blur(6px); transition: background 0.2s;
      text-decoration: none; animation: cw-fadein 0.3s ease;
    }
    #cw-login-btn:hover { background: rgba(51,255,255,0.15); }
  `;

  const styleEl = document.createElement("style");
  styleEl.textContent = STYLE;
  document.head.appendChild(styleEl);

  function escHtml(str) {
    return String(str ?? "").replace(
      /[&<>"']/g,
      c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])
    );
  }

  function renderWidget(user) {
    document.getElementById("cw-widget")?.remove();
    document.getElementById("cw-login-btn")?.remove();
    const div = document.createElement("div");
    div.id = "cw-widget";
    div.innerHTML = `
      <div class="cw-avatar">${(user.username || "?")[0].toUpperCase()}</div>
      <div class="cw-info">
        <div class="cw-name">${escHtml(user.username)}</div>
        <div class="cw-meta">ID: ${escHtml(user.id)} &nbsp;·&nbsp; Créditos: <span>${user.credits}</span></div>
      </div>
      <button class="cw-logout" title="Cerrar sesión">&#10005;</button>
    `;
    div.querySelector(".cw-logout").addEventListener("click", () => {
      if (confirm("¿Cerrar sesión?")) {
        clearSession();
        window.location.href = LOGIN_PAGE;
      }
    });
    document.body.appendChild(div);
  }

  function renderLoginButton() {
    document.getElementById("cw-login-btn")?.remove();
    const a = document.createElement("a");
    a.id = "cw-login-btn";
    a.href = LOGIN_PAGE;
    a.textContent = "Iniciar sesión";
    document.body.appendChild(a);
  }

  async function refreshUser(token) {
    try {
      const res = await fetch(API_BASE + "/auth/me", {
        headers: { Authorization: "Bearer " + token }
      });
      if (!res.ok) {
        clearSession();
        if (isProtected) window.location.replace(LOGIN_PAGE);
        else renderLoginButton();
        return;
      }
      const data = await res.json();
      localStorage.setItem("cw_user", JSON.stringify(data.user));
      renderWidget(data.user);

      const redirect = sessionStorage.getItem("cw_redirect");
      if (redirect && window.location.pathname.endsWith(LOGIN_PAGE)) {
        sessionStorage.removeItem("cw_redirect");
        window.location.replace(redirect);
      }
    } catch {
      const cached = getUser();
      if (cached) renderWidget(cached);
      else if (!isProtected) renderLoginButton();
    }
  }

  /* ── Arranque ─────────────────────────────────────────────────── */
  const token = getToken();
  if (token) {
    const cached = getUser();
    if (cached) renderWidget(cached);
    refreshUser(token);
  } else {
    if (!isProtected) renderLoginButton();
  }
})();
