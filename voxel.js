// ════════════════════════════════════════════════════════
// voxel.js — VoxelWorld: lobby + survival + PvP
// ════════════════════════════════════════════════════════

// ── CONFIG ──────────────────────────────────────────────
const WS_URL='wss://chocolatito-api-production.up.railway.app/api/game/ws';
const API_BASE='https://chocolatito-api-production.up.railway.app';
const W=64,H=64,D=64;
// Block type → resource key needed to place it (null = can't place)
const BLOCK_COST=['','dirt','dirt','stone','wood',null,'sand',null,null];
const GRAV=-22,JUMP=8.5,SPEED=4.8,REACH=6.5,PH=1.8,PW=0.3,STEP_H=0.55;
const FOG_DISTS=[18,32,48,68,90];
const ATTACK_RANGE=2.5;
let gsens=0.0025,gfog=3;

// ── SESSION ──────────────────────────────────────────────
const SESSION={username:'Jugador',id:'????????',credits:0};
try{const s=JSON.parse(localStorage.getItem('cw_user')||'{}');
  if(s.username)SESSION.username=s.username;
  if(s.id)SESSION.id=s.id;
  if(s.credits)SESSION.credits=parseInt(s.credits)||0;
}catch(_){}

// ── FRIENDS ─────────────────────────────────────────────
const getFriends=()=>{try{return JSON.parse(localStorage.getItem('vw_friends')||'[]');}catch{return[];}};
const saveFriends=f=>localStorage.setItem('vw_friends',JSON.stringify(f));

// ── OUTFIT ──────────────────────────────────────────────
const DEFAULT_OUTFIT={shirtColor:0x3a6abf,pantsColor:0x1e2e5c,shoesColor:0x1a1a1a,hairColor:0x3d2b1f,skinColor:0xffcc99,name:'Conjunto Común',rarity:'common'};
let currentOutfit={...DEFAULT_OUTFIT};

// ── CAPES ────────────────────────────────────────────────
const CAPES=[
  {id:'crimson', name:'Escarlata',  color:0xc0392b, lining:0xff6b6b, hex:'#c0392b', lin:'#ff6b6b', price:5},
  {id:'royal',   name:'Real',       color:0x2471a3, lining:0x74c0fc, hex:'#2471a3', lin:'#74c0fc', price:5},
  {id:'emerald', name:'Esmeralda',  color:0x1e8449, lining:0x55efc4, hex:'#1e8449', lin:'#55efc4', price:5},
  {id:'gold',    name:'Dorada',     color:0xc9a000, lining:0xffd700, hex:'#c9a000', lin:'#ffd700', price:5},
  {id:'violet',  name:'Violeta',    color:0x7d3c98, lining:0xd7a2f5, hex:'#7d3c98', lin:'#d7a2f5', price:5},
  {id:'ocean',   name:'Océano',     color:0x0d6efd, lining:0x90e0ef, hex:'#0d6efd', lin:'#90e0ef', price:5},
];
const getCapeData=()=>{try{return JSON.parse(localStorage.getItem('vw_cape')||'null');}catch{return null;}};
const saveCapeData=d=>localStorage.setItem('vw_cape',JSON.stringify(d));
function getEquippedCape(){const d=getCapeData();return d?CAPES.find(c=>c.id===d.equipped)||null:null;}
function getPlayerLevel(credits){
  if(credits>=1000)return{lv:5,name:'Leyenda',color:'#ffd700'};
  if(credits>=500) return{lv:4,name:'Élite',  color:'#a855f7'};
  if(credits>=200) return{lv:3,name:'Pro',     color:'#3b82f6'};
  if(credits>=50)  return{lv:2,name:'Jugador', color:'#22c55e'};
  return               {lv:1,name:'Novato',    color:'rgba(255,255,255,0.4)'};
}

// ── GAME MODE ───────────────────────────────────────────
let gameMode='pvp';

// ════════════════════════════════════════════════════════
// BLOCK DATA
// ════════════════════════════════════════════════════════
const BNAME=['','Pasto','Tierra','Piedra','Madera','Hojas','Arena','Cristal','Cofre'];
const HCOL =['','#4CAF50','#8B6914','#707070','#6B4226','#2D7D32','#D4B483','#ADD8E6','#D4A017'];
const BREAK_DUR=[0,0.75,0.5,2.0,1.2,0.25,0.55,0.45,0.9];
const BCOL=[null,
  // 1 Grass — vivid emerald top, rich earthy sides
  {t:[0.22,0.82,0.15],s:[0.48,0.32,0.09],b:[0.42,0.28,0.07]},
  // 2 Dirt — rich warm brown with depth
  {t:[0.60,0.44,0.18],s:[0.55,0.39,0.14],b:[0.50,0.35,0.12]},
  // 3 Stone — pro cobblestone with contrast
  {t:[0.68,0.66,0.64],s:[0.58,0.56,0.54],b:[0.48,0.46,0.44]},
  // 4 Wood — warm amber with rich grain
  {t:[0.66,0.50,0.26],s:[0.48,0.34,0.14],b:[0.58,0.42,0.19]},
  // 5 Leaves — lush vibrant forest canopy
  {t:[0.18,0.72,0.15],s:[0.15,0.64,0.12],b:[0.12,0.55,0.10]},
  // 6 Sandstone — warm golden beige pro
  {t:[0.93,0.86,0.68],s:[0.88,0.82,0.64],b:[0.80,0.73,0.54]},
  // 7 Glass — crystal clear blue tint
  {t:[0.65,0.85,0.96],s:[0.62,0.82,0.94],b:[0.58,0.78,0.90]},
  // 8 Chest — golden oak treasure
  {t:[0.88,0.70,0.24],s:[0.66,0.46,0.16],b:[0.56,0.36,0.10]},
];
function bCol(type,face){const b=BCOL[type];if(!b)return[1,1,1];return face==='t'?b.t:face==='b'?b.b:b.s;}

// ════════════════════════════════════════════════════════
// RESOURCES & WEAPONS
// ════════════════════════════════════════════════════════

// What each block drops (blockType → [resourceKey, amount, chance])
const DROPS=[
  null,                       // 0 air
  ['dirt',2,1.0],             // 1 grass → 2 dirt
  ['dirt',1,1.0],             // 2 dirt  → 1 dirt
  ['stone',1,1.0],            // 3 stone → 1 stone
  ['wood',1,1.0],             // 4 wood  → 1 wood
  ['apple',1,0.2],            // 5 leaves → 20% apple
  ['sand',1,1.0],             // 6 sand  → 1 sand
  null,                       // 7 glass → nothing
  null,                       // 8 chest → handled by openChestLoot()
];

// Weapons / tools
const WEAPONS={
  fist:      {name:'Puños',          icon:'✊',dmg:1, cool:0.80, bonus:[], color:'#ffcc99',tip:'Ataque básico — ~20 golpes'},
  wood_sword:{name:'Espada Madera',  icon:'🗡',dmg:2, cool:0.65, bonus:[], color:'#8B6914',tip:'2 ❤ daño — ~10 golpes',recipe:{wood:5}},
  stone_sword:{name:'Espada Piedra', icon:'⚔',dmg:3, cool:0.55, bonus:[], color:'#aaaaaa',tip:'3 ❤ daño — ~7 golpes',recipe:{stone:5}},
  wood_axe:  {name:'Hacha Madera',   icon:'🪓',dmg:1, cool:0.70, bonus:[4,5],color:'#8B6914',tip:'Corta madera 5× más rápido',recipe:{wood:4}},
  stone_pick:{name:'Pico Piedra',    icon:'⛏',dmg:1, cool:0.70, bonus:[3,7],color:'#aaaaaa',tip:'Rompe piedra 5× más rápido',recipe:{stone:4}},
  wood_axe2: {name:'Hacha Piedra',   icon:'🪓',dmg:2, cool:0.65, bonus:[4,5],color:'#aaaaaa',tip:'Corta madera 8× más rápido',recipe:{wood:3,stone:3}},
};

// Player inventory
const inv={dirt:0,stone:0,wood:0,sand:0,apple:0};
let equippedWeapon='fist';
let attackTimer=0;
let myKills=0;
let mySpawnX=32,mySpawnZ=32;
let immunityTimer=0;

// Hunger (survival only)
let hunger=20,hungerTimer=0,starveTimer=0;

function collectResource(blockType){
  if(blockType===8){openChestLoot();return;}
  const drop=DROPS[blockType];
  if(!drop) return;
  const[key,amt,chance]=drop;
  if(Math.random()>chance) return;
  inv[key]=(inv[key]||0)+amt;
  showCollect(key,amt);
  updateResourceHUD();
  updateHotbarCounts();
}
const CHEST_POOLS=[
  [{type:'wood',  amt:6},{type:'stone',amt:4}],
  [{type:'stone', amt:6},{type:'apple',amt:3}],
  [{type:'wood',  amt:8},{type:'apple',amt:2}],
  [{type:'stone', amt:5},{type:'wood', amt:3},{type:'apple',amt:2}],
  [{type:'weapon',key:'wood_sword'},{type:'apple',amt:3}],
  [{type:'weapon',key:'stone_sword'},{type:'stone',amt:3}],
  [{type:'weapon',key:'wood_axe'},{type:'wood',amt:5}],
  [{type:'stone', amt:8},{type:'wood', amt:5}],
];
function openChestLoot(){
  const pool=CHEST_POOLS[Math.floor(Math.random()*CHEST_POOLS.length)];
  const el=document.getElementById('chest-popup');
  const list=document.getElementById('chest-items');
  if(!el||!list) return;
  const icons={dirt:'🟫',stone:'⬜',wood:'🪵',sand:'🟡',apple:'🍎'};
  list.innerHTML='';
  pool.forEach(item=>{
    const div=document.createElement('div');
    div.className='chest-item';
    if(item.type==='weapon'){
      const w=WEAPONS[item.key];
      div.innerHTML=`${w.icon} <b>${w.name}</b>`;
      equippedWeapon=item.key;updateWeaponSlot();
    } else {
      inv[item.type]=(inv[item.type]||0)+item.amt;
      div.innerHTML=`${icons[item.type]||'📦'} <b>+${item.amt} ${item.type==='apple'?'Manzana':''}${item.type==='wood'?'Madera':''}${item.type==='stone'?'Piedra':''}${item.type==='dirt'?'Tierra':''}</b>`;
    }
    list.appendChild(div);
  });
  updateResourceHUD();updateHotbarCounts();
  el.style.display='flex';
  document.exitPointerLock();
}
function closeChestPopup(){
  const el=document.getElementById('chest-popup');if(el)el.style.display='none';
  document.getElementById('canvas').requestPointerLock();
}

let collectMsgTimer=null;
function showCollect(key,amt){
  const el=document.getElementById('collect-msg');
  if(!el) return;
  const icons={dirt:'🟫',stone:'⬜',wood:'🪵',sand:'🟡',apple:'🍎'};
  const names={dirt:'Tierra',stone:'Piedra',wood:'Madera',sand:'Arena',apple:'Manzana'};
  el.textContent=`+${amt} ${icons[key]||''} ${names[key]||key}`;
  el.style.opacity='1';el.style.transform='translateY(0)';
  clearTimeout(collectMsgTimer);
  collectMsgTimer=setTimeout(()=>{el.style.opacity='0';el.style.transform='translateY(-10px)';},1400);
}

function updateResourceHUD(){
  const r=document.getElementById('res-hud');if(!r)return;
  r.innerHTML=`🪵${inv.wood} ⬜${inv.stone} 🟫${inv.dirt} 🟡${inv.sand} 🍎${inv.apple}`;
  // update inv-credits in lobby too
  const ic=document.getElementById('inv-credits');if(ic)ic.textContent=SESSION.credits.toLocaleString();
}

function updateHunger(dt){
  if(gameMode!=='survival') return;
  const moving=keys['KeyW']||keys['KeyS']||keys['KeyA']||keys['KeyD'];
  hungerTimer+=dt*(moving?1.4:1);
  const rate=20; // seconds per hunger point
  if(hungerTimer>=rate){hungerTimer-=rate;hunger=Math.max(0,hunger-1);updateHungerBar();}
  if(hunger<=0){starveTimer+=dt;if(starveTimer>=4){starveTimer=0;takeDamage(1);}}
  else starveTimer=0;
}
function updateHungerBar(){
  const hb=document.getElementById('hungerbar');if(!hb)return;
  hb.innerHTML='';
  for(let i=0;i<10;i++){
    const h=document.createElement('div');h.className='heart';
    h.textContent=i<Math.ceil(hunger/2)?'🍗':'🍖';hb.appendChild(h);
  }
}
function eatFood(){
  if(inv.apple<=0){addMsg('','🍎 No tienes manzanas',true);return;}
  if(hunger>=20){addMsg('','No tienes hambre',true);return;}
  inv.apple--;hunger=Math.min(20,hunger+4);
  updateHungerBar();updateResourceHUD();
  addMsg('','🍎 Comiste una manzana (+4 🍗)',true);
}

