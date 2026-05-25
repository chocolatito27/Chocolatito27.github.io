/* ══════════════════════════════════════════════════════════════════
   MENÚ LATERAL
══════════════════════════════════════════════════════════════════ */
function toggleMenu() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const isOpen  = sidebar.style.left === '0px';
  sidebar.style.left = isOpen ? '-250px' : '0px';
  overlay.classList.toggle('open', !isOpen);
}

/* ══════════════════════════════════════════════════════════════════
   PARTÍCULAS
══════════════════════════════════════════════════════════════════ */
particlesJS("particles-js", {
  particles: {
    number:      { value: 80, density: { enable: true, value_area: 800 } },
    color:       { value: ["#FF0000","#00FF00","#0000FF","#FFFF00","#00FFFF","#FF00FF"] },
    shape:       { type: "circle", stroke: { width: 0, color: "#000000" } },
    opacity:     { value: 0.5, random: false },
    size:        { value: 3, random: true },
    line_linked: { enable: true, distance: 150, color: "#ffffff", opacity: 0.4, width: 1 },
    move:        { enable: true, speed: 6, out_mode: "bounce", bounce: true }
  },
  interactivity: {
    detect_on: "canvas",
    events: {
      onhover: { enable: true, mode: "repulse" },
      onclick:  { enable: true, mode: "push" },
      resize:   true
    },
    modes: {
      repulse: { distance: 200, duration: 0.4 },
      push:    { particles_nb: 4 }
    }
  },
  retina_detect: true
});

/* ══════════════════════════════════════════════════════════════════
   CHAT
══════════════════════════════════════════════════════════════════ */
const API_BASE   = "https://chocolatito-api-production.up.railway.app/api";
const CHAT_URL   = API_BASE + "/chat";
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

let chatHistory  = [{ role: "assistant", content: "¡Hola! Soy **ChocolatitoAI**. ¿En qué te puedo ayudar hoy?\n\n🎨 También puedo **generar imágenes con IA**. Cuesta **5 créditos** por imagen. Haz clic en el botón de imagen (🖼️) para empezar." }];

function getToken() { return localStorage.getItem("cw_token"); }

/* ── Normaliza LaTeX ──────────────────────────────────────────────── */
function normalizeMath(text) {
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, l) => `\n$$\n${l.trim()}\n$$\n`);
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, l) => `$${l.trim()}$`);
  return text;
}

/* ── Renderiza Markdown + Math + Código ──────────────────────────── */
function renderContent(rawText) {
  const text = normalizeMath(rawText);
  const mathBlocks = [];

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

  marked.setOptions({ breaks: true, gfm: true });
  let html = marked.parse(safe);

  for (const blk of mathBlocks) {
    const el = document.createElement(blk.display ? "div" : "span");
    try { katex.render(blk.latex.trim(), el, { displayMode: blk.display, throwOnError: false }); }
    catch { el.textContent = blk.latex; }
    html = html.replace(blk.id, el.outerHTML);
  }

  const container = document.createElement("div");
  container.innerHTML = html;

  container.querySelectorAll("pre code").forEach(code => {
    hljs.highlightElement(code);
    const pre = code.parentElement;
    pre.style.position = "relative";
    const btn = document.createElement("button");
    btn.className = "copy-btn";
    btn.textContent = "Copiar";
    btn.onclick = () => {
      navigator.clipboard.writeText(code.innerText).then(() => {
        btn.textContent = "Copiado ✓";
        btn.classList.add("copied");
        setTimeout(() => { btn.textContent = "Copiar"; btn.classList.remove("copied"); }, 2000);
      }).catch(() => {});
    };
    pre.appendChild(btn);
  });

  return container;
}

/* ── Agregar burbuja ─────────────────────────────────────────────── */
function addBubble(role, content, isTyping = false) {
  const row     = document.createElement("div");
  row.className = `bubble-row ${role}`;
  const bubble  = document.createElement("div");
  bubble.className = `bubble ${role}${isTyping ? " typing" : ""}`;
  if (isTyping) {
    bubble.innerHTML = "<span></span><span></span><span></span>";
  } else {
    bubble.appendChild(renderContent(content));
  }
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return row;
}

