/* ══════════════════════════════════════════════════════════════════
   ChocoAgent — Lógica del frontend
══════════════════════════════════════════════════════════════════ */

const API_BASE = "https://chocolatito-api-production.up.railway.app/api";
const WS_BASE = "wss://chocolatito-api-production.up.railway.app/api/agent/ws";

const messagesEl = document.getElementById("ca-messages");
const inputEl    = document.getElementById("ca-input");
const sendBtn    = document.getElementById("ca-send");
const formEl     = document.getElementById("ca-input-form");
const creditsEl  = document.getElementById("ca-credits-value");
const sideEmpty  = document.getElementById("ca-side-empty");
const sideContent = document.getElementById("ca-side-content");
const planCard    = document.getElementById("ca-plan-card");
const planSummary = document.getElementById("ca-plan-summary");
const planVideos  = document.getElementById("ca-plan-videos");
const planCost    = document.getElementById("ca-plan-cost");
const planApproveBtn = document.getElementById("ca-plan-approve");
const planCancelBtn  = document.getElementById("ca-plan-cancel");
const progressCard = document.getElementById("ca-progress-card");
const progressBar  = document.getElementById("ca-progress-bar");
const progressStep = document.getElementById("ca-progress-step");
const progressPct  = document.getElementById("ca-progress-percent");
const videosListEl = document.getElementById("ca-videos-list");
const historyBtn   = document.getElementById("ca-history-btn");
const videosModal  = document.getElementById("ca-videos-modal");
const modalClose   = document.getElementById("ca-modal-close");
const modalVideos  = document.getElementById("ca-modal-videos");

let currentTaskId = null;
let pendingPlan = null;
let ws = null;
let pollInterval = null;

/* ───────────────────────────────────────────────────────────────────
   Particles background
─────────────────────────────────────────────────────────────────── */
particlesJS("particles-js", {
  particles: {
    number: { value: 60, density: { enable: true, value_area: 900 } },
    color: { value: ["#33FFFF", "#00c8c8", "#4ade80"] },
    shape: { type: "circle" },
    opacity: { value: 0.4, random: true },
    size: { value: 2.5, random: true },
    line_linked: { enable: true, distance: 130, color: "#33FFFF", opacity: 0.15, width: 1 },
    move: { enable: true, speed: 1.2, direction: "none", random: true, straight: false, out_mode: "out" }
  },
  interactivity: {
    detect_on: "canvas",
    events: { onhover: { enable: true, mode: "grab" }, onclick: { enable: false }, resize: true },
    modes: { grab: { distance: 140, line_linked: { opacity: 0.4 } } }
  },
  retina_detect: true
});

/* ───────────────────────────────────────────────────────────────────
   Helpers
─────────────────────────────────────────────────────────────────── */
function getToken() { return localStorage.getItem("cw_token"); }

function getCachedCredits() {
  try {
    const u = JSON.parse(localStorage.getItem("cw_user") || "{}");
    return u.credits ?? 0;
  } catch { return 0; }
}

function updateCreditsDisplay(value) {
  creditsEl.textContent = value;
  const u = JSON.parse(localStorage.getItem("cw_user") || "{}");
  u.credits = value;
  localStorage.setItem("cw_user", JSON.stringify(u));
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function renderMarkdown(text) {
  // Markdown muy básico: **bold**, *italic*, `code`, saltos de línea
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`(.+?)`/g, "<code>$1</code>");
  html = html.replace(/\n/g, "<br>");
  return html;
}

/* ───────────────────────────────────────────────────────────────────
   Chat bubbles
─────────────────────────────────────────────────────────────────── */
function addBubble(role, content, isTyping = false) {
  const row = document.createElement("div");
  row.className = `bubble-row ${role}`;
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}${isTyping ? " typing" : ""}`;
  if (isTyping) {
    bubble.innerHTML = "<span></span><span></span><span></span>";
  } else {
    bubble.innerHTML = renderMarkdown(content);
  }
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return row;
}

function removeBubble(row) {
  if (row && row.parentNode) row.remove();
}

/* ───────────────────────────────────────────────────────────────────
   Enviar mensaje al agente
─────────────────────────────────────────────────────────────────── */
async function sendMessage(text) {
  if (!text || sendBtn.disabled) return;

  addBubble("user", text);
  inputEl.value = "";
  inputEl.style.height = "auto";
  sendBtn.disabled = true;
  inputEl.disabled = true;

  const typingRow = addBubble("assistant", "", true);

  try {
    const res = await fetch(`${API_BASE}/agent/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getToken(),
      },
      body: JSON.stringify({ content: text }),
    });

    const data = await res.json();
    removeBubble(typingRow);

    if (!res.ok) {
      addBubble("assistant", `❌ Error: ${data.error || "No se pudo procesar"}`);
      return;
    }

    if (data.type === "plan") {
      addBubble("assistant", data.message);
      showPlan(data.plan, data.taskId, data.userCredits, data.canExecute);
    } else {
      addBubble("assistant", data.message);
    }
  } catch (err) {
    removeBubble(typingRow);
    addBubble("assistant", "❌ No se pudo conectar con el servidor. Intenta de nuevo.");
  } finally {
    sendBtn.disabled = false;
    inputEl.disabled = false;
    inputEl.focus();
  }
}