// ── Tool speed bonus ─────────────────────────────────────
function getBreakMult(blockType){
  const w=WEAPONS[equippedWeapon];
  if(w&&w.bonus&&w.bonus.includes(blockType)) return 0.2; // 5x faster
  return 1.0;
}

// ── Weapon display ───────────────────────────────────────
function updateWeaponSlot(){
  const el=document.getElementById('weapon-slot');if(!el)return;
  const w=WEAPONS[equippedWeapon];
  el.innerHTML=`<span style="font-size:1.4rem">${w.icon}</span><div style="font-size:0.55rem;color:rgba(255,255,255,0.6);margin-top:1px">${w.name.split(' ')[0]}</div>`;
}

// ════════════════════════════════════════════════════════
// BACKPACK OVERLAY
// ════════════════════════════════════════════════════════
let backpackOpen=false;
function openBackpack(){
  if(backpackOpen)return;
  backpackOpen=true;
  document.exitPointerLock();
  renderBackpack();
  document.getElementById('obackpack').style.display='flex';
}
function closeBackpack(){
  backpackOpen=false;
  document.getElementById('obackpack').style.display='none';
  if(gameOn)document.getElementById('canvas').requestPointerLock();
}
function renderBackpack(){
  const el=document.getElementById('bp-content');if(!el)return;
  const icons={dirt:'🟫',stone:'⬜',wood:'🪵',sand:'🟡',apple:'🍎'};
  const names={dirt:'Tierra',stone:'Piedra',wood:'Madera',sand:'Arena',apple:'Manzana'};
  el.innerHTML='';
  Object.keys(inv).forEach(k=>{
    const d=document.createElement('div');d.className='bp-item';
    d.innerHTML=`<div class="bp-icon">${icons[k]||'📦'}</div><div class="bp-name">${names[k]||k}</div><div class="bp-count">×${inv[k]}</div>`;
    el.appendChild(d);
  });
  // Weapons owned
  const we=document.getElementById('bp-weapons');if(!we)return;
  we.innerHTML='';
  Object.entries(WEAPONS).forEach(([key,w])=>{
    if(key==='fist') return;
    const owned=inv['__'+key]||false;
    if(!owned) return;
    const d=document.createElement('div');d.className='bp-item weapon-item'+(equippedWeapon===key?' equipped':'');
    d.innerHTML=`<div class="bp-icon">${w.icon}</div><div class="bp-name">${w.name}</div><div class="bp-count">${equippedWeapon===key?'✓ Equipada':''}</div>`;
    d.onclick=()=>{equippedWeapon=key;updateWeaponSlot();renderBackpack();addMsg('',`${w.icon} Equipaste: ${w.name}`,true);};
    we.appendChild(d);
  });
  // Fist always available
  const fd=document.createElement('div');fd.className='bp-item weapon-item'+(equippedWeapon==='fist'?' equipped':'');
  fd.innerHTML=`<div class="bp-icon">✊</div><div class="bp-name">Puños</div><div class="bp-count">${equippedWeapon==='fist'?'✓ Equipada':''}</div>`;
  fd.onclick=()=>{equippedWeapon='fist';updateWeaponSlot();renderBackpack();};
  we.prepend(fd);
}

// ════════════════════════════════════════════════════════
// CRAFTING OVERLAY
// ════════════════════════════════════════════════════════
let craftOpen=false;
function openCraft(){
  if(craftOpen)return;
  craftOpen=true;
  document.exitPointerLock();
  renderCraft();
  document.getElementById('ocraft').style.display='flex';
}
function closeCraft(){
  craftOpen=false;
  document.getElementById('ocraft').style.display='none';
  if(gameOn)document.getElementById('canvas').requestPointerLock();
}
function renderCraft(){
  const grid=document.getElementById('craft-grid');if(!grid)return;
  grid.innerHTML='';
  const icons={dirt:'🟫',stone:'⬜',wood:'🪵',sand:'🟡',apple:'🍎'};
  Object.entries(WEAPONS).forEach(([key,w])=>{
    if(!w.recipe)return;
    const owned=inv['__'+key]||false;
    const canCraft=!owned&&Object.entries(w.recipe).every(([r,n])=>inv[r]>=n);
    const d=document.createElement('div');
    d.className='craft-card'+(canCraft?' can-craft':'')+(owned?' owned':'');
    const reqs=Object.entries(w.recipe).map(([r,n])=>`${icons[r]||r}×${n}`).join(' ');
    d.innerHTML=`
      <div class="craft-icon">${w.icon}</div>
      <div class="craft-name">${w.name}</div>
      <div class="craft-tip">${w.tip}</div>
      <div class="craft-req">${reqs}</div>
      <button class="craft-btn ${canCraft?'active':''}" ${canCraft?'':'disabled'} onclick="doCraft('${key}')">
        ${owned?'✓ Fabricada':canCraft?'⚒ Fabricar':'Materiales insuficientes'}
      </button>`;
    grid.appendChild(d);
  });
  // Current resources
  const res=document.getElementById('craft-inv');if(res)
    res.innerHTML=`🪵${inv.wood} &nbsp;⬜${inv.stone} &nbsp;🟫${inv.dirt} &nbsp;🟡${inv.sand} &nbsp;🍎${inv.apple}`;
}
function doCraft(key){
  const w=WEAPONS[key];if(!w||!w.recipe)return;
  if(inv['__'+key]){addMsg('','Ya tienes esa arma',true);return;}
  const ok=Object.entries(w.recipe).every(([r,n])=>inv[r]>=n);
  if(!ok){addMsg('','No tienes suficientes materiales',true);return;}
  Object.entries(w.recipe).forEach(([r,n])=>inv[r]-=n);
  inv['__'+key]=true;
  equippedWeapon=key;
  updateWeaponSlot();updateResourceHUD();
  addMsg('',`${w.icon} ¡Fabricaste: ${w.name}!`,true);
  // Animate
  const el=document.getElementById('craft-success');if(el){el.textContent=`✓ ${w.name} lista!`;el.style.opacity='1';setTimeout(()=>el.style.opacity='0',2000);}
  renderCraft();renderBackpack();
}

// ════════════════════════════════════════════════════════
// WORLD
// ════════════════════════════════════════════════════════
const world=new Uint8Array(W*H*D);
const wi=(x,y,z)=>x+W*(y+H*z);
const gb=(x,y,z)=>{if(x<0||x>=W||y<0||y>=H||z<0||z>=D)return 1;return world[wi(x,y,z)];};
const sb=(x,y,z,t)=>{if(x<0||x>=W||y<0||y>=H||z<0||z>=D)return;world[wi(x,y,z)]=t;};

function n2(x,z,s){const v=Math.sin(x*127.1+z*311.7+s*74.2)*43758.5453;return v-Math.floor(v);}
function sn(x,z,sc,s){
  const ix=Math.floor(x/sc),iz=Math.floor(z/sc),fx=(x/sc)-ix,fz=(z/sc)-iz;
  const ux=fx*fx*(3-2*fx),uz=fz*fz*(3-2*fz);
  return n2(ix,iz,s)*(1-ux)*(1-uz)+n2(ix+1,iz,s)*ux*(1-uz)+n2(ix,iz+1,s)*(1-ux)*uz+n2(ix+1,iz+1,s)*ux*uz;
}
function terrHeight(x,z,seed){
  return Math.floor(18+sn(x,z,28,seed)*12+sn(x,z,14,seed+1)*6+sn(x,z,7,seed+2)*3+sn(x,z,3,seed+3)*1.5);
}
// ── Helpers ─────────────────────────────────────────────
let pvpTorchPos=[];
function pvpGroundY(x,z){let y=H-1;while(y>0&&gb(x,y,z)===0)y--;return y;}

function placeTree(x,z,h,seed){
  if(h+1>=H) return;
  const trunk=4+Math.floor(n2(x,z,seed+3)*2);
  for(let ty=1;ty<=trunk;ty++) if(h+ty<H) sb(x,h+ty,z,4);
  const cr=2;
  for(let lx=-cr;lx<=cr;lx++) for(let lz=-cr;lz<=cr;lz++) for(let ly=trunk-1;ly<=trunk+cr;ly++){
    const dd=lx*lx*0.9+lz*lz*0.9+(ly-trunk)*(ly-trunk)*1.2;
    if(dd<=(cr+0.4)*(cr+0.4)&&h+ly>=0&&h+ly<H){
      const bx=x+lx,bz=z+lz;
      if(bx>=0&&bx<W&&bz>=0&&bz<D&&gb(bx,h+ly,bz)===0) sb(bx,h+ly,bz,5);
    }
  }
}

// Place a sandstone step-terrace platform at (px,pz) with torch on top
function pvpPlatform(px,pz,w,levels,torchOn){
  const gy=pvpGroundY(px,pz);if(gy<=1)return;
  for(let lv=0;lv<levels;lv++){
    const r=w-lv;
    for(let x=-r;x<=r;x++) for(let z=-r;z<=r;z++){
      const by=gy+lv+1;if(by<H)sb(px+x,by,pz+z,6); // sandstone fill
    }
  }
  // Top cap: flat sandstone
  const topY=gy+levels;
  for(let x=-(w-levels+1);x<=w-levels+1;x++) for(let z=-(w-levels+1);z<=w-levels+1;z++)
    if(topY<H)sb(px+x,topY,pz+z,6);
  // Stone accent border on top
  const bw=w-levels+1;
  for(let x=-bw;x<=bw;x++) for(let z=-bw;z<=bw;z++){
    if((Math.abs(x)===bw||Math.abs(z)===bw)&&topY+1<H) sb(px+x,topY+1,pz+z,3);
  }
  // Torch pole (2 wood + point light)
  if(torchOn){
    sb(px,topY+1,pz,4);sb(px,topY+2,pz,4);
    pvpTorchPos.push([px,topY+2,pz]);
  }
  // Scattered sandstone debris around
  for(let i=0;i<8;i++){
    const ang=n2(i*2.1,px+pz,i+3)*Math.PI*2,r=w+1+n2(i,px,pz+i)*3;
    const bx=Math.floor(px+Math.cos(ang)*r),bz=Math.floor(pz+Math.sin(ang)*r);
    if(bx>=1&&bx<W-1&&bz>=1&&bz<D-1){const gy2=pvpGroundY(bx,bz);if(gy2>1)sb(bx,gy2+1,bz,6);}
  }
}

function buildPvpTower(CX,CZ){
  const TX=Math.floor(CX),TZ=Math.floor(CZ);
  const TY=pvpGroundY(TX,TZ)+1;
  // Sandstone arena center platform (r=6, 2 layers)
  for(let x=-6;x<=6;x++) for(let z=-6;z<=6;z++)
    if(Math.sqrt(x*x+z*z)<=6.3){sb(TX+x,TY,TZ+z,6);sb(TX+x,TY+1,TZ+z,6);}
  // Stone low wall ring (r=6-7)
  for(let x=-7;x<=7;x++) for(let z=-7;z<=7;z++){
    const d=Math.sqrt(x*x+z*z);
    // Gate openings at N/S/E/W
    const ang=Math.atan2(z,x)*180/Math.PI;
    const isGate=([0,90,180,-90,-180].some(a=>Math.abs(ang-a)<20||Math.abs(ang-a+360)<20));
    if(d>=6.3&&d<=7.2&&!isGate){sb(TX+x,TY+2,TZ+z,3);sb(TX+x,TY+3,TZ+z,3);}
  }
  // Sandstone steps leading into arena (4 cardinal gates)
  [0,90,180,270].forEach(deg=>{
    const rad=deg*Math.PI/180;
    for(let s=0;s<3;s++){
      const sx=Math.floor(TX+Math.cos(rad)*(7+s)),sz=Math.floor(TZ+Math.sin(rad)*(7+s));
      if(sx>=0&&sx<W&&sz>=0&&sz<D)sb(sx,TY+2-s,sz,6);
    }
  });
  // Central stone column 3×3, 16 tall
  for(let x=-4;x<=4;x++) for(let z=-4;z<=4;z++) if(Math.sqrt(x*x+z*z)<=4.3)
    {sb(TX+x,TY+2,TZ+z,3);sb(TX+x,TY+3,TZ+z,3);}
  for(let dy=4;dy<=18;dy++){
    for(let x=-1;x<=1;x++) for(let z=-1;z<=1;z++) sb(TX+x,TY+dy,TZ+z,3);
    if(dy>12) sb(TX,TY+dy,TZ,0);
  }
  // Observation deck (r=5, circular)
  const DK=TY+19;
  for(let x=-5;x<=5;x++) for(let z=-5;z<=5;z++)
    if(Math.sqrt(x*x+z*z)<=5.2){sb(TX+x,DK,TZ+z,3);sb(TX+x,DK+1,TZ+z,3);}
  // Sandstone crenellations on deck
  for(let x=-5;x<=5;x++) for(let z=-5;z<=5;z++){
    const d=Math.sqrt(x*x+z*z);
    if(d>=4.0&&d<=5.2&&(Math.abs(x)+Math.abs(z))%2===0) sb(TX+x,DK+2,TZ+z,6);
  }
  // 4 support pillars (wood)
  [[-3,-3],[-3,3],[3,-3],[3,3]].forEach(([ox,oz])=>{
    for(let dy=2;dy<=12;dy++) sb(TX+ox,DK+dy,TZ+oz,4);
  });
  // Sphere dome of wood (r=5 hollow)
  const DR=5;
  for(let dy=0;dy<=DR*2;dy++){
    const cyr=dy-DR,r=Math.sqrt(Math.max(0,DR*DR-cyr*cyr));
    for(let dx=-(Math.ceil(r)+1);dx<=Math.ceil(r)+1;dx++) for(let dz=-(Math.ceil(r)+1);dz<=Math.ceil(r)+1;dz++){
      const d=Math.sqrt(dx*dx+dz*dz);
      if(d<=r+0.6&&d>=r-0.9){const wy=DK+3+dy;if(wy<H)sb(TX+dx,wy,TZ+dz,4);}
    }
  }
  // Spire
  for(let dy=0;dy<=4;dy++) sb(TX,DK+3+DR*2+dy,TZ,4);
  // Torch on top of 4 pillars
  [[-3,-3],[-3,3],[3,-3],[3,3]].forEach(([ox,oz])=>{pvpTorchPos.push([TX+ox,DK+13,TZ+oz]);});
}

