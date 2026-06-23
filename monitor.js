/* Monitor de Precios IA — Lógica */
const API = "https://chocolatito-api-production.up.railway.app/api";
function getToken(){return localStorage.getItem("cw_token")}
function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),3000)}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

particlesJS("particles-js",{particles:{number:{value:40,density:{enable:true,value_area:900}},color:{value:["#33FFFF","#00c8c8"]},shape:{type:"circle"},opacity:{value:0.3},size:{value:2},line_linked:{enable:true,distance:130,color:"#33FFFF",opacity:0.08,width:1},move:{enable:true,speed:0.8}},interactivity:{detect_on:"canvas",events:{onhover:{enable:true,mode:"grab"},resize:true},modes:{grab:{distance:140,line_linked:{opacity:0.2}}}},retina_detect:true});

function getCredits(){try{return JSON.parse(localStorage.getItem("cw_user")||"{}").credits??0}catch{return 0}}
document.getElementById("pm-credits").textContent=getCredits();

function switchTab(tab){
  document.querySelectorAll(".pm-tab").forEach(t=>t.classList.remove("active"));
  document.querySelectorAll(".pm-tab-content").forEach(c=>c.classList.remove("active"));
  document.querySelector(`.pm-tab[data-tab="${tab}"]`).classList.add("active");
  document.getElementById(`tab-${tab}`).classList.add("active");
  if(tab==="dashboard")loadDashboard();
  if(tab==="rubros")loadRubros();
  if(tab==="products"){loadFilterCats();loadProducts()}
  if(tab==="analysis"){loadAnalysisCats()}
}

// ─── DASHBOARD ────────────────────────────────────────────────────
async function loadDashboard(){
  try{
    const res=await fetch(`${API}/prices/dashboard`,{headers:{Authorization:"Bearer "+getToken()}});
    if(!res.ok)return;
    const d=await res.json();
    const s=d.stats||{};
    document.getElementById("stat-rubros").textContent=s.total_categories||0;
    document.getElementById("stat-products").textContent=s.total_products||0;
    document.getElementById("stat-discounts").textContent=s.total_discounts||0;
    document.getElementById("stat-alerts").textContent=s.unread_alerts||0;
    const badge=document.getElementById("alert-badge");
    if(s.unread_alerts>0){badge.style.display="flex";badge.textContent=s.unread_alerts}

    // Descuentos
    const dg=document.getElementById("discount-grid");
    if(d.topDiscounts&&d.topDiscounts.length>0){
      dg.innerHTML=d.topDiscounts.map(p=>`
        <div class="pm-discount-card" onclick="openProduct(${p.id})">
          <div class="pm-dc-name">${esc(p.name)}</div>
          <div class="pm-dc-prices">
            <span class="pm-dc-current">S/ ${(p.current_price||0).toFixed(2)}</span>
            <span class="pm-dc-previous">S/ ${(p.previous_price||0).toFixed(2)}</span>
            <span class="pm-dc-drop">-${p.drop_percent||0}%</span>
          </div>
        </div>`).join("");
    }else{dg.innerHTML='<p class="pm-empty">Escanea un rubro para ver descuentos</p>'}

    // Rubros mini
    const rg=document.getElementById("rubros-mini-grid");
    if(d.categories&&d.categories.length>0){
      rg.innerHTML=d.categories.map(c=>`
        <div class="pm-rubro-card">
          <div class="pm-rc-header"><span class="pm-rc-name">${esc(c.name)}</span><span class="pm-rc-status">${c.status}</span></div>
          <div class="pm-rc-stats">
            <div class="pm-rc-stat"><div class="pm-rc-stat-val">${c.product_count||0}</div><div class="pm-rc-stat-lbl">Productos</div></div>
            <div class="pm-rc-stat"><div class="pm-rc-stat-val">S/ ${c.min_price?c.min_price.toFixed(0):"-"}</div><div class="pm-rc-stat-lbl">Mín</div></div>
            <div class="pm-rc-stat"><div class="pm-rc-stat-val">${c.discount_count||0}</div><div class="pm-rc-stat-lbl">Descuentos</div></div>
          </div>
        </div>`).join("");
    }
  }catch(e){console.error(e)}
}

// ─── RUBROS ───────────────────────────────────────────────────────
function showRubroForm(){document.getElementById("rubro-form").style.display="block"}
function hideRubroForm(){document.getElementById("rubro-form").style.display="none"}

