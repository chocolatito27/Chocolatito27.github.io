(function () {
  "use strict";

  const API_BASE  = "https://385fd47d-e4b4-4453-981e-7afca555f923-00-9lnnok86qrfn.picard.replit.dev/api";
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

  const STYLE = `
    #cw-widget {
      position: fixed; top: 14px; right: 16px; z-index: 2000;
      display: flex; align-items: center; gap: 8px;
      background: rgba(0,0,0,0.78);
      border: 1px solid rgba(51,255,255,0.35);
      border-radius: 999px; padding: 5px 12px 5px 8px;
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
        <div class="cw-meta">ID: ${escHtml(user.id)} &nbsp;&middot;&nbsp; Cr&eacute;ditos: <span>${user.credits}</span></div>
      </div>
      <button class="cw-logout" title="Cerrar sesi&oacute;n">&#10005;</button>
    `;
    div.querySelector(".cw-logout").addEventListener("click", () => {
      if (confirm("¿Cerrar sesión?")) { clearSession(); window.location.href = LOGIN_PAGE; }
    });
    document.body.appendChild(div);

    const sidebar = document.querySelector(".sidebar");
    if (sidebar) {
      document.getElementById("cw-sidebar-user")?.remove();
      const sec = document.createElement("div");
      sec.id = "cw-sidebar-user";
      sec.innerHTML = `
        <div style="padding:14px 20px 10px;border-bottom:1px solid rgba(255,255,255,0.12);">
          <div style="color:#33FFFF;font-weight:700;font-size:1rem;">${escHtml(user.username)}</div>
          <div style="color:rgba(255,255,255,0.5);font-size:0.78rem;margin-top:3px;">ID: ${escHtml(user.id)}</div>
        </div>
        <div style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.12);">
          <button id="cw-sidebar-logout" style="background:none;border:none;color:#ff5470;cursor:pointer;font-size:0.9rem;padding:0;display:flex;align-items:center;gap:6px;">
            &#8594; Cerrar sesi&oacute;n
          </button>
        </div>
      `;
      const header = sidebar.querySelector(".sidebar-header");
      if (header) header.after(sec);
      else sidebar.prepend(sec);

      document.getElementById("cw-sidebar-logout").addEventListener("click", () => {
        if (confirm("¿Cerrar sesión?")) { clearSession(); window.location.href = LOGIN_PAGE; }
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
