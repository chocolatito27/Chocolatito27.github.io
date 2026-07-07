/* ══════════════════════════════════════════════════════════════════
   ChocolatitoAI V2 — Streaming + Gráficos + Interactivo
══════════════════════════════════════════════════════════════════ */

const API_BASE  = "https://chocolatito-api-production.up.railway.app/api";
const STREAM_URL = API_BASE + "/chat/stream";
const IMAGE_URL  = API_BASE + "/image/generate";
const IMAGE_COST = 5;

const messagesEl = document.getElementById("cai-messages");
const inputBox   = document.getElementById("cai-input");
const sendBtn    = document.getElementById("cai-send");
const imgBtn     = document.getElementById("cai-img-btn");
const imgModal   = document.getElementById("img-modal");
const imgInput   = document.getElementById("img-prompt-input");
const imgGenBtn  = document.getElementById("img-gen-btn");
const imgCancel  = document.getElementById("img-cancel-btn");
const statusEl   = document.getElementById("cai-status");
const statusText = document.getElementById("cai-status-text");

let chatHistory = [{ role: "assistant", content: "¡Hola! Soy ChocolatitoAI 🎓" }];
let isGenerating = false;
let currentAbortController = null;        // para poder DETENER la generación
const HISTORY_KEY = "cai_history";        // conversación guardada

const SEND_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
const STOP_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

function getToken() { return localStorage.getItem("cw_token"); }

/* ── Guardar / restaurar conversación ───────────────────────────── */
function saveHistory() {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(chatHistory)); } catch {}
}
function restoreHistory() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "null"); } catch {}
  if (!Array.isArray(saved) || saved.length <= 1) return;
  chatHistory = saved;
  messagesEl.innerHTML = "";
  saved.forEach((m, i) => {
    if (i === 0) return;                  // saludo inicial
    if (m.role === "user") {
      addBubble("user", m.content);
    } else if (m.role === "assistant") {
      const { bubble } = addBubble("assistant", m.content);
      addAssistantActions(bubble, m.content);
    }
  });
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/* ── Botón enviar / detener ─────────────────────────────────────── */
function setSendButtonMode(mode) {
  if (mode === "stop") {
    sendBtn.innerHTML = STOP_ICON;
    sendBtn.classList.add("stop");
    sendBtn.title = "Detener generación";
  } else {
    sendBtn.innerHTML = SEND_ICON;
    sendBtn.classList.remove("stop");
    sendBtn.title = "Enviar";
  }
}
function stopGeneration() {
  if (currentAbortController) currentAbortController.abort();
}

/* ── Acciones bajo cada respuesta: copiar / regenerar ───────────── */
function addAssistantActions(bubble, content) {
  if (bubble.querySelector(".cai-msg-actions")) return;
  // sólo el último mensaje conserva "Regenerar"
  messagesEl.querySelectorAll(".cai-regen-btn").forEach(b => b.remove());

  const actions = document.createElement("div");
  actions.className = "cai-msg-actions";

  const copyBtn = document.createElement("button");
  copyBtn.className = "cai-action-btn";
  copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copiar';
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(content).then(() => {
      copyBtn.innerHTML = '<i class="fas fa-check"></i> Copiado';
      copyBtn.classList.add("done");
      setTimeout(() => {
        copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copiar';
        copyBtn.classList.remove("done");
      }, 1800);
    }).catch(() => {});
  };
  actions.appendChild(copyBtn);

  const regenBtn = document.createElement("button");
  regenBtn.className = "cai-action-btn cai-regen-btn";
  regenBtn.innerHTML = '<i class="fas fa-rotate-right"></i> Regenerar';
  regenBtn.onclick = () => regenerateLast();
  actions.appendChild(regenBtn);

  bubble.appendChild(actions);
}

