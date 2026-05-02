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
const BACKEND_URL = "https://385fd47d-e4b4-4453-981e-7afca555f923-00-9lnnok86qrfn.picard.replit.dev/api/chat";

const messagesEl = document.getElementById("cai-messages");
const inputBox   = document.getElementById("cai-input");
const sendBtn    = document.getElementById("cai-send");
let chatHistory  = [{ role: "assistant", content: "¡Hola! Soy **ChocolatitoAI**. ¿En qué te puedo ayudar hoy?" }];

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
    const res  = await fetch(BACKEND_URL, {
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

/* ── Eventos ─────────────────────────────────────────────────────── */
inputBox.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
inputBox.addEventListener("input", () => {
  inputBox.style.height = "auto";
  inputBox.style.height = Math.min(inputBox.scrollHeight, 120) + "px";
});
sendBtn.addEventListener("click", sendMessage);