/* ───────────────────────────────────────────────────────────────────
   Mostrar plan generado
─────────────────────────────────────────────────────────────────── */
function showPlan(plan, taskId, userCredits, canExecute) {
  pendingPlan = { plan, taskId };
  sideEmpty.style.display = "none";
  sideContent.style.display = "block";
  planCard.style.display = "block";
  progressCard.style.display = "none";
  videosListEl.innerHTML = "";

  planCost.textContent = `${plan.creditCost} créditos`;

  let summaryHtml = "";
  if (plan.summary) {
    summaryHtml += `<div>${escapeHtml(plan.summary)}</div>`;
  }
  summaryHtml += `<div style="margin-top:8px;font-size:0.82rem;color:rgba(255,255,255,0.6)">
    📊 ${plan.videoCount || 1} videos · ⏱️ ${plan.estimatedTimeMin || 5} min · 💰 ${plan.creditCost} créditos
  </div>`;
  if (!canExecute) {
    summaryHtml += `<div style="margin-top:8px;color:#ef4444;font-size:0.82rem">
      ⚠️ Necesitas ${plan.creditCost - userCredits} créditos más
    </div>`;
  }
  planSummary.innerHTML = summaryHtml;

  // Render videos propuestos
  planVideos.innerHTML = "";
  if (Array.isArray(plan.videos)) {
    plan.videos.forEach((v, i) => {
      const item = document.createElement("div");
      item.className = "ca-plan-video-item";
      item.innerHTML = `
        <div class="num">${i + 1}</div>
        <div class="info">
          <div class="topic">${escapeHtml(v.topic || "Sin tema")}</div>
          <div class="meta">
            ${v.niche ? `Nicho: ${escapeHtml(v.niche)}` : ""}
            ${v.tone ? `· Tono: ${escapeHtml(v.tone)}` : ""}
            ${v.duration_sec ? `· ${v.duration_sec}s` : ""}
          </div>
        </div>
      `;
      planVideos.appendChild(item);
    });
  }

  planApproveBtn.disabled = !canExecute;
  if (!canExecute) {
    planApproveBtn.innerHTML = '<i class="fas fa-lock"></i> Créditos insuficientes';
  } else {
    planApproveBtn.innerHTML = '<i class="fas fa-play"></i> Aprobar y ejecutar';
  }
}