function generateTerrain(seed){
  if(gameMode==='pvp') generatePvpIsland(seed);
  else generateSurvivalWorld(seed);
}
function generatePvpIsland(seed){
  world.fill(0);pvpTorchPos=[];
  const CX=W/2,CZ=D/2,R=26,BASE_H=22;

  // ── 1. FLAT terrain (PvP-ready surface) ─────────────────
  for(let x=0;x<W;x++) for(let z=0;z<D;z++){
    const dx=x-CX,dz=z-CZ,dist=Math.sqrt(dx*dx+dz*dz);
    if(dist>=R) continue;
    // Mostly flat — just gentle ±0.5 variation, steep edge drop
    const roll=sn(x,z,8,seed)*0.5+sn(x,z,4,seed+1)*0.3;
    const edgeDip=Math.max(0,(dist-20)*1.2);
    const h=Math.min(Math.floor(BASE_H+roll-edgeDip),H-18);
    // Spherical underside
    const slab=Math.max(5,Math.floor((R-dist)*0.5+4));
    const hBot=Math.max(2,h-slab);
    for(let y=hBot;y<=h;y++){
      const ft=h-y,onEdge=dist>R-5;
      if(ft===0&&!onEdge) sb(x,y,z,1);     // grass top
      else if(ft<=2&&!onEdge) sb(x,y,z,2); // dirt
      else sb(x,y,z,3);                      // stone
    }
  }

  // ── 2. Tower + central arena ─────────────────────────────
  buildPvpTower(CX,CZ);

  // ── 3. Cardinal large platforms (sandstone, r=11) ────────
  [0,90,180,270].forEach(deg=>{
    const rad=deg*Math.PI/180;
    const rx=Math.floor(CX+Math.cos(rad)*11),rz=Math.floor(CZ+Math.sin(rad)*11);
    pvpPlatform(rx,rz,5,3,true);  // 5-wide, 3 levels, with torch
  });

  // ── 4. Diagonal medium platforms (r=15) ──────────────────
  [45,135,225,315].forEach(deg=>{
    const rad=deg*Math.PI/180;
    const rx=Math.floor(CX+Math.cos(rad)*15),rz=Math.floor(CZ+Math.sin(rad)*15);
    pvpPlatform(rx,rz,3,2,true);  // 3-wide, 2 levels, with torch
  });

  // ── 5. Extra sandstone accent blocks (ruins feel) ────────
  for(let i=0;i<16;i++){
    const ang=n2(i*3.7,seed+11,i+2)*Math.PI*2,r=8+n2(i,seed+22,i*2)*10;
    const rx=Math.floor(CX+Math.cos(ang)*r),rz=Math.floor(CZ+Math.sin(ang)*r);
    if(rx<1||rx>=W-1||rz<1||rz>=D-1) continue;
    const gy=pvpGroundY(rx,rz);if(gy<=1) continue;
    if(gb(rx,gy+1,rz)!==0) continue; // don't stack on platforms
    const sz=1+Math.floor(n2(i,seed+33,i+1)*2);
    for(let x=-sz;x<=sz;x++) for(let z=-sz;z<=sz;z++) if(gy+1<H) sb(rx+x,gy+1,rz+z,6);
    if(sz>1&&gy+2<H) sb(rx,gy+2,rz,6);
  }

  // ── 6. Trees — very sparse, outer ring only ───────────────
  for(let x=2;x<W-2;x++) for(let z=2;z<D-2;z++){
    const dx=x-CX,dz=z-CZ,dist=Math.sqrt(dx*dx+dz*dz);
    if(dist<13||dist>21) continue;
    const gy=pvpGroundY(x,z);
    if(gb(x,gy,z)!==1) continue;   // only grass
    if(gb(x,gy+1,z)!==0) continue; // must be clear above
    const noise=n2(x*3.1,z*2.8,seed+5)+sn(x,z,6,seed+6)*0.3;
    if(noise>0.92) placeTree(x,z,gy,seed);
  }

  // ── 7. Chests (one per platform, at top) ─────────────────
  [0,45,90,135,180,225,270,315].forEach((deg,i)=>{
    const rad=deg*Math.PI/180,r=i%2===0?11:15;
    const cx2=Math.floor(CX+Math.cos(rad)*r),cz2=Math.floor(CZ+Math.sin(rad)*r);
    if(cx2<1||cx2>=W-1||cz2<1||cz2>=D-1) return;
    const cy=pvpGroundY(cx2,cz2);
    if(cy>0&&cy<H-2) sb(cx2+1,cy+1,cz2,8);
  });
}
function generateSurvivalWorld(seed){
  world.fill(0);
  for(let x=0;x<W;x++) for(let z=0;z<D;z++){
    const h=Math.min(terrHeight(x,z,seed),H-8);
    const sand=h<=20;
    for(let y=0;y<=h;y++){
      if(sand)sb(x,y,z,6);
      else if(y<h-4)sb(x,y,z,3);
      else if(y<h)  sb(x,y,z,2);
      else          sb(x,y,z,1);
    }
    if(!sand&&h>22&&x>3&&x<W-4&&z>3&&z<D-4&&n2(x*3.7,z*2.9,seed+5)>0.88)
      placeTree(x,z,h,seed);
  }
}

// ════════════════════════════════════════════════════════
// THREE.JS — SCENE & RENDERING
// ════════════════════════════════════════════════════════
let scene,camera,renderer,wMesh,wMat,hlBox,clock;
let needsRebuild=true;
let pvpTorchLights=[];

const FACES=[
  {d:[0, 1,0],c:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],f:'t',bri:1.00},  // top — full sun
  {d:[0,-1,0],c:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],f:'b',bri:0.38},  // bottom — very dark (island underside)
  {d:[0, 0,1],c:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]],f:'s',bri:0.74},  // south
  {d:[0, 0,-1],c:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]],f:'s',bri:0.92}, // north — bright (facing sun)
  {d:[1, 0,0],c:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]],f:'s',bri:0.84},  // east
  {d:[-1,0,0],c:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],f:'s',bri:0.68},  // west — shadowed
];

function initThree(){
  scene=new THREE.Scene();
  const SKY=0x78b4f0;
  scene.background=new THREE.Color(SKY);
  setFog(gfog);
  camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,0.05,220);
  renderer=new THREE.WebGLRenderer({canvas:document.getElementById('canvas'),antialias:true,powerPreference:'high-performance'});
  renderer.setSize(innerWidth,innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  // ACES Filmic tone mapping — the "shader" cinematic look
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.28;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  clock=new THREE.Clock();
  // Hemisphere light: sky-blue from above, warm ground from below
  scene.add(new THREE.HemisphereLight(0x9ecff7,0x886644,0.65));
  // Main sun — strong, warm, angled
  const sun=new THREE.DirectionalLight(0xfff4d6,1.5);sun.position.set(1.2,2.0,0.8).normalize();scene.add(sun);
  // Enable shadows for pro look
  sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.near=0.5;sun.shadow.camera.far=120;
  sun.shadow.camera.left=-40;sun.shadow.camera.right=40;sun.shadow.camera.top=40;sun.shadow.camera.bottom=-40;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  // Soft fill from opposite side
  const fill=new THREE.DirectionalLight(0xb0c8e8,0.28);fill.position.set(-1.0,0.4,-0.8).normalize();scene.add(fill);
  // Phong material — enables specular highlights (shader look)
  wMat=new THREE.MeshPhongMaterial({vertexColors:true,shininess:22,specular:new THREE.Color(0x222222),side:THREE.FrontSide,flatShading:false});
  const hg=new THREE.BoxGeometry(1.005,1.005,1.005);
  const hm=new THREE.MeshBasicMaterial({color:0x000000,wireframe:true,transparent:true,opacity:0.38});
  hlBox=new THREE.Mesh(hg,hm);hlBox.visible=false;scene.add(hlBox);
  window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
}
function setFog(v){
  gfog=parseInt(v);if(!scene)return;
  const fd=FOG_DISTS[gfog-1];scene.fog=new THREE.Fog(0x78b4f0,fd*0.38,fd);
}
function buildWorld(){
  if(wMesh){scene.remove(wMesh);wMesh.geometry.dispose();}
  const pos=[],col=[],nor=[],idx=[];let vi=0;

  // Clamp helper
  const cl=(v)=>Math.max(0,Math.min(1,v));

  // Push one quad face (4 vertices, each with its own RGB)
  function quad(p0,p1,p2,p3, c0,c1,c2,c3, n){
    pos.push(...p0,...p1,...p2,...p3);
    col.push(...c0,...c1,...c2,...c3);
    nor.push(...n,...n,...n,...n);
    idx.push(vi,vi+1,vi+2,vi,vi+2,vi+3);vi+=4;
  }

  for(let x=0;x<W;x++) for(let y=0;y<H;y++) for(let z=0;z<D;z++){
    const bt=gb(x,y,z);if(!bt)continue;
    const hs=Math.min(1.0,0.74+(y/H)*0.40);

    for(const fc of FACES){
      if(gb(x+fc.d[0],y+fc.d[1],z+fc.d[2])!==0)continue;

      // Per-face base noise
      const fv=(n2(x*7.3+fc.d[0]*3.7+y*0.9,z*5.9+fc.d[2]*2.1+y*1.3,77.7)-0.5)*0.18;
      const bc=bCol(bt,fc.f);
      const isSide=fc.f==='s';
      const isTop=fc.f==='t';
      // Extra AO: darken vertices near block edges for depth (applied per-vertex below)
      const base=fc.bri*hs*(1+fv);

      // Build per-vertex colors (4 vertices: indices 0-3 from fc.c)
      // fc.c vertex layout for side faces: [0,1]=bottom (cy=0), [2,3]=top (cy=1)
      const vC=fc.c.map(([cx,cy,cz],vi2)=>{
        // Extra AO: darken bottom vertices on side faces
        const edgeAO = isSide ? (cy===0 ? 0.88 : 1.0) : 1.0;
        let r=bc[0],g=bc[1],b=bc[2],s=base*edgeAO;

        // ── GRASS BLOCK ───────────────────────────────────
        if(bt===1){
          if(isSide){
            // Iconic green-top / brown-bottom gradient
            if(cy===1){
              // Top edge: vivid green bleeds down from grass top
              r=0.26;g=0.84;b=0.17;s=base*1.05;
            } else {
              // Bottom: dirt brown
              r=0.54;g=0.38;b=0.13;s=base*0.84;
            }
          } else if(isTop){
            // Top face: subtle brighter patches (sunlit dapple)
            const dp=n2(x*9.1+cx*4.7,z*8.3+cz*3.9,y*6.1+33.2);
            s=base*(0.94+dp*0.14);
          }
        }

        // ── WOOD GRAIN (horizontal veta lines) ────────────
        else if(bt===4){
          if(isSide){
            // Each y-level alternates grain: even y = lighter stripe, odd y = darker
            const grain=y%2===0;
            // Within face: top vertices lighter in light grain, darker in dark grain
            const topMul=grain?1.18:0.84;
            const botMul=grain?0.84:1.12;
            s=base*(cy===1?topMul:botMul);
            // Extra micro-variation: cx or cz corner shift
            const corner=(vi2===0||vi2===2)?1.04:0.96;
            s*=corner;
          } else if(isTop){
            // Wood top: ring pattern (concentric lighter/darker)
            const rx=cx-0.5,rz=cz-0.5;
            const ring=Math.floor((Math.abs(rx)+Math.abs(rz))*4)%2===0?1.08:0.92;
            s=base*ring;
          }
        }

        // ── STONE (cuadrícula / tile grid look) ───────────
        else if(bt===3){
          // Diagonal corner darkening → creates tile-border AO
          const isCornerV=(vi2===0||vi2===2); // alternate diagonal
          if(isTop||isSide){
            // Block-level tile variation
            const tile=n2(x*4.1+y*2.3,z*5.7+y*1.9,bt+3.3);
            s=base*(0.90+tile*0.20);
            // Darken every other diagonal → creates grid seam effect
            if(isCornerV) s*=0.91;
            // Side bottom edge darker (depth)
            if(isSide&&cy===0) s*=0.88;
          }
        }

        // ── SANDSTONE (horizontal layer bands) ────────────
        else if(bt===6){
          // 3-cycle layer pattern: light/mid/dark bands
          const layer=y%3;
          const lm=[1.08,0.96,1.02][layer];
          s=base*lm;
          if(isSide){
            // Top of each face slightly lighter (raised edge highlight)
            if(cy===1) s*=1.06;
            else s*=0.91;
          }
        }

        // ── DIRT (speckle / patch variation) ──────────────
        else if(bt===2){
          // Per-vertex noise for soil texture
          const sp=n2(x*11.3+cx*4.7+vi2*1.9,z*9.7+cz*3.1+vi2*2.3,y*6.3+17.1);
          s=base*(0.88+sp*0.24);
          // Grass block above → green tint on top face
          if(isTop&&gb(x,y+1,z)===1){r=0.36;g=0.62;b=0.14;s=base*(0.90+sp*0.16);}
        }

        // ── LEAVES (dappled sunlight through canopy) ──────
        else if(bt===5){
          const dp=n2(x*5.7+cx*3.1+vi2*1.7,z*6.3+cz*2.9+vi2*2.1,y*4.1+9.9);
          // Some vertices brighter (sunlit), some darker (shadowed)
          s=base*(0.82+dp*0.36);
          // Slight color variation: some leaves yellower, some deeper green
          const cv=n2(x*8.1,z*7.3,y*3.7+vi2+21.0);
          r+=cv*0.08;g+=cv*0.05;b-=cv*0.02;
        }

        // ── GLASS: subtle blue tint variation ─────────────
        else if(bt===7){
          const gv=n2(x*6.1+vi2,z*5.3+vi2,y*3.3+55.0);
          s=base*(0.90+gv*0.18);
        }

        return [cl(r*s),cl(g*s),cl(b*s)];
      });

      // Push the 4 vertices with their individual colors
      for(let i=0;i<4;i++){
        const[cx,cy,cz]=fc.c[i];
        pos.push(x+cx,y+cy,z+cz);
        col.push(...vC[i]);
        nor.push(fc.d[0],fc.d[1],fc.d[2]);
      }
      idx.push(vi,vi+1,vi+2,vi,vi+2,vi+3);vi+=4;
    }

    // ── GRASS BLADES (briznas de hierba) ─────────────────
    // Every other block (checkerboard) for performance
    if(bt===1&&gb(x,y+1,z)===0&&(x+z)%2===0){
      const gn=n2(x*5.3,z*4.7,33.1);
      const gn2=n2(x*7.1,z*6.9,71.3);
      // Blade height 0.40-0.65, inset 0.08-0.20
      const gh=0.40+gn*0.25;
      const gi=0.08+gn2*0.12;
      const by=y+1;
      // Blade color: bright lime green (top), deep green (bottom)
      const gr=0.22+gn*0.08, gg=0.88+gn*0.10, gb2=0.11+gn*0.04;
      const dr=0.12+gn*0.05, dg=0.52+gn*0.08, db=0.07+gn*0.02;
      const TC=[cl(gr),cl(gg),cl(gb2)],BC=[cl(dr),cl(dg),cl(db)];

      // X-axis blade pair (front + back)
      quad([x+gi,by,z+0.5],[x+1-gi,by,z+0.5],[x+1-gi,by+gh,z+0.5],[x+gi,by+gh,z+0.5],
           BC,BC,TC,TC,[0,0,1]);
      quad([x+1-gi,by,z+0.5],[x+gi,by,z+0.5],[x+gi,by+gh,z+0.5],[x+1-gi,by+gh,z+0.5],
           BC,BC,TC,TC,[0,0,-1]);

      // Z-axis blade pair (front + back)
      quad([x+0.5,by,z+gi],[x+0.5,by,z+1-gi],[x+0.5,by+gh,z+1-gi],[x+0.5,by+gh,z+gi],
           BC,BC,TC,TC,[1,0,0]);
      quad([x+0.5,by,z+1-gi],[x+0.5,by,z+gi],[x+0.5,by+gh,z+gi],[x+0.5,by+gh,z+1-gi],
           BC,BC,TC,TC,[-1,0,0]);
    }
  }

  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  g.setIndex(idx);
  wMesh=new THREE.Mesh(g,wMat);scene.add(wMesh);needsRebuild=false;

  // Torch point lights
  pvpTorchLights.forEach(l=>scene.remove(l));pvpTorchLights=[];
  if(gameMode==='pvp'&&scene){
    pvpTorchPos.forEach(([tx,ty,tz])=>{
      const l=new THREE.PointLight(0xff6818,3.2,16);
      l.position.set(tx+0.5,ty+0.8,tz+0.5);scene.add(l);pvpTorchLights.push(l);
    });
  }
}

