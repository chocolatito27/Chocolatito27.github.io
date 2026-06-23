/* ══════════════════════════════════════════════════════════════════
   sidebar.js — Sidebar unificado para TODAS las páginas
   Carga automáticamente el overlay, maneja el toggle, y crea
   consistencia visual en toda la web.
══════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  // Evitar doble inicialización
  if (window.__SIDEBAR_INIT__) return;
  window.__SIDEBAR_INIT__ = true;

  // Crear overlay si no existe
  function ensureOverlay() {
    let overlay = document.querySelector(".sidebar-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "sidebar-overlay";
      overlay.id = "sidebarOverlay";
      overlay.addEventListener("click", () => toggleMenu());
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  // Función global toggleMenu
  window.toggleMenu = function () {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;

    // Detectar si está abierto (left:0px o clase .open)
    const isOpen = sidebar.classList.contains("open") || sidebar.style.left === "0px";

    if (isOpen) {
      sidebar.classList.remove("open");
      sidebar.style.left = "-260px";
      const overlay = document.querySelector(".sidebar-overlay");
      if (overlay) overlay.classList.remove("open");
    } else {
      sidebar.classList.add("open");
      sidebar.style.left = "0px";
      const overlay = ensureOverlay();
      overlay.classList.add("open");
    }
  };

  // Cerrar sidebar al presionar Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const sidebar = document.querySelector(".sidebar");
      if (sidebar && (sidebar.classList.contains("open") || sidebar.style.left === "0px")) {
        toggleMenu();
      }
    }
  });

  // Cerrar sidebar al hacer clic en un link (excepto anchors #)
  document.addEventListener("click", (e) => {
    const link = e.target.closest(".sidebar ul li a");
    if (link && link.getAttribute("href") && link.getAttribute("href") !== "#") {
      // Pequeño delay para que la navegación se note
      setTimeout(() => {
        const sidebar = document.querySelector(".sidebar");
        if (sidebar && (sidebar.classList.contains("open") || sidebar.style.left === "0px")) {
          toggleMenu();
        }
      }, 100);
    }
  });

  // Inicializar al cargar
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureOverlay);
  } else {
    ensureOverlay();
  }
})();