async function createRubro(){
  const name=document.getElementById("rubro-name").value.trim();
  const query=document.getElementById("rubro-query").value.trim();
  const threshold=parseInt(document.getElementById("rubro-threshold").value)||20;
  if(!name||!query){toast("Completa todos los campos");return}

  try{
    const res=await fetch(`${API}/prices/categories`,{
      method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+getToken()},
      body:JSON.stringify({name,search_query:query,alert_threshold_percent:threshold})
    });
    const data=await res.json();
    if(!res.ok){toast(data.error);return}
    hideRubroForm();
    toast("Rubro creado. Iniciando escaneo...");
    // Iniciar escaneo
    await fetch(`${API}/prices/categories/${data.category.id}/scan`,{method:"POST",headers:{Authorization:"Bearer "+getToken()}});
    loadRubros();
    setTimeout(()=>loadDashboard(),3000);
  }catch(e){toast("Error: "+e.message)}
}

async function loadRubros(){
  try{
    const res=await fetch(`${API}/prices/categories`,{headers:{Authorization:"Bearer "+getToken()}});
    if(!res.ok)return;
    const d=await res.json();
    const grid=document.getElementById("rubros-full-grid");
    if(d.categories.length===0){grid.innerHTML='<p class="pm-empty">No hay rubros. Crea uno para empezar a monitorear precios.</p>';return}
    grid.innerHTML=d.categories.map(c=>`
      <div class="pm-rubro-card">
        <div class="pm-rc-header"><span class="pm-rc-name">${esc(c.name)}</span><span class="pm-rc-status">${c.status}</span></div>
        <div style="font-size:0.78rem;color:rgba(255,255,255,0.4);margin-bottom:8px">Búsqueda: "${esc(c.search_query)}"</div>
        <div class="pm-rc-actions">
          <button class="pm-rc-btn scan" onclick="scanRubro(${c.id})"><i class="fas fa-sync"></i> Escanear</button>
          <button class="pm-rc-btn del" onclick="deleteRubro(${c.id})"><i class="fas fa-trash"></i></button>
        </div>
        <div style="font-size:0.72rem;color:rgba(255,255,255,0.3);margin-top:8px">Último escaneo: ${c.last_scraped_at?new Date(c.last_scraped_at).toLocaleString("es-PE"):"Nunca"}</div>
      </div>`).join("");
  }catch(e){console.error(e)}
}

async function scanRubro(id){
  toast("Escaneando... (gasta 5 créditos)");
  try{
    const res=await fetch(`${API}/prices/categories/${id}/scan`,{method:"POST",headers:{Authorization:"Bearer "+getToken()}});
    const data=await res.json();
    if(!res.ok){toast(data.error);return}
    toast("Escaneo iniciado. Vuelve en 30s para ver resultados.");
    setTimeout(()=>loadRubros(),3000);
    setTimeout(()=>loadDashboard(),10000);
  }catch(e){toast("Error: "+e.message)}
}

async function deleteRubro(id){
  if(!confirm("¿Eliminar este rubro y todos sus productos?"))return;
  await fetch(`${API}/prices/categories/${id}`,{method:"DELETE",headers:{Authorization:"Bearer "+getToken()}});
  loadRubros();
}

// ─── PRODUCTS ─────────────────────────────────────────────────────
async function loadFilterCats(){
  const res=await fetch(`${API}/prices/categories`,{headers:{Authorization:"Bearer "+getToken()}});
  if(!res.ok)return;
  const d=await res.json();
  const sel=document.getElementById("filter-cat");
  sel.innerHTML='<option value="">Todos los rubros</option>'+d.categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
}

async function loadProducts(){
  const cat=document.getElementById("filter-cat").value;
  const sort=document.getElementById("filter-sort").value;
  const url=`${API}/prices/products?sort=${sort}&limit=60${cat?"&category_id="+cat:""}`;
  const res=await fetch(url,{headers:{Authorization:"Bearer "+getToken()}});
  if(!res.ok)return;
  const d=await res.json();
  const grid=document.getElementById("products-grid");
  if(d.products.length===0){grid.innerHTML='<p class="pm-empty">No hay productos. Escanea un rubro primero.</p>';return}
  grid.innerHTML=d.products.map(p=>`
    <div class="pm-product-card" onclick="openProduct(${p.id})">
      <div class="pm-pc-img">${p.image_url?`<img src="${esc(p.image_url)}" loading="lazy">`:'<i class="fas fa-box" style="font-size:2rem;color:rgba(255,255,255,0.2)"></i>'}</div>
      <div class="pm-pc-body">
        <div class="pm-pc-name">${esc(p.name)}</div>
        <div class="pm-pc-price">S/ ${(p.current_price||0).toFixed(2)}</div>
        ${p.previous_price&&p.previous_price>p.current_price?`<div class="pm-pc-prev">S/ ${p.previous_price.toFixed(2)}</div><span class="pm-pc-badge drop">-${Math.round((1-p.current_price/p.previous_price)*100)}%</span>`:''}
        <div class="pm-pc-meta">
          <span class="pm-pc-rating">${p.rating?'⭐ '+p.rating:''}</span>
          <span class="pm-pc-store">${esc(p.store||'')}</span>
        </div>
      </div>
    </div>`).join("");
}