// ════════════════════════════════════════════════════════
// CHARACTER BUILDER
// ════════════════════════════════════════════════════════
function buildCharacter(outfit={}){
  const o={...DEFAULT_OUTFIT,...outfit};
  const g=new THREE.Group();
  const mat=c=>new THREE.MeshLambertMaterial({color:c});

  // ── Head ──────────────────────────────────────
  const head=new THREE.Mesh(new THREE.BoxGeometry(0.52,0.56,0.52),mat(o.skinColor));
  head.position.y=1.63;g.add(head);

  // Hair layer (slightly bigger box on top)
  const hair=new THREE.Mesh(new THREE.BoxGeometry(0.54,0.22,0.54),mat(o.hairColor));
  hair.position.y=1.96;g.add(hair);
  // Hair sides
  [-1,1].forEach(s=>{
    const hs=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.30,0.54),mat(o.hairColor));
    hs.position.set(s*0.28,1.80,0);g.add(hs);
  });
  // Hair back
  const hb=new THREE.Mesh(new THREE.BoxGeometry(0.54,0.38,0.04),mat(o.hairColor));
  hb.position.set(0,1.75,-0.27);g.add(hb);

  // Ears
  [-1,1].forEach(s=>{
    const ear=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.16,0.16),mat(o.skinColor));
    ear.position.set(s*0.29,1.63,0);g.add(ear);
  });

  // ── Eyes (Minecraft style) ────────────────────
  const eyeColor=o.eyeColor||0x2c1810;
  [-1,1].forEach(s=>{
    // White sclera
    const white=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.11,0.02),mat(0xffffff));
    white.position.set(s*0.13,1.675,0.263);g.add(white);
    // Coloured iris
    const iris=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.08,0.02),mat(eyeColor));
    iris.position.set(s*0.13,1.675,0.270);g.add(iris);
    // Pupil (dark centre)
    const pupil=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.05,0.02),mat(0x000000));
    pupil.position.set(s*0.13,1.672,0.277);g.add(pupil);
    // Eyebrow
    const brow=new THREE.Mesh(new THREE.BoxGeometry(0.15,0.04,0.02),mat(o.hairColor));
    brow.position.set(s*0.13,1.725,0.263);g.add(brow);
  });

  // Nose
  const nose=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.05,0.04),mat(o.skinColor===0xffcc99?0xf0aa70:0xcc9966));
  nose.position.set(0,1.61,0.278);g.add(nose);

  // Mouth (dark line)
  const mouth=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.04,0.02),mat(0x7a3a20));
  mouth.position.set(0,1.568,0.263);g.add(mouth);
  // Teeth strip
  const teeth=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.025,0.015),mat(0xfafafa));
  teeth.position.set(0,1.572,0.268);g.add(teeth);

  // ── Torso ─────────────────────────────────────
  const torso=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.72,0.32),mat(o.shirtColor));
  torso.position.y=0.98;g.add(torso);
  // Collar detail
  const collar=new THREE.Mesh(new THREE.BoxGeometry(0.40,0.06,0.34),mat(o.shirtColor===0x3a6abf?0x2a4a9f:0x888888));
  collar.position.set(0,1.34,0);g.add(collar);
  // Belt
  const belt=new THREE.Mesh(new THREE.BoxGeometry(0.64,0.07,0.34),mat(0x4a3520));
  belt.position.set(0,0.62,0);g.add(belt);
  const buckle=new THREE.Mesh(new THREE.BoxGeometry(0.10,0.07,0.04),mat(0xd4af37));
  buckle.position.set(0,0.62,0.18);g.add(buckle);

  // ── Arms ─────────────────────────────────────
  [-1,1].forEach(s=>{
    const armGroup=new THREE.Group();
    armGroup.position.set(s*0.45,1.28,0); // pivot at shoulder
    armGroup.userData.isArm=true;
    armGroup.userData.armSide=s;
    const arm=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.62,0.28),mat(o.shirtColor));
    arm.position.y=-0.31;armGroup.add(arm);
    const hand=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.18,0.26),mat(o.skinColor));
    hand.position.y=-0.64;armGroup.add(hand);
    const cuff=new THREE.Mesh(new THREE.BoxGeometry(0.29,0.06,0.29),mat(0xffffff));
    cuff.position.y=-0.55;armGroup.add(cuff);
    g.add(armGroup);
  });

  // ── Legs ─────────────────────────────────────
  [-1,1].forEach(s=>{
    const legGroup=new THREE.Group();
    legGroup.position.set(s*0.16,0.72,0); // pivot at hip
    legGroup.userData.isLeg=true;
    legGroup.userData.legSide=s;
    const leg=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.72,0.28),mat(o.pantsColor));
    leg.position.y=-0.36;legGroup.add(leg);
    const knee=new THREE.Mesh(new THREE.BoxGeometry(0.30,0.06,0.30),mat(
      typeof o.pantsColor==='number'?o.pantsColor-0x111111:0x1a2040));
    knee.position.y=-0.26;legGroup.add(knee);
    g.add(legGroup);
  });

  // ── Shoes ────────────────────────────────────
  [-1,1].forEach(s=>{
    const shoe=new THREE.Mesh(new THREE.BoxGeometry(0.30,0.13,0.36),mat(o.shoesColor));
    shoe.position.set(s*0.16,0.0,0.02);g.add(shoe);
    // Sole
    const sole=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.04,0.38),mat(0x333333));
    sole.position.set(s*0.16,-0.045,0.02);g.add(sole);
  });

  // ── Cape (optional) ──────────────────────────
  if(o.capeColor){
    // Main cape body
    const cape=new THREE.Mesh(new THREE.BoxGeometry(0.64,0.82,0.05),mat(o.capeColor));
    cape.position.set(0,0.90,-0.19);g.add(cape);
    // Inner lining
    const lining=new THREE.Mesh(new THREE.BoxGeometry(0.57,0.74,0.02),mat(o.capeLining||0xffffff));
    lining.position.set(0,0.90,-0.225);g.add(lining);
    // Top trim bar
    const trim=new THREE.Mesh(new THREE.BoxGeometry(0.66,0.05,0.07),mat(o.capeLining||0xffffff));
    trim.position.set(0,1.305,-0.185);g.add(trim);
    // Left/right edge trims
    [-1,1].forEach(s=>{
      const etrim=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.82,0.06),mat(o.capeLining||0xffffff));
      etrim.position.set(s*0.335,0.90,-0.185);g.add(etrim);
    });
    // Decorative middle stripe
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.70,0.03),mat(o.capeLining||0xffffff));
    stripe.position.set(0,0.90,-0.21);stripe.material.opacity=0.4;stripe.material.transparent=true;g.add(stripe);

    // ── Flame licks at cape bottom ──────────────
    const capeBottom=0.90-0.41; // 0.49
    const fbaseMat=c=>new THREE.MeshBasicMaterial({color:c});
    const flameStrips=[
      {x:-0.26,h:0.14,ow:0.09,c:0xff2200,ic:0xff7700},
      {x:-0.16,h:0.20,ow:0.08,c:0xff4400,ic:0xffaa00},
      {x:-0.06,h:0.18,ow:0.09,c:0xff6600,ic:0xffcc00},
      {x:0.04, h:0.22,ow:0.08,c:0xff8800,ic:0xffdd00},
      {x:0.14, h:0.17,ow:0.09,c:0xff4400,ic:0xffaa00},
      {x:0.24, h:0.13,ow:0.08,c:0xff2200,ic:0xff7700},
    ];
    flameStrips.forEach((fs,i)=>{
      // Outer flame (wide, dark orange/red)
      const outer=new THREE.Mesh(new THREE.BoxGeometry(fs.ow,fs.h,0.04),fbaseMat(fs.c));
      outer.position.set(fs.x, capeBottom-fs.h/2, -0.19);
      outer.userData.isFlame=true;outer.userData.flamePhase=i*(Math.PI*2/6);
      outer.userData.baseY=capeBottom-fs.h/2;outer.userData.flameH=fs.h;
      g.add(outer);
      // Inner flame (narrow, bright yellow)
      const iH=fs.h*0.65;
      const inner=new THREE.Mesh(new THREE.BoxGeometry(fs.ow*0.5,iH,0.045),fbaseMat(fs.ic));
      inner.position.set(fs.x, capeBottom-iH/2, -0.215);
      inner.userData.isFlame=true;inner.userData.flamePhase=i*(Math.PI*2/6)+0.7;
      inner.userData.baseY=capeBottom-iH/2;inner.userData.flameH=iH;
      g.add(inner);
      // Tiny bright core
      const cH=fs.h*0.35;
      const core=new THREE.Mesh(new THREE.BoxGeometry(fs.ow*0.28,cH,0.046),fbaseMat(0xffffff));
      core.position.set(fs.x, capeBottom-cH/2, -0.22);
      core.userData.isFlame=true;core.userData.flamePhase=i*(Math.PI*2/6)+1.4;
      core.userData.baseY=capeBottom-cH/2;core.userData.flameH=cH;
      g.add(core);
    });
  }
  return g;
}