/* ───────────────────────────────────────────────────────────────────
   Aprobar plan y ejecutar
─────────────────────────────────────────────────────────────────── */
async function approvePlan() {
  if (!pendingPlan) return;
  const { taskId, plan } = pendingPlan;

  planApproveBtn.disabled = true;
  planApproveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aprobando...';

  try {
    const res = await fetch(`${API_BASE}/agent/execute/${taskId}`, {
      method: "POST",
      headers: { Authorization: "Bearer " + getToken() },
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Error al aprobar");
      planApproveBtn.disabled = false;
      planApproveBtn.innerHTML = '<i class="fas fa-play"></i> Aprobar y ejecutar';
      return;
    }

    // Plan aprobado, mostrar progreso
    currentTaskId = taskId;
    planCard.style.display = "none";
    progressCard.style.display = "block";
    progressBar.style.width = "0%";
    progressStep.textContent = "En cola...";
    progressPct.textContent = "0%";

    // Actualizar créditos
    if (data.creditsRemaining !== undefined) {
      updateCreditsDisplay(data.creditsRemaining);
    }

    // Conectar WebSocket para progreso
    connectWebSocket(taskId);

    // Polling de respaldo (cada 5s) por si el WS falla
    startPolling(taskId);

    addBubble("assistant", "✅ Plan aprobado. Empezando a producir tus videos...");
  } catch (err) {
    alert("Error de conexión: " + err.message);
    planApproveBtn.disabled = false;
    planApproveBtn.innerHTML = '<i class="fas fa-play"></i> Aprobar y ejecutar';
  }
}

/* ───────────────────────────────────────────────────────────────────
   Cancelar plan
─────────────────────────────────────────────────────────────────── */
function cancelPlan() {
  pendingPlan = null;
  planCard.style.display = "none";
  if (videosListEl.children.length === 0) {
    sideContent.style.display = "none";
    sideEmpty.style.display = "block";
  }
}

/* ───────────────────────────────────────────────────────────────────
   WebSocket para progreso en tiempo real
─────────────────────────────────────────────────────────────────── */
function connectWebSocket(taskId) {
  if (ws) {
    try { ws.close(); } catch {}
  }
  const token = getToken();
  if (!token) return;

  ws = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(token)}`);

  ws.onopen = () => {
    console.log("WebSocket conectado");
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      if (msg.type === "task_progress" && msg.taskId === taskId) {
        updateProgress(msg.progress, msg.step, msg.done, msg.error);
      } else if (msg.type === "agent_message" && msg.taskId === taskId) {
        addBubble("assistant", msg.content);
      }
    } catch (err) {
      console.error("WS message error:", err);
    }
  };

  ws.onclose = () => {
    console.log("WebSocket cerrado");
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
  };
}

/* ───────────────────────────────────────────────────────────────────
   Polling de respaldo
─────────────────────────────────────────────────────────────────── */
function startPolling(taskId) {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    if (!currentTaskId) {
      clearInterval(pollInterval);
      return;
    }
    await fetchTaskStatus(taskId);
  }, 5000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

async function fetchTaskStatus(taskId) {
  try {
    const res = await fetch(`${API_BASE}/agent/task/${taskId}`, {
      headers: { Authorization: "Bearer " + getToken() },
    });
    if (!res.ok) return;
    const data = await res.json();

    updateProgress(data.task.progress, data.task.current_step,
                   data.task.status === "completed" || data.task.status === "failed",
                   data.task.error);

    // Render videos
    if (data.videos && data.videos.length > 0) {
      renderVideos(data.videos);
    }

    // Si terminó, detener polling
    if (data.task.status === "completed" || data.task.status === "failed") {
      stopPolling();
    }
  } catch (err) {
    console.error("Poll error:", err);
  }
}

function updateProgress(progress, step, done, error) {
  progressBar.style.width = `${progress}%`;
  progressPct.textContent = `${progress}%`;
  if (step) progressStep.textContent = step;

  if (done) {
    if (error) {
      progressStep.innerHTML = `❌ Error: ${escapeHtml(error)}`;
      progressCard.style.borderColor = "rgba(239,68,68,0.4)";
    } else {
      progressStep.innerHTML = "✅ Completado";
      progressCard.style.borderColor = "rgba(74,222,128,0.4)";
    }
    // Quitar spinner
    const spinner = document.querySelector(".ca-progress-spinner");
    if (spinner) spinner.style.display = "none";
  }
}

/* ───────────────────────────────────────────────────────────────────
   Render videos en panel lateral
─────────────────────────────────────────────────────────────────── */
function renderVideos(videos) {
  videosListEl.innerHTML = "";
  videos.forEach((v) => {
    const card = createVideoCard(v);
    videosListEl.appendChild(card);
  });
}

function createVideoCard(v) {
  const card = document.createElement("div");
  card.className = `ca-video-card ${v.status || "pending"}`;

  const statusLabel = {
    pending: "⏳ Pendiente",
    scripting: "✍️ Guion",
    voicing: "🎙️ Voz",
    imaging: "🎨 Imagen",
    rendering: "🎬 Renderizando",
    ready: "✅ Listo",
    failed: "❌ Falló",
  }[v.status] || v.status;

  const thumbUrl = v.thumbnail_url || v.image_url || "";
  const videoUrl = v.video_url
    ? `${API_BASE.replace("/api", "")}${v.video_url}?token=${encodeURIComponent(getToken())}`
    : "#";

  card.innerHTML = `
    <div class="ca-video-thumb">
      ${thumbUrl ? `<img src="${escapeHtml(thumbUrl)}" alt="" loading="lazy">` : ""}
      <div class="status-badge ${v.status === "ready" ? "ready" : v.status === "failed" ? "failed" : "processing"}">
        ${statusLabel}
      </div>
    </div>
    <div class="ca-video-body">
      ${v.title ? `<h4 class="ca-video-title">${escapeHtml(v.title)}</h4>` : ""}
      <div class="ca-video-meta">
        ${v.duration_sec ? `${v.duration_sec}s` : ""}
        ${v.hook ? `· "${escapeHtml(v.hook.slice(0, 60))}${v.hook.length > 60 ? "..." : ""}"` : ""}
      </div>
      ${v.hashtags && v.hashtags.length ? `
        <div class="ca-video-tags">
          ${v.hashtags.slice(0, 5).map(t => `<span class="ca-video-tag">${escapeHtml(t)}</span>`).join("")}
        </div>
      ` : ""}
      ${v.error ? `<div class="ca-video-error">${escapeHtml(v.error)}</div>` : ""}
      ${v.status === "ready" ? `
        <div class="ca-video-actions">
          <a class="ca-video-btn download" href="${videoUrl}" download="${escapeHtml((v.title || "video").replace(/\s+/g, "_"))}.mp4">
            <i class="fas fa-download"></i> Descargar MP4
          </a>
          <button class="ca-video-btn copy" data-video-id="${v.id}">
            <i class="fas fa-copy"></i> Copiar texto
          </button>
        </div>
      ` : ""}
    </div>
  `;

  // Bind copy button
  const copyBtn = card.querySelector(".ca-video-btn.copy");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => copyVideoText(v));
  }

  return card;
}

async function copyVideoText(v) {
  const text = `${v.title || ""}

${v.description || ""}

${(v.hashtags || []).join(" ")}`.trim();

  try {
    await navigator.clipboard.writeText(text);
    const btn = document.querySelector(`[data-video-id="${v.id}"]`);
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-check"></i> Copiado';
      setTimeout(() => { btn.innerHTML = orig; }, 2000);
    }
  } catch {
    alert("No se pudo copiar");
  }
}

/* ───────────────────────────────────────────────────────────────────
   Modal: Mis videos (historial)
─────────────────────────────────────────────────────────────────── */
async function openVideosModal() {
  videosModal.classList.add("open");
  modalVideos.innerHTML = '<p class="ca-modal-empty">Cargando...</p>';

  try {
    const res = await fetch(`${API_BASE}/agent/videos?limit=50`, {
      headers: { Authorization: "Bearer " + getToken() },
    });
    const data = await res.json();

    if (!res.ok) {
      modalVideos.innerHTML = `<p class="ca-modal-empty">Error: ${escapeHtml(data.error)}</p>`;
      return;
    }

    if (!data.videos || data.videos.length === 0) {
      modalVideos.innerHTML = `
        <p class="ca-modal-empty">
          Aún no tienes videos generados.<br>
          Pídele al agente que cree algunos. 🎬
        </p>`;
      return;
    }

    modalVideos.innerHTML = "";
    data.videos.forEach((v) => {
      const card = createVideoCard(v);
      card.style.marginBottom = "14px";
      modalVideos.appendChild(card);
    });
  } catch (err) {
    modalVideos.innerHTML = `<p class="ca-modal-empty">Error: ${escapeHtml(err.message)}</p>`;
  }
}

function closeVideosModal() {
  videosModal.classList.remove("open");
}

/* ───────────────────────────────────────────────────────────────────
   Cargar historial de conversación
─────────────────────────────────────────────────────────────────── */
async function loadHistory() {
  try {
    const res = await fetch(`${API_BASE}/agent/history?limit=20`, {
      headers: { Authorization: "Bearer " + getToken() },
    });
    if (!res.ok) return;
    const data = await res.json();

    if (data.messages && data.messages.length > 0) {
      // Limpiar mensaje inicial
      messagesEl.innerHTML = "";
      data.messages.forEach((m) => {
        if (m.role === "user" || m.role === "assistant") {
          addBubble(m.role, m.content);
        }
      });
    }
  } catch (err) {
    console.error("History error:", err);
  }
}

/* ───────────────────────────────────────────────────────────────────
   Eventos
─────────────────────────────────────────────────────────────────── */
formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (text) sendMessage(text);
});

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (text) sendMessage(text);
  }
});

inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
});

planApproveBtn.addEventListener("click", approvePlan);
planCancelBtn.addEventListener("click", cancelPlan);
historyBtn.addEventListener("click", openVideosModal);
modalClose.addEventListener("click", closeVideosModal);
videosModal.addEventListener("click", (e) => {
  if (e.target === videosModal) closeVideosModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && videosModal.classList.contains("open")) {
    closeVideosModal();
  }
});

/* ───────────────────────────────────────────────────────────────────
   Init
─────────────────────────────────────────────────────────────────── */
(async function init() {
  // Mostrar créditos
  updateCreditsDisplay(getCachedCredits());

  // Cargar historial (silencioso)
  await loadHistory();

  // Focus en input
  inputEl.focus();
})();