/* ── Rastreador de pasos del agente ─────────────────────────────── */
function addAgentStep(stepsEl, label) {
  if (!stepsEl) return;
  // marca el paso anterior como completado
  const prev = stepsEl.querySelector(".cai-step.active");
  if (prev) {
    prev.classList.remove("active");
    prev.classList.add("done");
    const ic = prev.querySelector(".cai-step-ic");
    if (ic) ic.innerHTML = '<i class="fas fa-check"></i>';
  }
  // evita duplicados exactos consecutivos
  const last = stepsEl.lastElementChild;
  if (last && last.dataset.label === label) return;

  const step = document.createElement("div");
  step.className = "cai-step active";
  step.dataset.label = label;
  step.innerHTML = '<span class="cai-step-ic"><span class="cai-step-spin"></span></span><span class="cai-step-txt"></span>';
  step.querySelector(".cai-step-txt").textContent = label;
  stepsEl.appendChild(step);
}
function finishAgentSteps(stepsEl) {
  if (!stepsEl) return;
  stepsEl.querySelectorAll(".cai-step.active").forEach(s => {
    s.classList.remove("active");
    s.classList.add("done");
    const ic = s.querySelector(".cai-step-ic");
    if (ic) ic.innerHTML = '<i class="fas fa-check"></i>';
  });
}

/* ── Regenerar la última respuesta ──────────────────────────────── */
function regenerateLast() {
  if (isGenerating) return;
  if (chatHistory.length && chatHistory[chatHistory.length - 1].role === "assistant") {
    chatHistory.pop();
    const rows = messagesEl.querySelectorAll(".bubble-row.assistant");
    if (rows.length) rows[rows.length - 1].remove();
    saveHistory();
  }
  if (chatHistory.length && chatHistory[chatHistory.length - 1].role === "user") {
    streamAssistant();
  }
}

/* ── Partículas ──────────────────────────────────────────────────── */
particlesJS("particles-js", {
  particles: {
    number: { value: 50, density: { enable: true, value_area: 900 } },
    color: { value: ["#EE6A28", "#C4531A", "#4ade80"] },
    shape: { type: "circle" },
    opacity: { value: 0.3, random: true },
    size: { value: 2.5, random: true },
    line_linked: { enable: true, distance: 130, color: "#EE6A28", opacity: 0.1, width: 1 },
    move: { enable: true, speed: 1, direction: "none", random: true, straight: false, out_mode: "out" }
  },
  interactivity: { detect_on: "canvas", events: { onhover: { enable: true, mode: "grab" }, resize: true }, modes: { grab: { distance: 140, line_linked: { opacity: 0.2 } } } },
  retina_detect: true
});

/* ── Status helpers ──────────────────────────────────────────────── */
function setStatusThinking(msg) {
  statusEl.classList.add("thinking");
  statusText.textContent = msg || "Pensando...";
}
function setStatusOnline() {
  statusEl.classList.remove("thinking", "error");
  statusText.textContent = "En línea";
}
function setStatusError(msg) {
  statusEl.classList.remove("thinking");
  statusEl.classList.add("error");
  statusText.textContent = msg || "Error";
}

/* ── Markdown + LaTeX + Código + Gráficos ────────────────────────── */
function normalizeMath(text) {
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, l) => `\n$$${l.trim()}$$\n`);
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, l) => `$${l.trim()}$`);
  return text;
}

