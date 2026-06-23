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

function getToken() { return localStorage.getItem("cw_token"); }

/* ── Partículas ──────────────────────────────────────────────────── */
particlesJS("particles-js", {
  particles: {
    number: { value: 50, density: { enable: true, value_area: 900 } },
    color: { value: ["#33FFFF", "#00c8c8", "#4ade80"] },
    shape: { type: "circle" },
    opacity: { value: 0.3, random: true },
    size: { value: 2.5, random: true },
    line_linked: { enable: true, distance: 130, color: "#33FFFF", opacity: 0.1, width: 1 },
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

  // Extraer bloques plotly antes de marked
  const plotlyBlocks = [];
  safe = safe.replace(/```plotly\n([\s\S]*?)```/g, (_, json) => {
    const id = `PLOTLY${plotlyBlocks.length}PLOT`;
    try {
      plotlyBlocks.push({ id, config: JSON.parse(json.trim()) });
    } catch (e) {
      plotlyBlocks.push({ id, config: null, error: "JSON inválido" });
    }
    return id;
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

  // Renderizar gráficos Plotly
  plotlyBlocks.forEach((pb, idx) => {
    const placeholder = container.querySelector(`#PLOTLY${idx}PLOT`);
    if (!placeholder) return;
    const chartDiv = document.createElement("div");
    chartDiv.className = "cai-chart-container";
    const innerDiv = document.createElement("div");
    innerDiv.id = `plotly-chart-${Date.now()}-${idx}`;
    chartDiv.appendChild(innerDiv);
    placeholder.replaceWith(chartDiv);
    if (pb.config) {
      setTimeout(() => renderPlotly(innerDiv.id, pb.config), 100);
    } else {
      innerDiv.innerHTML = '<p style="color:#ef4444;font-size:0.8rem">Error: JSON del gráfico inválido</p>';
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
            name: fn.name || "", line: { color: fn.color || "#33FFFF", width: 3 },
            marker: { size: 8, color: fn.color || "#33FFFF" },
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
          name: fn.name || fn.expr, line: { color: fn.color || "#33FFFF", width: 2 },
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
        marker: { color: config.colors || ["#33FFFF", "#4ade80", "#f97316", "#a896f0", "#ef4444"] },
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

/* ── Enviar mensaje con STREAMING ────────────────────────────────── */
async function sendMessage(text) {
  if (!text || isGenerating) return;

  addBubble("user", text);
  chatHistory.push({ role: "user", content: text });
  inputBox.value = "";
  inputBox.style.height = "auto";
  sendBtn.disabled = true;
  inputBox.disabled = true;
  isGenerating = true;
  setStatusThinking("Analizando...");

  // Crear burbuja de streaming
  const { row, bubble } = addBubble("assistant", "", true);
  const contentDiv = bubble.querySelector(".streaming-content");
  const badge = bubble.querySelector(".cai-progress-badge");
  const badgeText = badge.querySelector(".badge-text");

  let accumulated = "";
  let lastStatus = "";

  try {
    const res = await fetch(STREAM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getToken(),
      },
      body: JSON.stringify({ messages: chatHistory }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

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
            setStatusThinking(parsed.content.replace(/[^a-zA-Záéíóú ]/g, "").trim() || "Procesando...");
          }

          if (parsed.type === "delta") {
            if (badge) badge.style.display = "none";
            accumulated += parsed.content;
            // Renderizar incrementalmente (solo texto plano por velocidad)
            contentDiv.innerHTML = "";
            contentDiv.appendChild(renderContent(accumulated));
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }

          if (parsed.type === "done") {
            // Render final completo
            if (badge) badge.style.display = "none";
            bubble.classList.remove("streaming");
            contentDiv.innerHTML = "";
            contentDiv.appendChild(renderContent(parsed.content));
            chatHistory.push({ role: "assistant", content: parsed.content });
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }

          if (parsed.type === "error") {
            throw new Error(parsed.content);
          }
        } catch (e) {
          if (e.message.includes("HTTP")) throw e;
        }
      }
    }

    setStatusOnline();
  } catch (err) {
    if (badge) badge.style.display = "none";
    bubble.classList.remove("streaming");
    contentDiv.innerHTML = "";
    const errEl = document.createElement("div");
    errEl.innerHTML = `❌ Error: ${err.message}<br><small style="color:rgba(255,255,255,0.4)">Intenta de nuevo en unos segundos</small>`;
    errEl.style.color = "#ef4444";
    contentDiv.appendChild(errEl);
    setStatusError("Error de conexión");
  } finally {
    isGenerating = false;
    sendBtn.disabled = false;
    inputBox.disabled = false;
    inputBox.focus();
    setTimeout(() => setStatusOnline(), 3000);
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
sendBtn.addEventListener("click", () => sendMessage(inputBox.value.trim()));
imgGenBtn.addEventListener("click", generateImage);

// Focus inicial
inputBox.focus();