// ════════════════════════════════════════════════════════
// LOBBY — 3D CHARACTER PREVIEW
// ════════════════════════════════════════════════════════
let lobbyRenderer,lobbyScene,lobbyChar,lobbyAnimId;
function initLobbyChar(){
  const canvas=document.getElementById('charcanvas');
  lobbyScene=new THREE.Scene();
  const cam=new THREE.PerspectiveCamera(40,canvas.width/canvas.height,0.1,50);
  cam.position.set(0,1.6,4.6);cam.lookAt(0,0.95,0);
  lobbyRenderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  lobbyRenderer.setSize(canvas.width,canvas.height);
  lobbyRenderer.setClearColor(0x000000,0);
  // Lighting
  lobbyScene.add(new THREE.AmbientLight(0xffffff,0.55));
  const kl=new THREE.DirectionalLight(0x00f5d4,1.2);kl.position.set(2,3,3);lobbyScene.add(kl);
  const fl=new THREE.DirectionalLight(0xffffff,0.5);fl.position.set(-2,1,3);lobbyScene.add(fl);
  const backL=new THREE.DirectionalLight(0x7b2ff7,0.4);backL.position.set(0,1,-3);lobbyScene.add(backL);
  const ptL=new THREE.PointLight(0xff6600,0,2.5); // flame glow — intensity set dynamically
  ptL.position.set(0,-0.2,-0.8);lobbyScene.add(ptL);

  // Platform
  const plat=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.4,0.10,48),new THREE.MeshLambertMaterial({color:0x12122a}));
  plat.position.y=-0.05;lobbyScene.add(plat);
  // Platform top face glow
  const platGlow=new THREE.Mesh(new THREE.CylinderGeometry(1.38,1.38,0.01,48),new THREE.MeshBasicMaterial({color:0x00f5d4,transparent:true,opacity:0.12}));
  platGlow.position.y=0.00;lobbyScene.add(platGlow);
  // Outer ring
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.4,0.04,8,64),new THREE.MeshBasicMaterial({color:0x00f5d4,transparent:true,opacity:0.55}));
  ring.rotation.x=Math.PI/2;ring.position.y=0.01;lobbyScene.add(ring);
  // Inner ring
  const ring2=new THREE.Mesh(new THREE.TorusGeometry(0.9,0.025,8,48),new THREE.MeshBasicMaterial({color:0x7b2ff7,transparent:true,opacity:0.4}));
  ring2.rotation.x=Math.PI/2;ring2.position.y=0.01;lobbyScene.add(ring2);

  function getOutfitWithCape(){
    const cape=getEquippedCape();
    return cape?{...currentOutfit,capeColor:cape.color,capeLining:cape.lining}:{...currentOutfit};
  }
  lobbyChar=buildCharacter(getOutfitWithCape());lobbyScene.add(lobbyChar);

  // ── Free-Fire-style orbital drag ──
  let lobbyAutoYaw=0,lobbyDragYaw=0,lobbyDragging=false,lobbyLastX=0;
  canvas.style.cursor='grab';
  canvas.addEventListener('mousedown',e=>{lobbyDragging=true;lobbyLastX=e.clientX;canvas.style.cursor='grabbing';e.preventDefault();});
  document.addEventListener('mouseup',()=>{lobbyDragging=false;canvas.style.cursor='grab';});
  canvas.addEventListener('mousemove',e=>{if(!lobbyDragging)return;lobbyDragYaw+=(e.clientX-lobbyLastX)*0.013;lobbyLastX=e.clientX;});
  canvas.addEventListener('touchstart',e=>{lobbyDragging=true;lobbyLastX=e.touches[0].clientX;e.preventDefault();},{passive:false});
  canvas.addEventListener('touchend',()=>lobbyDragging=false);
  canvas.addEventListener('touchmove',e=>{if(!lobbyDragging)return;lobbyDragYaw+=(e.touches[0].clientX-lobbyLastX)*0.013;lobbyLastX=e.touches[0].clientX;e.preventDefault();},{passive:false});

  function animateLobby(){
    lobbyAnimId=requestAnimationFrame(animateLobby);
    const t=Date.now()*0.001;
    // Float + auto-rotate (stops when dragging)
    if(!lobbyDragging) lobbyAutoYaw+=0.006;
    lobbyChar.rotation.y=lobbyAutoYaw+lobbyDragYaw;
    lobbyChar.position.y=Math.sin(t*0.9)*0.06;
    // Animate flame licks + flame point light
    let hasFlames=false;
    lobbyChar.traverse(child=>{
      if(!child.userData.isFlame)return;
      hasFlames=true;
      const ph=child.userData.flamePhase;
      const s=0.55+Math.sin(t*3.1+ph)*0.38+Math.sin(t*5.7+ph*1.3)*0.1;
      child.scale.y=Math.max(0.1,s);
      // Keep flame base pinned at cape bottom
      const h=child.userData.flameH;
      child.position.y=child.userData.baseY+h*(1-Math.max(0.1,s))/2;
      // Slight sway
      child.rotation.z=Math.sin(t*2.3+ph)*0.10;
      child.position.x=child.userData.baseX===undefined
        ?(child.userData.baseX=child.position.x)
        :child.userData.baseX+Math.sin(t*1.7+ph)*0.012;
    });
    // Flame point light pulsates if character has cape
    if(hasFlames){
      ptL.intensity=0.8+Math.sin(t*4)*0.5;
      ring.material.opacity=0.45+Math.sin(t*1.2)*0.15;
    }
    // Rings pulse
    ring2.material.opacity=0.3+Math.sin(t*0.8)*0.15;
    lobbyRenderer.render(lobbyScene,cam);
  }
  animateLobby();
  window._rebuildLobbyChar=()=>{
    lobbyScene.remove(lobbyChar);
    lobbyChar.traverse(c=>{if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();});
    lobbyChar=buildCharacter(getOutfitWithCape());lobbyScene.add(lobbyChar);
  };
}
function stopLobbyChar(){
  if(lobbyAnimId)cancelAnimationFrame(lobbyAnimId);
  if(lobbyRenderer)lobbyRenderer.dispose();
}

// ════════════════════════════════════════════════════════
// COLLISION
// ════════════════════════════════════════════════════════
function playerHitsAny(px,foot,pz){
  const x0=Math.floor(px-PW),x1=Math.floor(px+PW);
  const y0=Math.floor(foot),  y1=Math.floor(foot+PH-0.01);
  const z0=Math.floor(pz-PW), z1=Math.floor(pz+PW);
  for(let bx=x0;bx<=x1;bx++) for(let by=y0;by<=y1;by++) for(let bz=z0;bz<=z1;bz++)
    if(gb(bx,by,bz)!==0)return true;
  return false;
}

// ════════════════════════════════════════════════════════
// CONTROLS STATE
// ════════════════════════════════════════════════════════
const keys={};
let velY=0,onGround=false,locked=false,yaw=0,pitch=0;
let selBlock=1,gameOn=false,chatOpen=false;
let camMode=0; // 0=primera persona, 1=tercera detrás, 2=tercera frente
let localPlayerMesh=null;
let tgtB=null,tgtF=null,health=20,mouseHeld=false;
// ── Animation state ──
let walkCycle=0, isWalking=false, wasOnGround=true, jumpSquash=0, landBounce=0, attackAnim=0;
let headBob=0, headBobActive=false;
const breaking={active:false,x:-1,y:-1,z:-1,progress:0,duration:1};

document.addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(!gameOn||chatOpen) return;
  if(e.code==='KeyT'){openChat();e.preventDefault();return;}
  if(e.code==='Escape'){
    if(craftOpen){closeCraft();return;}
    if(backpackOpen){closeBackpack();return;}
    if(anyOverlayOpen()){resume();return;}
    if(locked){showPause();document.exitPointerLock();}
    return;
  }
  if(e.code==='KeyF') tryMeleeAttack();
  if(e.code==='KeyC'){e.preventDefault();craftOpen?closeCraft():openCraft();return;}
  if(e.code==='KeyB'){e.preventDefault();backpackOpen?closeBackpack():openBackpack();return;}
  if(e.code==='KeyE'){e.preventDefault();eatFood();return;}
  if(e.code==='KeyP'){e.preventDefault();cycleCamMode();return;}
  const n=parseInt(e.key);
  if(n>=1&&n<=7){selBlock=n;updateHotbar();}
});
document.addEventListener('keyup',e=>{keys[e.code]=false;});
document.addEventListener('mousemove',e=>{
  if(!locked||chatOpen)return;
  yaw-=e.movementX*gsens;
  pitch=Math.max(-Math.PI/2+0.02,Math.min(Math.PI/2-0.02,pitch-e.movementY*gsens));
});
document.addEventListener('mousedown',e=>{
  if(!locked||chatOpen)return;
  if(e.button===2){placeBlock();return;}
  if(e.button===0){
    // Try to attack a player first (like Minecraft)
    if(tryClickAttack()) return;
    // No player hit → start block breaking
    mouseHeld=true;
  }
});
document.addEventListener('mouseup',e=>{
  if(e.button!==0)return;
  mouseHeld=false;breaking.active=false;breaking.progress=0;
  document.getElementById('breakwrap').style.display='none';
});
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('wheel',e=>{
  if(!locked)return;
  selBlock+=e.deltaY>0?1:-1;
  if(selBlock<1)selBlock=7;if(selBlock>7)selBlock=1;
  updateHotbar();
},{passive:true});
document.getElementById('canvas').addEventListener('click',()=>{
  if(gameOn&&!anyOverlayOpen()&&!craftOpen&&!backpackOpen) document.getElementById('canvas').requestPointerLock();
});
document.addEventListener('pointerlockchange',()=>{
  locked=!!document.pointerLockElement;
  if(gameOn&&!anyOverlayOpen()&&!craftOpen&&!backpackOpen&&!locked) showPause();
});