function renderContent(rawText) {
  const text = normalizeMath(rawText);
  const mathBlocks = [];

  // Extraer bloques matemáticos
  let safe = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, latex) => {
    const id = `MATHBLK${mathBlocks.length}ENDBLK`;
    mathBlocks.push({ id, latex, display: true });
    return id;
  });
  safe = safe.replace(/\$([^$\n]+?)\$/g, (_, latex) => {
    const id = `MATHINL${mathBlocks.length}ENDINL`;
    mathBlocks.push({ id, latex, display: false });
    return id;
  });

  // Extraer bloques plotly — múltiples formatos
  const plotlyBlocks = [];
  // Formato 1: ```plotly\n{...}\n``` (correcto)
  safe = safe.replace(/```plotly\s*\n?([\s\S]*?)```/g, (_, json) => {
    const idx = plotlyBlocks.length;
    try {
      plotlyBlocks.push({ idx, config: JSON.parse(json.trim()) });
    } catch (e) {
      plotlyBlocks.push({ idx, config: null, error: e.message });
    }
    // Usar un div con data-attribute para que marked no lo convierta en texto
    return `\n<div data-plotly="${idx}"></div>\n`;
  });
  // Formato 2: JSON suelto con type:line/bar/surface3d (sin backticks)
  safe = safe.replace(/\{"type":"(?:line|bar|surface3d)"[^]*?\}(?=\n|$)/g, (json) => {
    if (json.includes('"functions"') || json.includes('"labels"') || json.includes('"function"')) {
      const idx = plotlyBlocks.length;
      try {
        plotlyBlocks.push({ idx, config: JSON.parse(json) });
      } catch (e) {
        plotlyBlocks.push({ idx, config: null, error: e.message });
      }
      return `\n<div data-plotly="${idx}"></div>\n`;
    }
    return json;
  });

  marked.setOptions({ breaks: true, gfm: true });
  let html = marked.parse(safe);

  // Renderizar LaTeX
  for (const blk of mathBlocks) {
    const el = document.createElement(blk.display ? "div" : "span");
    try { katex.render(blk.latex.trim(), el, { displayMode: blk.display, throwOnError: false }); }
    catch { el.textContent = blk.latex; }
    html = html.replace(blk.id, el.outerHTML);
  }

  const container = document.createElement("div");
  container.innerHTML = html;

  // Highlight code
  container.querySelectorAll("pre code").forEach(code => {
    hljs.highlightElement(code);
    const pre = code.parentElement;
    pre.style.position = "relative";
    const btn = document.createElement("button");
    btn.className = "copy-btn";
    btn.textContent = "Copiar";
    btn.onclick = () => {
      navigator.clipboard.writeText(code.innerText).then(() => {
        btn.textContent = "✓ Copiado"; btn.classList.add("copied");
        setTimeout(() => { btn.textContent = "Copiar"; btn.classList.remove("copied"); }, 2000);
      }).catch(() => {});
    };
    pre.appendChild(btn);
  });

  // Renderizar gráficos Plotly — buscar divs con data-plotly
  plotlyBlocks.forEach((pb) => {
    const placeholder = container.querySelector(`div[data-plotly="${pb.idx}"]`);
    if (!placeholder) return;

    const chartDiv = document.createElement("div");
    chartDiv.className = "cai-chart-container";
    const innerDiv = document.createElement("div");
    innerDiv.id = `plotly-chart-${Date.now()}-${pb.idx}`;
    chartDiv.appendChild(innerDiv);
    placeholder.replaceWith(chartDiv);
    if (pb.config) {
      setTimeout(() => renderPlotly(innerDiv.id, pb.config), 100);
    } else {
      innerDiv.innerHTML = `<p style="color:#ef4444;font-size:0.8rem">Error: ${pb.error || "JSON inválido"}</p>`;
    }
  });

  return container;
}

