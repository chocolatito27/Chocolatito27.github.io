(function () {
  "use strict";

  const API_BASE  = "https://chocolatito-api-production.up.railway.app/api";
  const LOGIN_PAGE = "login.html";

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }

  function swMessage(msg) {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then(reg => {
      if (reg.active) reg.active.postMessage(msg);
    }).catch(() => {});
  }

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

  const isProtected = (typeof window.CW_PROTECTED !== "undefined" && window.CW_PROTECTED);
  if (isProtected && !getToken()) {
    window.location.replace(LOGIN_PAGE);
    return;
  }

  if (getToken()) swMessage("CW_LOGIN");

  const STYLE = ``;

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
    // Remove old widget/login button if they exist
    document.getElementById("cw-widget")?.remove();
    document.getElementById("cw-login-btn")?.remove();

    // Add user info + logout to sidebar on ALL pages
    const sidebar = document.querySelector(".sidebar");
    if (sidebar) {
      document.getElementById("cw-sidebar-user-wrap")?.remove();
      document.getElementById("cw-sidebar-logout-wrap")?.remove();

      // Remove any static sidebar-username / sidebar-uid elements (from index.html)
      const staticName = document.getElementById("sidebar-username");
      const staticUid  = document.getElementById("sidebar-uid");
      if (staticName) staticName.remove();
      if (staticUid)  staticUid.remove();

      // User info block
      const userWrap = document.createElement("div");
      userWrap.id = "cw-sidebar-user-wrap";
      userWrap.style.cssText = "padding:14px 20px;background:rgba(108,141,245,0.15);border-bottom:1px solid rgba(255,255,255,0.1);display:flex;flex-direction:column;gap:3px;";
      userWrap.innerHTML = `
        <div style="color:#33FFFF;font-weight:700;font-size:0.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(user.username)}</div>
        <div style="color:#aaa;font-size:0.78rem;font-family:'Courier New',monospace;">ID: ${escHtml(user.id)}</div>
        <div style="color:#aaa;font-size:0.78rem;">Cr\u00e9ditos: <span style="color:#4ade80;font-weight:700;">${user.credits}</span></div>
      `;

      // Insert user info right after the sidebar-header
      const header = sidebar.querySelector(".sidebar-header");
      if (header && header.nextSibling) {
        sidebar.insertBefore(userWrap, header.nextSibling);
      } else if (header) {
        sidebar.appendChild(userWrap);
      } else {
        sidebar.insertBefore(userWrap, sidebar.firstChild);
      }

      // Logout button at the bottom
      const logoutWrap = document.createElement("div");
      logoutWrap.id = "cw-sidebar-logout-wrap";
      logoutWrap.style.cssText = "padding:16px 20px;border-top:1px solid rgba(255,255,255,0.12);margin-top:auto;";
      logoutWrap.innerHTML = `
        <button id="cw-sidebar-logout" style="background:none;border:none;color:#ff5470;cursor:pointer;font-size:0.95rem;padding:0;display:flex;align-items:center;gap:8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Cerrar sesi\u00f3n
        </button>
      `;
      sidebar.appendChild(logoutWrap);

      document.getElementById("cw-sidebar-logout").addEventListener("click", () => {
        if (confirm("\u00bfCerrar sesi\u00f3n?")) { clearSession(); window.location.href = LOGIN_PAGE; }
      });
    }
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
    } catch {
      const cached = getUser();
      if (cached) renderWidget(cached);
      else if (!isProtected) renderLoginButton();
    }
  }

  const token = getToken();
  if (token) {
    const cached = getUser();
    if (cached) renderWidget(cached);
    refreshUser(token);
  } else {
    if (!isProtected) renderLoginButton();
  }
})();