// ════════════════════════════════════════════════════════
// PHYSICS
// ════════════════════════════════════════════════════════
function updatePhysics(dt){
  if(!locked||chatOpen)return;
  const fwd=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  const rgt=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const mv=new THREE.Vector3();
  if(keys['KeyW']||keys['ArrowUp'])   mv.add(fwd);
  if(keys['KeyS']||keys['ArrowDown']) mv.sub(fwd);
  if(keys['KeyA']||keys['ArrowLeft']) mv.sub(rgt);
  if(keys['KeyD']||keys['ArrowRight'])mv.add(rgt);
  if(mv.lengthSq()>0)mv.normalize().multiplyScalar(SPEED*dt);
  if(keys['Space']&&onGround){velY=JUMP;onGround=false;jumpSquash=0.35;
    // Visual jump feedback - subtle screen effect
    const jb=document.getElementById('jump-bob');if(jb){jb.style.animation='none';void jb.offsetWidth;jb.style.animation='jumpBob 0.4s ease-out forwards';}
  }
  let px=camera.position.x,foot=camera.position.y-PH,pz=camera.position.z;
  if(mv.x!==0){const nx=px+mv.x;
    if(!playerHitsAny(nx,foot,pz))px=nx;
    else if(onGround&&!playerHitsAny(nx,foot+STEP_H,pz)){px=nx;foot+=STEP_H;velY=0;}}
  if(mv.z!==0){const nz=pz+mv.z;
    if(!playerHitsAny(px,foot,nz))pz=nz;
    else if(onGround&&!playerHitsAny(px,foot+STEP_H,nz)){pz=nz;foot+=STEP_H;velY=0;}}
  velY+=GRAV*dt;
  const nf=foot+velY*dt;
  if(!playerHitsAny(px,nf,pz)){foot=nf;if(velY<0)onGround=false;}
  else{if(velY<0){onGround=true;if(velY<-11)takeDamage(Math.floor((-velY-11)/3.5));}velY=0;}
  px=Math.max(PW+0.01,Math.min(W-PW-0.01,px));
  pz=Math.max(PW+0.01,Math.min(D-PW-0.01,pz));
  if(foot<-5){respawn();return;}
  // ── Camera mode (P key) + animations ──────────
  const bodyX=px, bodyY=foot+PH-0.3, bodyZ=pz;
  const fwdX=-Math.sin(yaw), fwdZ=-Math.cos(yaw);
  const moving=keys['KeyW']||keys['KeyS']||keys['KeyA']||keys['KeyD'];
  
  // Walk cycle animation
  if(moving && onGround){
    walkCycle+=dt*10;
    isWalking=true;
    headBob+=dt*12;
  } else {
    isWalking=false;
    walkCycle*=0.85; // decay smoothly
    headBob*=0.85;
  }
  
  // Jump squash & stretch
  if(!onGround && wasOnGround){ jumpSquash=0.3; }
  if(onGround && !wasOnGround){ landBounce=0.25; }
  wasOnGround=onGround;
  jumpSquash*=0.85;
  landBounce*=0.88;
  
  if(camMode===0){
    // Primera persona — vista desde dentro de la cabeza
    const bobY=isWalking?Math.sin(headBob)*0.04:0;
    const bobX=isWalking?Math.cos(headBob*0.5)*0.02:0;
    camera.position.set(px+bobX,foot+PH+bobY,pz);
    camera.quaternion.setFromEuler(new THREE.Euler(pitch,yaw,0,'YXZ'));
    if(localPlayerMesh)localPlayerMesh.visible=false;
    document.getElementById('xhair').style.display='block';
  } else {
    const DIST=3.8, UP=1.6;
    if(camMode===1){
      camera.position.set(bodyX-fwdX*DIST, bodyY+UP, bodyZ-fwdZ*DIST);
    } else {
      camera.position.set(bodyX+fwdX*DIST, bodyY+UP*0.9, bodyZ+fwdZ*DIST);
    }
    camera.lookAt(bodyX, bodyY+0.5, bodyZ);
    if(localPlayerMesh){
      localPlayerMesh.visible=true;
      localPlayerMesh.position.set(px, foot, pz);
      // Fix: character faces +Z locally, game forward is -Z when yaw=0
      localPlayerMesh.rotation.y=yaw+Math.PI;
      // Walk animation — swing arms and legs
      const swing=isWalking?Math.sin(walkCycle)*0.6:0;
      const breathe=Math.sin(Date.now()*0.002)*0.02;
      localPlayerMesh.traverse(child=>{
        if(child.userData.isArm){
          child.rotation.x=swing*child.userData.armSide*-0.8;
        }
        if(child.userData.isLeg){
          child.rotation.x=swing*child.userData.legSide*0.7;
        }
      });
      // Jump squash/stretch
      if(jumpSquash>0.01){
        localPlayerMesh.scale.set(1+jumpSquash*0.3, 1-jumpSquash*0.5, 1+jumpSquash*0.3);
      } else if(landBounce>0.01){
        localPlayerMesh.scale.set(1+landBounce*0.4, 1-landBounce*0.6, 1+landBounce*0.4);
      } else {
        localPlayerMesh.scale.set(1,1+breathe,1);
      }
    }
    document.getElementById('xhair').style.display='none';
  }
}

// ════════════════════════════════════════════════════════
// BLOCK BREAKING — hold left-click + tool speed + resource drops
// ════════════════════════════════════════════════════════
function updateBreaking(dt){
  if(!mouseHeld||!locked||chatOpen||!tgtB){
    if(breaking.active){breaking.active=false;breaking.progress=0;document.getElementById('breakwrap').style.display='none';}
    return;
  }
  const{x,y,z}=tgtB;
  if(breaking.active&&breaking.x===x&&breaking.y===y&&breaking.z===z){
    breaking.progress+=dt;
    document.getElementById('breakprog').style.width=(Math.min(breaking.progress/breaking.duration,1)*100)+'%';
    if(breaking.progress>=breaking.duration){
      const bt=gb(x,y,z);
      sb(x,y,z,0);needsRebuild=true;sendBlock(x,y,z,0);
      collectResource(bt);
      breaking.active=false;breaking.progress=0;
      document.getElementById('breakwrap').style.display='none';
    }
  }else{
    breaking.active=true;breaking.x=x;breaking.y=y;breaking.z=z;
    breaking.progress=0;
    const baseDur=BREAK_DUR[gb(x,y,z)]||0.75;
    breaking.duration=baseDur*getBreakMult(gb(x,y,z));
    document.getElementById('breakwrap').style.display='block';
    document.getElementById('breakprog').style.width='0%';
  }
}

// ════════════════════════════════════════════════════════
// RAYCAST
// ════════════════════════════════════════════════════════
function castRay(){
  const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  let px=camera.position.x,py=camera.position.y,pz=camera.position.z;
  let lx=-1,ly=-1,lz=-1;
  const step=0.04;
  for(let i=0;i<REACH/step;i++){
    const bx=Math.floor(px),by=Math.floor(py),bz=Math.floor(pz);
    if(gb(bx,by,bz)!==0){
      tgtB={x:bx,y:by,z:bz};tgtF={x:lx,y:ly,z:lz};
      hlBox.position.set(bx+0.5,by+0.5,bz+0.5);hlBox.visible=true;return;
    }
    lx=bx;ly=by;lz=bz;px+=dir.x*step;py+=dir.y*step;pz+=dir.z*step;
  }
  tgtB=null;hlBox.visible=false;
  if(breaking.active){breaking.active=false;breaking.progress=0;document.getElementById('breakwrap').style.display='none';}
}

// Proper AABB check — prevents placing blocks that overlap the player body
function wouldOverlapPlayer(bx,by,bz){
  const p=camera.position,foot=p.y-PH;
  return bx<p.x+PW+0.05&&bx+1>p.x-PW-0.05&&
         by<p.y+0.05&&by+1>foot-0.05&&
         bz<p.z+PW+0.05&&bz+1>p.z-PW-0.05;
}
function placeBlock(){
  if(!tgtF||tgtF.x<0)return;
  const{x,y,z}=tgtF;
  if(x<0||x>=W||y<0||y>=H||z<0||z>=D)return;
  if(wouldOverlapPlayer(x,y,z))return;
  // Check finite inventory
  const cost=BLOCK_COST[selBlock];
  if(!cost){addMsg('','No puedes colocar ese bloque',true);return;}
  if((inv[cost]||0)<=0){addMsg('','No tienes '+({dirt:'Tierra',stone:'Piedra',wood:'Madera',sand:'Arena'}[cost]||cost),true);return;}
  inv[cost]--;
  updateResourceHUD();updateHotbarCounts();
  sb(x,y,z,selBlock);needsRebuild=true;sendBlock(x,y,z,selBlock);
}

// ════════════════════════════════════════════════════════
// COMBAT (PvP + Survival)
// ════════════════════════════════════════════════════════

// Called on left-click: returns true if a player was attacked (blocks break from starting)
function tryClickAttack(){
  if(attackTimer>0) return false;
  if(rP.size===0) return false;
  const w=WEAPONS[equippedWeapon];
  const myPos=camera.position;
  const aimDir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  let closest=null,closestDist=ATTACK_RANGE;
  rP.forEach((p,id)=>{
    const pCenter=p.g.position.clone().add(new THREE.Vector3(0,1,0));
    const toP=pCenter.clone().sub(myPos);
    const dist=toP.length();
    if(dist<closestDist){
      // Must be roughly in front (dot > 0.4 = within ~66°)
      if(aimDir.dot(toP.normalize())>0.4){closestDist=dist;closest=id;}
    }
  });
  if(!closest) return false;
  attackTimer=w.cool;
  const dmg=w.dmg+Math.floor(Math.random()*2);
  sendWS({type:'attack',targetId:closest,damage:dmg});
  showHitEffect('orange');
  showSwing();
  addMsg('',`${w.icon} Golpeaste a ${rP.get(closest).u} (-${dmg}❤)`,true);
  return true;
}

// F key still works as fallback (no aim required)
function tryMeleeAttack(){
  if(attackTimer>0)return;
  const w=WEAPONS[equippedWeapon];
  attackTimer=w.cool;
  const myPos=camera.position;
  let closest=null,closestDist=ATTACK_RANGE;
  rP.forEach((p,id)=>{
    const d=myPos.distanceTo(p.g.position.clone().setY(myPos.y));
    if(d<closestDist){closestDist=d;closest=id;}
  });
  if(closest){
    const dmg=w.dmg+Math.floor(Math.random()*2);
    sendWS({type:'attack',targetId:closest,damage:dmg});
    showHitEffect('orange');
    addMsg('',`${w.icon} Golpeaste a ${rP.get(closest).u} (-${dmg}❤)`,true);
  }
  showSwing();
}
function showSwing(){
  const el=document.getElementById('swing-fx');if(!el)return;
  el.style.display='block';setTimeout(()=>el.style.display='none',120);
}
function showHitEffect(color='red'){
  const el=document.createElement('div');
  const bg=color==='orange'?'rgba(255,120,0,0.15)':'rgba(255,40,40,0.22)';
  el.style.cssText=`position:fixed;inset:0;pointer-events:none;background:${bg};z-index:999;animation:hitfade .3s ease forwards`;
  document.body.appendChild(el);setTimeout(()=>el.remove(),300);
  if(!document.querySelector('#hitanim')){
    const s=document.createElement('style');s.id='hitanim';
    s.textContent='@keyframes hitfade{from{opacity:1}to{opacity:0}}';document.head.appendChild(s);
  }
}
function receiveAttack(damage,fromName){
  takeDamage(damage);showHitEffect('red');
  addMsg('',`⚔ ${fromName} te golpeó (-${damage}❤)`,true);
}
function addKillFeed(killer,victim,killerKills,killsToWin){
  const kf=document.getElementById('killfeed');
  const d=document.createElement('div');d.className='kf-item';
  const progress=killerKills?` (${killerKills}/${killsToWin||5})`:'' ;
  d.innerHTML=`<b>${killer}</b> ⚔ <b>${victim}</b><span style="color:#ffd700;font-size:0.65rem">${progress}</span>`;
  kf.appendChild(d);setTimeout(()=>d.remove(),3200);
}
function updateKillDisplay(){
  const el=document.getElementById('kill-counter');if(!el)return;
  el.textContent=`⚔ ${myKills}/5`;
  el.style.color=myKills>=4?'#ff4444':myKills>=2?'#ffd700':'rgba(255,255,255,0.6)';
}
function showGameOver(winnerName,kills){
  gameOn=false;document.exitPointerLock();
  const el=document.getElementById('ogameover');if(!el)return;
  const isWinner=winnerName===myUser;
  document.getElementById('go-title').textContent=isWinner?'🏆 ¡GANASTE!':'💀 Partida terminada';
  document.getElementById('go-winner').textContent=`${winnerName} ganó con ${kills} kills`;
  document.getElementById('go-kills').textContent=`Tus kills: ${myKills}`;
  el.style.display='flex';
  // Save stats to localStorage
  const prevBest=parseInt(localStorage.getItem('vw_best_kills')||'0');
  if(myKills>prevBest)localStorage.setItem('vw_best_kills',myKills);
  const prevGames=parseInt(localStorage.getItem('vw_total_games')||'0');
  localStorage.setItem('vw_total_games',prevGames+1);
}

// ════════════════════════════════════════════════════════
// HEALTH
// ════════════════════════════════════════════════════════
function takeDamage(dmg){
  if(immunityTimer>0) return; // post-respawn immunity
  health=Math.max(0,health-dmg);updateHealthbar();
  if(health<=0){addMsg('','💀 Fuiste eliminado… reapareciendo',true);setTimeout(respawn,1500);}
}
function respawn(){
  health=20;hunger=20;updateHealthbar();updateHungerBar();
  // 2-second immunity
  immunityTimer=2.0;
  const ib=document.getElementById('immunity-border');
  if(ib){ib.style.opacity='1';setTimeout(()=>{if(immunityTimer<=0)ib.style.opacity='0';},2200);}
  // Screen flash white
  showHitEffect('white');
  // Always respawn at personal spawn point
  const sx=mySpawnX,sz=mySpawnZ;
  let sy=H-1;while(sy>0&&gb(sx,sy,sz)===0)sy--;
  camera.position.set(sx+0.5,sy+PH+1.5,sz+0.5);velY=0;
  addMsg('','🛡 ¡Reapareciste! Inmune 2 segundos',true);
}
function showKillFlash(victimName){
  const flash=document.getElementById('kill-flash');
  const banner=document.getElementById('kill-banner');
  if(flash){flash.style.animation='none';void flash.offsetWidth;flash.style.animation='killFlashAnim 1.4s ease-out forwards';}
  if(banner){
    const v=document.getElementById('kban-victim');const k=document.getElementById('kban-kills');
    if(v)v.textContent=`💀 ${victimName} eliminado`;
    if(k)k.textContent=`⚔ Kill ${myKills}/5`;
    banner.style.animation='none';void banner.offsetWidth;banner.style.animation='killBannerAnim 2s ease-out forwards';
  }
}

// ════════════════════════════════════════════════════════
// REMOTE PLAYERS
// ════════════════════════════════════════════════════════
const rP=new Map();
const PCOLS=[0x5c7cfa,0xff6b6b,0xffd43b,0x20c997,0x74c0fc,0xf783ac,0xa9e34b,0xff922b];
let rpIdx=0;