/* ── Renderizar gráfico Plotly ──────────────────────────────────── */
function renderPlotly(divId, config) {
  const el = document.getElementById(divId);
  if (!el || !window.Plotly) return;

  try {
    if (config.type === "line" && config.functions) {
      // Gráfico de líneas 2D — soporta funciones y polígonos
      const traces = config.functions.map(fn => {
        // Si tiene "points", es un polígono/figura geométrica
        if (fn.points) {
          const coords = fn.points.split(",").map(Number);
          const xValues = [];
          const yValues = [];
          for (let i = 0; i < coords.length; i += 2) {
            xValues.push(coords[i]);
            yValues.push(coords[i + 1]);
          }
          return {
            x: xValues, y: yValues, type: "scatter", mode: "lines+markers",
            name: fn.name || "", line: { color: fn.color || "#EE6A28", width: 3 },
            marker: { size: 8, color: fn.color || "#EE6A28" },
          };
        }
        // Función normal
        const xValues = [];
        const yValues = [];
        const [xMin, xMax] = config.range?.x || [-10, 10];
        const steps = 200;
        for (let i = 0; i <= steps; i++) {
          const x = xMin + (xMax - xMin) * i / steps;
          xValues.push(x);
          try {
            const y = Function("x", "return " + fn.expr)(x);
            if (isFinite(y)) yValues.push(y); else yValues.push(null);
          } catch { yValues.push(null); }
        }
        return {
          x: xValues, y: yValues, type: "scatter", mode: "lines",
          name: fn.name || fn.expr, line: { color: fn.color || "#EE6A28", width: 2 },
          connectgaps: true,
        };
      });

      const layout = {
        title: { text: config.title || "", font: { color: "#fff", size: 14 } },
        xaxis: { title: config.xlabel || "x", color: "#aaa", gridcolor: "#222", zerolinecolor: "#444" },
        yaxis: { title: config.ylabel || "y", color: "#aaa", gridcolor: "#222", zerolinecolor: "#444" },
        paper_bgcolor: "transparent", plot_bgcolor: "rgba(0,0,0,0.3)",
        font: { color: "#ddd", family: "Inter, sans-serif" },
        margin: { l: 50, r: 20, t: 40, b: 40 },
        showlegend: true, legend: { font: { color: "#ddd" }, bgcolor: "rgba(0,0,0,0.3)" },
      };

      Plotly.newPlot(divId, traces, layout, {
        responsive: true, displayModeBar: true,
        modeBarButtonsToRemove: ["lasso2d", "select2d"],
      });

    } else if (config.type === "bar") {
      const trace = {
        x: config.labels, y: config.values, type: "bar",
        marker: { color: config.colors || ["#EE6A28", "#4ade80", "#f97316", "#a896f0", "#ef4444"] },
      };
      const layout = {
        title: { text: config.title || "", font: { color: "#fff", size: 14 } },
        paper_bgcolor: "transparent", plot_bgcolor: "rgba(0,0,0,0.3)",
        font: { color: "#ddd", family: "Inter, sans-serif" },
        margin: { l: 50, r: 20, t: 40, b: 40 },
        xaxis: { color: "#aaa", gridcolor: "#222" },
        yaxis: { color: "#aaa", gridcolor: "#222" },
      };
      Plotly.newPlot(divId, [trace], layout, { responsive: true });

    } else if (config.type === "surface3d") {
      const [xMin, xMax] = config.range?.x || [-5, 5];
      const [yMin, yMax] = config.range?.y || [-5, 5];
      const steps = 40;
      const xValues = [];
      const yValues = [];
      const zValues = [];
      const fn = Function("x", "y", "return " + config.function);

      for (let i = 0; i <= steps; i++) {
        xValues.push(xMin + (xMax - xMin) * i / steps);
      }
      for (let j = 0; j <= steps; j++) {
        yValues.push(yMin + (yMax - yMin) * j / steps);
      }
      for (let j = 0; j <= steps; j++) {
        const row = [];
        for (let i = 0; i <= steps; i++) {
          try { row.push(fn(xValues[i], yValues[j])); } catch { row.push(0); }
        }
        zValues.push(row);
      }

      const trace = { type: "surface", x: xValues, y: yValues, z: zValues, colorscale: "Viridis" };
      const layout = {
        title: { text: config.title || "", font: { color: "#fff", size: 14 } },
        paper_bgcolor: "transparent", plot_bgcolor: "rgba(0,0,0,0.3)",
        font: { color: "#ddd", family: "Inter, sans-serif" },
        margin: { l: 0, r: 0, t: 40, b: 0 },
        scene: { xaxis: { color: "#aaa" }, yaxis: { color: "#aaa" }, zaxis: { color: "#aaa" } },
      };
      Plotly.newPlot(divId, [trace], layout, { responsive: true });
    }
  } catch (err) {
    el.innerHTML = `<p style="color:#ef4444;font-size:0.8rem">Error al renderizar gráfico: ${err.message}</p>`;
  }
}