// ─── MODAL: Producto detalle + gráfico + predicción ──────────────
async function openProduct(id){
  document.getElementById("product-modal").classList.add("open");
  document.getElementById("modal-body").innerHTML='<p class="pm-empty">Cargando...</p>';

  const res=await fetch(`${API}/prices/products/${id}/history`,{headers:{Authorization:"Bearer "+getToken()}});
  const d=await res.json();
  const hist=d.history||[];

  // Gráfico simple con barras CSS
  let chartHtml="";
  if(hist.length>0){
    const maxPrice=Math.max(...hist.map(h=>h.price));
    const minPrice=Math.min(...hist.map(h=>h.price));
    chartHtml=`<div class="pm-chart-container">
      <h4 style="color:#33FFFF;margin:0 0 12px;font-size:0.9rem">Historial de Precio (${hist.length} registros)</h4>
      <div class="pm-chart-bar">
        ${hist.map(h=>`<div class="pm-chart-bar-item" style="height:${((h.price-minPrice)/(maxPrice-minPrice||1))*80+20}%;min-height:8px" title="S/ ${h.price.toFixed(2)} - ${new Date(h.scraped_at).toLocaleDateString("es-PE")}"></div>`).join("")}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:rgba(255,255,255,0.3);margin-top:6px">
        <span>Mín: S/ ${minPrice.toFixed(2)}</span><span>Máx: S/ ${maxPrice.toFixed(2)}</span>
      </div>
    </div>`;
  }

  document.getElementById("modal-body").innerHTML=`
    ${chartHtml}
    <div class="pm-prediction-card">
      <h4><i class="fas fa-brain"></i> Predicción IA</h4>
      <button class="pm-btn-primary" onclick="predictProduct(${id})" style="margin-bottom:12px">Predecir precio (gasta créditos)</button>
      <div id="prediction-result" style="display:none"></div>
    </div>
  `;
}

async function predictProduct(id){
  document.getElementById("prediction-result").innerHTML='<p class="pm-empty">Analizando con IA...</p>';
  document.getElementById("prediction-result").style.display="block";
  try{
    const res=await fetch(`${API}/prices/products/${id}/predict`,{method:"POST",headers:{Authorization:"Bearer "+getToken()}});
    const data=await res.json();
    if(!res.ok){document.getElementById("prediction-result").innerHTML=`<p style="color:#ef4444">${data.error}</p>`;return}
    const p=data.prediction||{};
    const color=p.prediction==="subira"?"red":p.prediction==="bajara"?"green":"cyan";
    document.getElementById("prediction-result").innerHTML=`
      <div class="pm-analysis-row"><span class="pm-analysis-label">Predicción</span><span class="pm-analysis-val ${color}">${esc(p.prediction||"estable")}</span></div>
      <div class="pm-analysis-row"><span class="pm-analysis-label">Confianza</span><span class="pm-analysis-val">${p.confidence||0}%</span></div>
      <div class="pm-analysis-row"><span class="pm-analysis-label">Rango estimado</span><span class="pm-analysis-val">${esc(p.predicted_price_range||"N/A")}</span></div>
      <div class="pm-analysis-row"><span class="pm-analysis-label">Recomendación</span><span class="pm-analysis-val ${p.recommendation==="comprar_ahora"?"green":"orange"}">${esc(p.recommendation||"esperar")}</span></div>
      <div class="pm-analysis-section"><p style="font-size:0.85rem;color:rgba(255,255,255,0.7)">${esc(p.reasoning||"Sin análisis")}</p></div>
    `;
  }catch(e){document.getElementById("prediction-result").innerHTML=`<p style="color:#ef4444">Error: ${e.message}</p>`}
}

function closeModal(){document.getElementById("product-modal").classList.remove("open")}

// ─── ANALYSIS ─────────────────────────────────────────────────────
async function loadAnalysisCats(){
  const res=await fetch(`${API}/prices/categories`,{headers:{Authorization:"Bearer "+getToken()}});
  if(!res.ok)return;
  const d=await res.json();
  const sel=document.getElementById("analysis-cat");
  sel.innerHTML='<option value="">Selecciona un rubro</option>'+d.categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
}