function addRP(id,uname,ci,outfit={}){
  if(!scene)return;
  const g=new THREE.Group();
  const char=buildCharacter({shirtColor:PCOLS[ci%PCOLS.length],...outfit});
  g.add(char);
  const cv=document.createElement('canvas');cv.width=256;cv.height=52;
  const ctx=cv.getContext('2d');
  ctx.fillStyle='rgba(0,0,0,0.65)';ctx.roundRect(2,2,252,48,8);ctx.fill();
  ctx.fillStyle='#00f5d4';ctx.font='bold 24px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(uname.substring(0,14),128,26);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),depthTest:false}));
  sp.scale.set(2,0.44,1);sp.position.y=2.4;g.add(sp);
  scene.add(g);rP.set(id,{g,u:uname,health:20});
}
function moveRP(id,x,y,z,ry){const p=rP.get(id);if(p){p.g.position.set(x,y-PH,z);p.g.rotation.y=ry;}}
function removeRP(id){const p=rP.get(id);if(p&&scene){scene.remove(p.g);rP.delete(id);}}

// ════════════════════════════════════════════════════════
// HUD
// ════════════════════════════════════════════════════════
// Which resource backs each block slot for display
const SLOT_RES=['','dirt','dirt','stone','wood',null,'sand',null];
function getSlotCount(i){const r=SLOT_RES[i];return r?(inv[r]||0):0;}
function buildHotbar(){
  const hb=document.getElementById('hotbar');hb.innerHTML='';
  // Weapon slot
  const ws=document.createElement('div');ws.id='weapon-slot';ws.className='hslot weapon-sel';
  ws.innerHTML='<span style="font-size:1.4rem">✊</span><div style="font-size:0.55rem;color:rgba(255,255,255,0.6);margin-top:1px">Puños</div>';
  ws.title='Arma equipada — C para craftear';
  hb.appendChild(ws);
  // Block slots
  for(let i=1;i<=7;i++){
    const s=document.createElement('div');
    s.className='hslot'+(i===selBlock?' sel':'');s.id='hs'+i;
    const cnt=getSlotCount(i);
    const canPlace=BLOCK_COST[i]&&cnt>0;
    s.innerHTML=`<span class="num">${i}</span><div class="sw" style="background:${HCOL[i]};opacity:${canPlace||!BLOCK_COST[i]?1:0.35}"></div>`+
      (BLOCK_COST[i]?`<div class="hcount" style="color:${cnt>0?'#fff':'rgba(255,255,255,0.3)'}">${cnt}</div>`:`<div style="font-size:0.45rem;color:rgba(255,255,255,0.3)">∞</div>`);
    hb.appendChild(s);
  }
}
function updateHotbar(){
  for(let i=1;i<=7;i++){
    const s=document.getElementById('hs'+i);if(!s)continue;
    s.className='hslot'+(i===selBlock?' sel':'');
    const cnt=getSlotCount(i);
    const canPlace=BLOCK_COST[i]&&cnt>0;
    s.innerHTML=`<span class="num">${i}</span><div class="sw" style="background:${HCOL[i]};opacity:${canPlace||!BLOCK_COST[i]?1:0.35}"></div>`+
      (BLOCK_COST[i]?`<div class="hcount" style="color:${cnt>0?'#fff':'rgba(255,255,255,0.3)'}">${cnt}</div>`:`<div style="font-size:0.45rem;color:rgba(255,255,255,0.3)">∞</div>`);
  }
}
function updateHotbarCounts(){updateHotbar();}
function updateHealthbar(){
  const hb=document.getElementById('healthbar');if(!hb)return;hb.innerHTML='';
  for(let i=0;i<10;i++){const h=document.createElement('div');h.className='heart';h.textContent=i<Math.ceil(health/2)?'❤️':'🖤';hb.appendChild(h);}
}

// ════════════════════════════════════════════════════════
// CHAT
// ════════════════════════════════════════════════════════
function addMsg(name,msg,sys=false){
  const log=document.getElementById('chatlog');
  const d=document.createElement('div');d.className='cmsg'+(sys?' sys':'');
  d.innerHTML=sys?msg:`<span class="cn">${name}:</span> ${msg}`;
  log.appendChild(d);log.scrollTop=log.scrollHeight;
  if(log.children.length>40)log.children[0].remove();
}
function openChat(){
  if(chatOpen)return;chatOpen=true;
  document.getElementById('cinp-wrap').style.display='block';
  const inp=document.getElementById('cinp');
  document.exitPointerLock();inp.focus();
  inp.onkeydown=e=>{
    e.stopPropagation();
    if(e.key==='Enter'){
      const m=inp.value.trim();
      if(m&&ws&&ws.readyState===1){sendWS({type:'chat',message:m});addMsg(myUser,m);}
      inp.value='';closeChat();
    }
    if(e.key==='Escape'){inp.value='';closeChat();}
  };
}
function closeChat(){chatOpen=false;document.getElementById('cinp-wrap').style.display='none';resume();}

// ════════════════════════════════════════════════════════
// OVERLAYS
// ════════════════════════════════════════════════════════
function showPause(){document.getElementById('opause').style.display='flex';document.getElementById('prc2').textContent=myRoom?'Sala: '+myRoom:'';}
function openInvite(){
  document.exitPointerLock();
  document.getElementById('icode').textContent=myRoom||'------';
  const link=location.origin+location.pathname+'?sala='+(myRoom||'');
  document.getElementById('ilink').textContent=link;
  document.getElementById('oinvite').style.display='flex';
}
function openSettings(){document.exitPointerLock();document.getElementById('osettings').style.display='flex';}
function closeOverlay(id){document.getElementById(id).style.display='none';}
function anyOverlayOpen(){return['opause','oinvite','osettings'].some(id=>document.getElementById(id).style.display==='flex');}
function resume(){
  ['opause','oinvite','osettings'].forEach(closeOverlay);
  if(gameOn&&!craftOpen&&!backpackOpen)document.getElementById('canvas').requestPointerLock();
}
function copyInvLink(){
  const link=location.origin+location.pathname+'?sala='+(myRoom||'');
  navigator.clipboard.writeText(link).then(()=>{
    const btn=document.getElementById('copybtn');
    btn.textContent='✓ ¡Copiado!';btn.style.background='rgba(0,245,212,0.2)';
    setTimeout(()=>{btn.textContent='Copiar enlace';btn.style.background='';},2500);
  });
}

// ════════════════════════════════════════════════════════
// WEBSOCKET
// ════════════════════════════════════════════════════════
let ws,myId,myUser,myRoom,mvTimer=0;
let onlineFriendIds=new Set();
const sendWS=msg=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify(msg));};
const sendBlock=(x,y,z,t)=>sendWS({type:'block',x,y,z,blockType:t});
const sendMove=()=>{if(myId)sendWS({type:'move',x:camera.position.x,y:camera.position.y,z:camera.position.z,rx:pitch,ry:yaw});};

function setProgress(pct,text){
  document.getElementById('pbar').style.width=pct+'%';
  document.getElementById('lstatus').textContent=text;
}
function connect(username,roomCode,mode){
  setProgress(10,'Conectando al servidor…');
  initThree();
  ws=new WebSocket(WS_URL);
  ws.onopen=()=>{
    setProgress(30,'Entrando a la sala…');
    const _cape=getEquippedCape();
    const _outfitSend=_cape?{...currentOutfit,capeColor:_cape.color,capeLining:_cape.lining}:{...currentOutfit};
    sendWS({type:'join',username,roomCode:roomCode||null,userId:SESSION.id,mode,outfit:_outfitSend});
  };
  ws.onmessage=e=>{
    const msg=JSON.parse(e.data);
    if(msg.type==='init'){
      myId=msg.playerId;myRoom=msg.roomCode;
      if(msg.mode)gameMode=msg.mode;
      // Store personal spawn position from server
      if(typeof msg.spawnX==='number')mySpawnX=msg.spawnX;
      if(typeof msg.spawnZ==='number')mySpawnZ=msg.spawnZ;
      document.getElementById('rcdisp').textContent=myRoom;
      document.getElementById('prc2').textContent='Sala: '+myRoom;
      const url=new URL(location.href);url.searchParams.set('sala',myRoom);history.replaceState({},'',url);
      setProgress(55,'Generando terreno…');
      setTimeout(()=>{
        generateTerrain(msg.seed);
        msg.blocks.forEach(b=>sb(b.x,b.y,b.z,b.type));
        needsRebuild=true;
        setProgress(80,'Cargando jugadores…');
        msg.players.forEach(p=>{addRP(p.id,p.username,rpIdx++,p.outfit||{});moveRP(p.id,p.x,p.y,p.z,p.ry||0);});
        updatePCount();setProgress(100,'¡Listo!');setTimeout(startGame,400);
      },50);return;
    }
    if(msg.type==='error'){setProgress(0,'❌ '+msg.message);return;}
    if(msg.type==='playerJoin'){addRP(msg.id,msg.username,rpIdx++,msg.outfit||{});addMsg('',`✦ ${msg.username} entró`,true);updatePCount();}
    if(msg.type==='playerLeave'){const p=rP.get(msg.id);if(p)addMsg('',`✦ ${p.u} salió`,true);removeRP(msg.id);updatePCount();}
    if(msg.type==='playerMove'&&msg.id!==myId)moveRP(msg.id,msg.x,msg.y,msg.z,msg.ry||0);
    if(msg.type==='blockChange'){sb(msg.x,msg.y,msg.z,msg.blockType);needsRebuild=true;}
    if(msg.type==='chat')addMsg(msg.username,msg.message);
    if(msg.type==='attackHit'){
      receiveAttack(msg.damage,msg.fromName);
      if(health<=0)sendWS({type:'playerKilled',killerId:msg.fromId,killerName:msg.fromName,victimName:myUser});
    }
    if(msg.type==='killConfirm'){
      addKillFeed(msg.killerName,msg.victimName,msg.killerKills,msg.killsToWin);
      if(msg.killerName===myUser){myKills=msg.killerKills;updateKillDisplay();showKillFlash(msg.victimName);}
    }
    if(msg.type==='gameOver'){showGameOver(msg.winnerName,msg.kills);}
  };
  ws.onerror=()=>setProgress(0,'❌ Error de conexión. Intenta de nuevo.');
  ws.onclose=()=>{if(gameOn)addMsg('','⚠ Desconectado',true);};
}
function updatePCount(){document.getElementById('pcount').textContent=rP.size+1;}

// ════════════════════════════════════════════════════════
// GAME START + LOOP
// ════════════════════════════════════════════════════════
function startGame(){
  document.getElementById('loading').style.display='none';
  stopLobbyChar();
  buildHotbar();updateWeaponSlot();updateHealthbar();updateHungerBar();updateResourceHUD();setFog(gfog);

  // Use server-assigned spawn point
  const sx=mySpawnX,sz=mySpawnZ;
  let sy=H-1;while(sy>0&&gb(sx,sy,sz)===0)sy--;
  camera.position.set(sx+0.5,sy+PH+1.5,sz+0.5);

  ['canvas','xhair','hud','info','badge','chatbox','hint','res-hud'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    el.style.display=id==='hud'?'flex':id==='chatbox'?'block':'block';
  });
  const cm=document.getElementById('collect-msg');if(cm)cm.style.display='block';
  document.getElementById('topbtns').style.display='flex';
  document.getElementById('killfeed').style.display='flex';

  // Show/hide hunger bar based on mode
  const hbar=document.getElementById('hungerbar');
  if(hbar)hbar.style.display=gameMode==='survival'?'flex':'none';
  // Show kill counter in PvP
  const kc=document.getElementById('kill-counter');
  if(kc)kc.style.display=gameMode==='pvp'?'block':'none';
  if(gameMode==='pvp')updateKillDisplay();

  // Mode badge
  const mb=document.getElementById('modebadge');
  mb.style.display='block';
  if(gameMode==='pvp'){mb.className='modebadge pvp';mb.textContent='⚔ PVP — F atacar · C craftear · B mochila';}
  else{mb.className='modebadge surv';mb.textContent='🌿 SUPERVIVENCIA — Rompe bloques · C craftear · E comer · B mochila';}
  setTimeout(()=>mb.style.display='none',5000);

  document.getElementById('hint').innerHTML=
    'WASD Mover · Espacio Saltar<br>'+
    'Click izq. (hold) Romper<br>'+
    'Click der. Colocar bloque<br>'+
    '1-7 Elegir bloque · Rueda cambiar<br>'+
    'F Atacar · C Craftear<br>'+
    'B Mochila'+(gameMode==='survival'?' · E Comer':'')+
    '<br>P Perspectiva · T Chat · Esc Pausa';

  // Create local player mesh (shown in 3rd person)
  const cape=getEquippedCape();
  const outfit3p=cape?{...currentOutfit,capeColor:cape.color,capeLining:cape.lining}:{...currentOutfit};
  localPlayerMesh=buildCharacter(outfit3p);
  localPlayerMesh.visible=false;
  scene.add(localPlayerMesh);
  camMode=0;

  gameOn=true;
  document.getElementById('canvas').requestPointerLock();

  function loop(){
    requestAnimationFrame(loop);
    const dt=Math.min(clock.getDelta(),0.05);
    attackTimer=Math.max(0,attackTimer-dt);
    // Immunity timer
    if(immunityTimer>0){
      immunityTimer=Math.max(0,immunityTimer-dt);
      const ib=document.getElementById('immunity-border');
      if(ib)ib.style.opacity=Math.sin(Date.now()*0.014)>0?'1':'0';
      if(immunityTimer<=0&&ib)ib.style.opacity='0';
    }
    updatePhysics(dt);castRay();updateBreaking(dt);updateHunger(dt);
    if(needsRebuild)buildWorld();
    mvTimer+=dt;if(mvTimer>0.05){sendMove();mvTimer=0;}
    // Animate cape flames on local player mesh (3rd person)
    if(localPlayerMesh){
      const tF=Date.now()*0.001;
      localPlayerMesh.traverse(child=>{
        if(!child.userData.isFlame)return;
        const ph=child.userData.flamePhase;
        const s=Math.max(0.1,0.55+Math.sin(tF*3.1+ph)*0.38+Math.sin(tF*5.7+ph*1.3)*0.08);
        child.scale.y=s;
        child.position.y=child.userData.baseY+child.userData.flameH*(1-s)/2;
        child.rotation.z=Math.sin(tF*2.3+ph)*0.10;
      });
    }
    const p=camera.position;
    document.getElementById('info').innerHTML=
      `XYZ: ${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}<br>`+
      `Bloque: ${BNAME[selBlock]}`;
    renderer.render(scene,camera);
  }
  loop();
}