/* ── Burbujas ───────────────────────────────────────────────────── */
function addBubble(role, content, isStreaming = false) {
  const row = document.createElement("div");
  row.className = `bubble-row ${role}`;
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}${isStreaming ? " streaming" : ""}`;
  if (isStreaming) {
    // Badge de progreso
    const badge = document.createElement("div");
    badge.className = "cai-progress-badge";
    badge.innerHTML = '<span class="spinner"></span> <span class="badge-text">Generando...</span>';
    bubble.appendChild(badge);
    // Rastreador de pasos del agente
    const steps = document.createElement("div");
    steps.className = "cai-agent-steps";
    bubble.appendChild(steps);
    // Contenedor donde se irá mostrando el texto
    const contentDiv = document.createElement("div");
    contentDiv.className = "streaming-content";
    bubble.appendChild(contentDiv);
  } else {
    bubble.appendChild(renderContent(content));
  }
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return { row, bubble };
}

/* ── Enviar mensaje ─────────────────────────────────────────────── */
async function sendMessage(text) {
  if (!text || isGenerating) return;
  addBubble("user", text);
  chatHistory.push({ role: "user", content: text });
  saveHistory();
  inputBox.value = "";
  inputBox.style.height = "auto";
  await streamAssistant();
}

/* ── Stream de la respuesta (con opción de DETENER) ─────────────── */
async function streamAssistant() {
  inputBox.disabled = true;
  isGenerating = true;
  setSendButtonMode("stop");          // el botón pasa a "detener"
  setStatusThinking("Analizando...");

  const { row, bubble } = addBubble("assistant", "", true);
  const contentDiv = bubble.querySelector(".streaming-content");
  const stepsEl = bubble.querySelector(".cai-agent-steps");
  const badge = bubble.querySelector(".cai-progress-badge");
  const badgeText = badge.querySelector(".badge-text");

  let accumulated = "";
  currentAbortController = new AbortController();

  try {
    const res = await fetch(STREAM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getToken(),
      },
      body: JSON.stringify({ messages: chatHistory }),
      signal: currentAbortController.signal,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data) continue;

        try {
          const parsed = JSON.parse(data);

          if (parsed.type === "status") {
            badgeText.textContent = parsed.content;
            addAgentStep(stepsEl, parsed.content);
            setStatusThinking(parsed.content.replace(/[^a-zA-Záéíóú ]/g, "").trim() || "Procesando...");
          }

          if (parsed.type === "delta") {
            if (badge) badge.style.display = "none";
            accumulated += parsed.content;
            contentDiv.innerHTML = "";
            contentDiv.appendChild(renderContent(accumulated));
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }

          if (parsed.type === "done") {
            if (badge) badge.style.display = "none";
            finishAgentSteps(stepsEl);
            bubble.classList.remove("streaming");
            accumulated = parsed.content;
            contentDiv.innerHTML = "";
            contentDiv.appendChild(renderContent(parsed.content));
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }

          if (parsed.type === "error") {
            throw new Error(parsed.content);
          }
        } catch (e) {
          if (e.message && e.message.includes("HTTP")) throw e;
        }
      }
    }

    // Guardar la respuesta y añadir acciones
    if (accumulated) {
      chatHistory.push({ role: "assistant", content: accumulated });
      addAssistantActions(bubble, accumulated);
      saveHistory();
    }
    setStatusOnline();

  } catch (err) {
    if (badge) badge.style.display = "none";
    bubble.classList.remove("streaming");

    if (err.name === "AbortError") {
      // Detenido por el usuario: conservamos lo que se alcanzó a generar
      finishAgentSteps(stepsEl);
      if (accumulated) {
        chatHistory.push({ role: "assistant", content: accumulated });
        addAssistantActions(bubble, accumulated);
        saveHistory();
      } else {
        row.remove();
      }
      setStatusOnline();
    } else {
      contentDiv.innerHTML = "";
      const errEl = document.createElement("div");
      errEl.innerHTML = `❌ Error: ${err.message}<br><small style="color:rgba(255,255,255,0.4)">Intenta de nuevo en unos segundos</small>`;
      errEl.style.color = "#ef4444";
      contentDiv.appendChild(errEl);
      setStatusError("Error de conexión");
    }
  } finally {
    currentAbortController = null;
    isGenerating = false;
    setSendButtonMode("send");
    inputBox.disabled = false;
    inputBox.focus();
    setTimeout(() => { if (!isGenerating) setStatusOnline(); }, 3000);
  }
}

/* ── Sugerencias ────────────────────────────────────────────────── */
function useSuggestion(text) {
  inputBox.value = text;
  inputBox.focus();
  sendMessage(text);
}

/* ── Limpiar chat ───────────────────────────────────────────────── */
function clearChat() {
  if (!confirm("¿Limpiar toda la conversación?")) return;
  chatHistory = [{ role: "assistant", content: "¡Hola! Soy ChocolatitoAI 🎓" }];
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
  messagesEl.innerHTML = `
    <div class="bubble-row assistant">
      <div class="bubble assistant">
        <p>¡Conversación limpiada! 🧹 ¿Qué quieres resolver ahora?</p>
        <div class="cai-suggestions">
          <button class="cai-suggestion" onclick="useSuggestion('Resuelve la integral de x²·eˣ dx')">📐 Integral de x²·eˣ</button>
          <button class="cai-suggestion" onclick="useSuggestion('Grafica la función f(x) = x³ - 3x² + 2')">📊 Graficar función</button>
          <button class="cai-suggestion" onclick="useSuggestion('Calcula el determinante de la matriz [[1,2,3],[4,5,6],[7,8,9]]')">🔢 Álgebra lineal</button>
          <button class="cai-suggestion" onclick="useSuggestion('Explica la ley de Ohm con un ejemplo')">⚡ Física</button>
        </div>
      </div>
    </div>`;
}

/* ── Generación de imágenes (sin cambios) ───────────────────────── */
imgBtn.addEventListener("click", () => {
  imgInput.value = "";
  imgModal.classList.add("open");
  setTimeout(() => imgInput.focus(), 100);
});
imgCancel.addEventListener("click", () => imgModal.classList.remove("open"));
imgModal.addEventListener("click", (e) => { if (e.target === imgModal) imgModal.classList.remove("open"); });
imgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generateImage(); }
  if (e.key === "Escape") imgModal.classList.remove("open");
});

async function generateImage() {
  const prompt = imgInput.value.trim();
  if (!prompt) return;
  const token = getToken();
  if (!token) { alert("No hay sesión activa"); return; }
  imgModal.classList.remove("open");
  addBubble("user", `🖼️ Generar imagen: ${prompt}`);
  const loadingRow = addBubble("assistant", "", true);
  try {
    const res = await fetch(IMAGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (!res.ok) { loadingRow.row.remove(); addBubble("assistant", `❌ ${data.error || "Error generando imagen"}`); return; }
    loadingRow.row.remove();
    addImageBubble("assistant", data.prompt, data.imageUrl, data.creditsRemaining);
    const cwUser = JSON.parse(localStorage.getItem("cw_user") || "{}");
    if (cwUser && data.creditsRemaining !== undefined) {
      cwUser.credits = data.creditsRemaining;
      localStorage.setItem("cw_user", JSON.stringify(cwUser));
    }
  } catch { loadingRow.row.remove(); addBubble("assistant", "❌ No se pudo conectar con el servidor de imágenes."); }
}

function addImageBubble(role, prompt, imageUrl, creditsLeft) {
  const row = document.createElement("div");
  row.className = `bubble-row ${role}`;
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role} image-bubble`;
  const label = document.createElement("div");
  label.className = "img-gen-label";
  label.textContent = `🎨 Imagen generada: "${prompt}"`;
  bubble.appendChild(label);
  const img = document.createElement("img");
  img.className = "ai-generated-img";
  img.src = imageUrl; img.alt = prompt; img.loading = "lazy";
  img.onerror = () => { img.style.display = "none"; label.textContent = "❌ Error cargando la imagen."; };
  bubble.appendChild(img);
  const meta = document.createElement("div");
  meta.className = "img-gen-meta";
  meta.innerHTML = `Costó <strong>${IMAGE_COST}</strong> créditos · Quedan <strong>${creditsLeft}</strong>`;
  bubble.appendChild(meta);
  const dlBtn = document.createElement("a");
  dlBtn.className = "img-download-btn";
  dlBtn.href = imageUrl; dlBtn.target = "_blank";
  dlBtn.download = "chocolatito-ai-image.png";
  dlBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Descargar';
  bubble.appendChild(dlBtn);
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/* ── Eventos ────────────────────────────────────────────────────── */
inputBox.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(inputBox.value.trim()); }
});
inputBox.addEventListener("input", () => {
  inputBox.style.height = "auto";
  inputBox.style.height = Math.min(inputBox.scrollHeight, 120) + "px";
});
sendBtn.addEventListener("click", () => {
  if (isGenerating) stopGeneration();
  else sendMessage(inputBox.value.trim());
});
imgGenBtn.addEventListener("click", generateImage);

// Cargar conversación previa (si existe) y focus inicial
restoreHistory();
inputBox.focus();