async function loadAnalysis(){
  const catId=document.getElementById("analysis-cat").value;
  const content=document.getElementById("analysis-content");
  if(!catId){content.innerHTML='<p class="pm-empty">Selecciona un rubro</p>';return}
  content.innerHTML='<p class="pm-empty">Cargando análisis de IA...</p>';
  try{
    const res=await fetch(`${API}/prices/analysis/${catId}`,{headers:{Authorization:"Bearer "+getToken()}});
    const d=await res.json();
    if(!d.analysis){content.innerHTML='<p class="pm-empty">No hay análisis aún. Escanea este rubro para generar análisis IA.</p>';return}
    const a=typeof d.analysis.result==="string"?JSON.parse(d.analysis.result):d.analysis.result;
    const trendColor=a.trend==="bajando"?"green":a.trend==="subiendo"?"red":"cyan";
    content.innerHTML=`
      <div class="pm-analysis-card">
        <h3><i class="fas fa-brain"></i> Análisis de IA — ${new Date(d.analysis.created_at).toLocaleString("es-PE")}</h3>
        <div class="pm-analysis-row"><span class="pm-analysis-label">Tendencia</span><span class="pm-analysis-val ${trendColor}">${esc(a.trend||"estable")}</span></div>
        <div class="pm-analysis-row"><span class="pm-analysis-label">Mejor momento para comprar</span><span class="pm-analysis-val ${a.best_moment_to_buy==="ahora"?"green":"orange"}">${esc(a.best_moment_to_buy||"ahora")}</span></div>
        <div class="pm-analysis-section"><h4>Razonamiento de tendencia</h4><p style="font-size:0.85rem;color:rgba(255,255,255,0.7)">${esc(a.trend_reasoning||"")}</p></div>
        <div class="pm-analysis-section"><h4>Predicción de precios</h4><p style="font-size:0.85rem;color:rgba(255,255,255,0.7)">${esc(a.price_prediction||"")}</p></div>
        <div class="pm-analysis-section"><h4>Resumen del mercado</h4><p style="font-size:0.85rem;color:rgba(255,255,255,0.7)">${esc(a.market_summary||"")}</p></div>
        ${a.opportunities&&a.opportunities.length>0?`<div class="pm-analysis-section"><h4>🔥 Oportunidades de compra</h4><ul class="pm-analysis-list">${a.opportunities.map(o=>`<li>${esc(o)}</li>`).join("")}</ul></div>`:""}
        ${a.risk_products&&a.risk_products.length>0?`<div class="pm-analysis-section"><h4>⚠️ Productos en riesgo (podrían subir)</h4><ul class="pm-analysis-list">${a.risk_products.map(o=>`<li>${esc(o)}</li>`).join("")}</ul></div>`:""}
      </div>`;
  }catch(e){content.innerHTML=`<p style="color:#ef4444">Error: ${e.message}</p>`}
}

// ─── ALERTAS ──────────────────────────────────────────────────────
async function loadAlerts(){
  document.getElementById("alerts-modal").classList.add("open");
  document.getElementById("alerts-body").innerHTML='<p class="pm-empty">Cargando...</p>';
  try{
    const res=await fetch(`${API}/prices/alerts`,{headers:{Authorization:"Bearer "+getToken()}});
    const d=await res.json();
    const body=document.getElementById("alerts-body");
    if(d.alerts.length===0){body.innerHTML='<p class="pm-empty">No hay alertas. Escanea rubros para generar alertas automáticas.</p>';return}
    body.innerHTML=d.alerts.map(a=>`
      <div class="pm-alert-item ${a.read?"":"unread"}" onclick="markAlertRead(${a.id})">
        <div class="pm-ai-icon">${a.type==="price_drop"?"📉":a.type==="trend"?"📊":"🔔"}</div>
        <div><div class="pm-ai-msg">${esc(a.message)}</div><div class="pm-ai-time">${new Date(a.created_at).toLocaleString("es-PE")}</div></div>
      </div>`).join("");
  }catch(e){document.getElementById("alerts-body").innerHTML=`<p style="color:#ef4444">Error: ${e.message}</p>`}
}

async function markAlertRead(id){
  await fetch(`${API}/prices/alerts/${id}/read`,{method:"PATCH",headers:{Authorization:"Bearer "+getToken()}});
  loadAlerts();
  document.getElementById("alert-badge").style.display="none";
}
function closeAlerts(){document.getElementById("alerts-modal").classList.remove("open")}

// Init
loadDashboard();