/* ── Agregar burbuja con imagen ──────────────────────────────────── */
function addImageBubble(role, prompt, imageUrl, creditsLeft) {
  const row    = document.createElement("div");
  row.className = `bubble-row ${role}`;
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role} image-bubble`;

  const label = document.createElement("div");
  label.className = "img-gen-label";
  label.textContent = `🎨 Imagen generada: "${prompt}"`;
  bubble.appendChild(label);

  const img = document.createElement("img");
  img.className = "ai-generated-img";
  img.src = imageUrl;
  img.alt = prompt;
  img.loading = "lazy";
  img.onerror = () => { img.style.display = "none"; label.textContent = "❌ Error cargando la imagen. Intenta de nuevo."; };
  bubble.appendChild(img);

  const meta = document.createElement("div");
  meta.className = "img-gen-meta";
  meta.innerHTML = `Costó <strong>${IMAGE_COST}</strong> créditos · Quedan <strong>${creditsLeft}</strong>`;
  bubble.appendChild(meta);

  const dlBtn = document.createElement("a");
  dlBtn.className = "img-download-btn";
  dlBtn.href = imageUrl;
  dlBtn.target = "_blank";
  dlBtn.download = "chocolatito-ai-image.png";
  dlBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Descargar';
  bubble.appendChild(dlBtn);

  row.appendChild(bubble);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return row;
}

/* ── Enviar mensaje ──────────────────────────────────────────────── */
async function sendMessage() {
  const text = inputBox.value.trim();
  if (!text || sendBtn.disabled) return;

  chatHistory.push({ role: "user", content: text });
  addBubble("user", text);
  inputBox.value = "";
  inputBox.style.height = "auto";
  sendBtn.disabled = true;
  inputBox.disabled = true;

  const typingRow = addBubble("assistant", "", true);

  try {
    const res  = await fetch(CHAT_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ messages: chatHistory })
    });
    const data  = await res.json();
    const reply = data.choices?.[0]?.message?.content ?? "Sin respuesta.";
    chatHistory.push({ role: "assistant", content: reply });
    typingRow.remove();
    addBubble("assistant", reply);
  } catch {
    typingRow.remove();
    addBubble("assistant", "No se pudo conectar con el servidor. Intenta de nuevo.");
  } finally {
    sendBtn.disabled  = false;
    inputBox.disabled = false;
    inputBox.focus();
  }
}

/* ══════════════════════════════════════════════════════════════════
   IMAGE GENERATION
══════════════════════════════════════════════════════════════════ */

/* ── Modal ──────────────────────────────────────────────────────── */
imgBtn.addEventListener("click", () => {
  imgInput.value = "";
  imgModal.classList.add("open");
  setTimeout(() => imgInput.focus(), 100);
});

imgCancel.addEventListener("click", () => {
  imgModal.classList.remove("open");
});

imgModal.addEventListener("click", (e) => {
  if (e.target === imgModal) imgModal.classList.remove("open");
});

imgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generateImage(); }
  if (e.key === "Escape") imgModal.classList.remove("open");
});

/* ── Generate ───────────────────────────────────────────────────── */
async function generateImage() {
  const prompt = imgInput.value.trim();
  if (!prompt) return;

  const token = getToken();
  if (!token) { alert("No hay sesión activa"); return; }

  imgModal.classList.remove("open");

  // Show user prompt as bubble
  addBubble("user", `🖼️ Generar imagen: ${prompt}`);

  // Loading bubble
  const loadingRow = addBubble("assistant", "", true);

  try {
    const res = await fetch(IMAGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ prompt })
    });

    const data = await res.json();
    loadingRow.remove();

    if (!res.ok) {
      addBubble("assistant", `❌ ${data.error || "Error generando imagen"}`);
      return;
    }

    addImageBubble("assistant", data.prompt, data.imageUrl, data.creditsRemaining);

    // Update cached user credits in sidebar
    const cwUser = JSON.parse(localStorage.getItem("cw_user") || "{}");
    if (cwUser && data.creditsRemaining !== undefined) {
      cwUser.credits = data.creditsRemaining;
      localStorage.setItem("cw_user", JSON.stringify(cwUser));
      const creditSpan = document.querySelector("#cw-sidebar-user-wrap span[style*='4ade80']");
      if (creditSpan) creditSpan.textContent = data.creditsRemaining;
    }

  } catch (err) {
    loadingRow.remove();
    addBubble("assistant", "❌ No se pudo conectar con el servidor de imágenes.");
  }
}

imgGenBtn.addEventListener("click", generateImage);

/* ── Eventos ─────────────────────────────────────────────────────── */
inputBox.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
inputBox.addEventListener("input", () => {
  inputBox.style.height = "auto";
  inputBox.style.height = Math.min(inputBox.scrollHeight, 120) + "px";
});
sendBtn.addEventListener("click", sendMessage);