// ════════════════════════════════════════════════════════
// CAMERA PERSPECTIVE
// ════════════════════════════════════════════════════════
const CAM_LABELS=['👁 Primera persona','📷 Tercera · Detrás','🎥 Tercera · Frente'];
function cycleCamMode(){
  camMode=(camMode+1)%3;
  const el=document.getElementById('cam-mode-hud');
  if(el){
    el.textContent=CAM_LABELS[camMode];
    el.style.opacity='1';
    clearTimeout(el._t);
    el._t=setTimeout(()=>el.style.opacity='0',2000);
  }
}

// ════════════════════════════════════════════════════════
// LOBBY UI
// ════════════════════════════════════════════════════════
let selectedMode='pvp';

function switchTab(name){
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
  document.querySelector(`.tab-btn[data-tab="${name}"]`).classList.add('active');
  document.getElementById('tab-'+name).classList.add('active');
  if(name==='fr') fetchOnlineFriends();
  if(name==='inv') buildCapeShop();
}
function selectMode(mode){
  selectedMode=mode;gameMode=mode;
  document.querySelectorAll('.mode-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById('mc-'+mode).classList.add('selected');
}
function openRoomDialog(type){
  const d=document.getElementById(type==='create'?'dlg-create':'dlg-join');
  d.style.display='flex';
  if(type==='create')document.getElementById('cu').value=SESSION.username;
  else document.getElementById('ju').value=SESSION.username;
}
function closeDialog(id){document.getElementById(id).style.display='none';}
function doCreate(){
  const u=document.getElementById('cu').value.trim();
  if(!u){document.getElementById('cerr').textContent='Ingresa tu nombre';return;}
  document.getElementById('cerr').textContent='';
  myUser=u;closeDialog('dlg-create');
  document.getElementById('lobby').style.display='none';
  document.getElementById('loading').style.display='flex';
  connect(u,null,selectedMode);
}
function doJoin(){
  const u=document.getElementById('ju').value.trim();
  const c=document.getElementById('jc').value.trim().toUpperCase();
  if(!u){document.getElementById('jerr').textContent='Ingresa tu nombre';return;}
  if(c.length!==6){document.getElementById('jerr').textContent='El código debe tener 6 caracteres';return;}
  document.getElementById('jerr').textContent='';
  myUser=u;closeDialog('dlg-join');
  document.getElementById('lobby').style.display='none';
  document.getElementById('loading').style.display='flex';
  connect(u,c,selectedMode);
}

// Friends
function addFriend(){
  const id=document.getElementById('addid').value.trim().toUpperCase();
  const name=document.getElementById('addname').value.trim();
  const err=document.getElementById('adderr');
  if(id.length!==8){err.textContent='El ID debe tener 8 caracteres';return;}
  if(id===SESSION.id){err.textContent='No puedes agregarte a ti mismo';return;}
  const friends=getFriends();
  if(friends.find(f=>f.id===id)){err.textContent='Ya tienes este amigo';return;}
  err.textContent='';
  friends.push({id,name:name||'Amigo'});saveFriends(friends);
  document.getElementById('addid').value='';document.getElementById('addname').value='';
  renderFriendList();
}
function removeFriend(i){const f=getFriends();f.splice(i,1);saveFriends(f);renderFriendList();}
function fetchOnlineFriends(){
  fetch(API_BASE+'/api/game/online')
    .then(r=>r.json())
    .then(ids=>{onlineFriendIds=new Set(ids);renderFriendList();})
    .catch(()=>{});
}
function renderFriendList(){
  const fl=document.getElementById('friendlist');
  const friends=getFriends();
  if(!friends.length){fl.innerHTML='<div style="color:rgba(255,255,255,0.3);font-size:0.82rem;padding:20px;text-align:center">No tienes amigos agregados aún.</div>';return;}
  fl.innerHTML='';
  friends.forEach((f,i)=>{
    const online=onlineFriendIds.has(f.id);
    const d=document.createElement('div');d.className='friend-item';
    d.innerHTML=`<div class="fav">${f.name.charAt(0).toUpperCase()}</div>`+
      `<div class="finfo">`+
        `<div class="fn">${f.name} <span class="online-dot ${online?'on':'off'}" title="${online?'En línea':'Desconectado'}"></span></div>`+
        `<div class="fid2">ID: ${f.id}${online?' · 🟢 En línea':''}</div>`+
      `</div>`+
      `<button class="fdel" onclick="removeFriend(${i})">✕</button>`;
    fl.appendChild(d);
  });
}
function copyMyId(){navigator.clipboard.writeText(SESSION.id);}

// ── Cape shop ─────────────────────────────────────────────
function buyCape(id){
  const cape=CAPES.find(c=>c.id===id);if(!cape)return;
  const data=getCapeData()||{owned:[],equipped:null};
  if(data.owned.includes(id)){equipCape(id);return;}
  if(SESSION.credits<cape.price){
    showShopMsg('❌ Créditos insuficientes');return;
  }
  // Deduct credits
  SESSION.credits-=cape.price;
  try{const u=JSON.parse(localStorage.getItem('cw_user')||'{}');u.credits=SESSION.credits;localStorage.setItem('cw_user',JSON.stringify(u));}catch(_){}
  document.getElementById('credits-amount').textContent=SESSION.credits.toLocaleString();
  document.getElementById('inv-credits').textContent=SESSION.credits.toLocaleString();
  // Add to owned
  data.owned.push(id);data.equipped=id;saveCapeData(data);
  if(window._rebuildLobbyChar)window._rebuildLobbyChar();
  showShopMsg(`✓ ¡Capa ${cape.name} comprada y equipada!`);
  buildCapeShop();updateCharPanelLevel();
}
function equipCape(id){
  const data=getCapeData()||{owned:[],equipped:null};
  if(!data.owned.includes(id))return;
  data.equipped=id;saveCapeData(data);
  if(window._rebuildLobbyChar)window._rebuildLobbyChar();
  const cape=CAPES.find(c=>c.id===id);
  showShopMsg(`✓ Capa ${cape?.name||''} equipada`);
  buildCapeShop();
}
function removeCapeEquip(){
  const data=getCapeData()||{owned:[],equipped:null};
  data.equipped=null;saveCapeData(data);
  if(window._rebuildLobbyChar)window._rebuildLobbyChar();
  showShopMsg('Capa desequipada');buildCapeShop();
}
let shopMsgTimer=null;
function showShopMsg(msg){
  const el=document.getElementById('shop-msg');if(!el)return;
  el.textContent=msg;el.style.opacity='1';
  clearTimeout(shopMsgTimer);shopMsgTimer=setTimeout(()=>el.style.opacity='0',2500);
}
function buildCapeShop(){
  const grid=document.getElementById('cape-grid');if(!grid)return;
  const data=getCapeData()||{owned:[],equipped:null};
  const inv_credits_el=document.getElementById('inv-credits');
  if(inv_credits_el)inv_credits_el.textContent=SESSION.credits.toLocaleString();
  grid.innerHTML='';
  CAPES.forEach(cape=>{
    const owned=data.owned.includes(cape.id);
    const equipped=data.equipped===cape.id;
    const d=document.createElement('div');
    d.className='cape-card'+(equipped?' cape-equipped':'');
    d.innerHTML=`
      <div class="cape-preview" style="background:linear-gradient(160deg,${cape.hex} 55%,${cape.lin} 100%)">
        <div class="cape-inner" style="background:${cape.lin}"></div>
        ${equipped?'<div class="cape-check">✓</div>':''}
      </div>
      <div class="cape-name">${cape.name}</div>
      <button class="cape-btn ${equipped?'cape-btn-equip':owned?'cape-btn-equip':SESSION.credits>=cape.price?'cape-btn-buy':'cape-btn-disabled'}"
        onclick="${owned?`equipCape('${cape.id}')`:`buyCape('${cape.id}')`}"
        ${!owned&&SESSION.credits<cape.price?'disabled':''}>
        ${equipped?'✓ Equipada':owned?'Equipar':'🪙 '+cape.price+' créditos'}
      </button>`;
    grid.appendChild(d);
  });
  const removeRow=document.getElementById('cape-remove-row');
  if(removeRow)removeRow.style.display=data.equipped?'block':'none';
}

function buildInventory(){
  const cape=getEquippedCape();
  const slots=[
    {icon:'🪖',label:'Cabeza',  item:'Sin equipar',rarity:'common'},
    {icon:'👕',label:'Pecho',   item:'Camisa Común',rarity:'common'},
    {icon:'👖',label:'Piernas', item:'Pantalón Común',rarity:'common'},
    {icon:'👟',label:'Pies',    item:'Zapatos Comunes',rarity:'common'},
    {icon:'⚔️',label:'Arma',   item:'Puños',rarity:'common'},
    {icon:'🧣',label:'Capa',    item:cape?cape.name:'Sin capa',rarity:cape?'rare':'common'},
  ];
  const grid=document.getElementById('inv-grid');if(!grid)return;grid.innerHTML='';
  slots.forEach(s=>{
    const d=document.createElement('div');d.className='equip-slot';
    d.innerHTML=`<div class="rarity-dot ${s.rarity}"></div><div class="slot-icon">${s.icon}</div><div class="slot-label">${s.label}</div><div class="slot-item rarity-${s.rarity}">${s.item}</div>`;
    grid.appendChild(d);
  });
}

function updateCharPanelLevel(){
  const lv=getPlayerLevel(SESSION.credits);
  const el=document.getElementById('char-level');
  if(el)el.innerHTML=`<span style="color:${lv.color}">Lv.${lv.lv} ${lv.name}</span>`;
}

// Auto-detect ?sala= in URL
(function(){
  const sala=new URLSearchParams(location.search).get('sala');
  if(sala&&sala.length===6){openRoomDialog('join');document.getElementById('jc').value=sala.toUpperCase();}
})();

window.addEventListener('load',()=>{
  document.getElementById('char-name').textContent=SESSION.username;
  document.getElementById('char-id').textContent='ID: '+SESSION.id;
  document.getElementById('credits-amount').textContent=SESSION.credits.toLocaleString();
  document.getElementById('myidshow').textContent=SESSION.id;
  document.getElementById('play-greeting').innerHTML=`Bienvenido, <span>${SESSION.username}</span>`;
  updateCharPanelLevel();
  // Stats
  const bestKills=parseInt(localStorage.getItem('vw_best_kills')||'0');
  const totalGames=parseInt(localStorage.getItem('vw_total_games')||'0');
  const el_kills=document.getElementById('stat-kills');if(el_kills)el_kills.textContent=bestKills;
  const el_games=document.getElementById('stat-games');if(el_games)el_games.textContent=totalGames;
  // Cape display
  const equCape=getEquippedCape();
  const capeEl=document.getElementById('char-cape');
  if(capeEl)capeEl.textContent=equCape?`🧣 Capa ${equCape.name}`:'Sin capa';
  const statCape=document.getElementById('stat-cape');
  if(statCape)statCape.textContent=equCape?equCape.name:'—';
  selectMode('pvp');
  fetchOnlineFriends();
  setInterval(fetchOnlineFriends,30000);
  renderFriendList();
  buildInventory();
  buildCapeShop();
  setTimeout(initLobbyChar,100);
});

// (fetchOnlineFriends & buildCapeShop are called directly from switchTab above)
