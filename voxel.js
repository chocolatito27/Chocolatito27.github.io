// ════════════════════════════════════════════════════════
// voxel.js — VoxelWorld game engine + lobby logic
// ════════════════════════════════════════════════════════

// ── CONFIG ──────────────────────────────────────────────
const WS_URL = 'wss://385fd47d-e4b4-4453-981e-7afca555f923-00-9lnnok86qrfn.picard.replit.dev/api/game/ws';
const W = 64, H = 64, D = 64;        // world size (tiles)
const GRAV   = -20;                   // blocks/s²  (Minecraft ≈ -20)
const JUMP   =  7;                    // blocks/s → reaches ~1.25 blocks high
const SPEED  =  4.3;                  // blocks/s walking
const REACH  =  6.5;                  // block-break reach in blocks
const PH     =  1.8;                  // player height
const PW     =  0.3;                  // player half-width (0.6 wide total)
const STEP_H =  0.6;                  // max auto-step height (< 1 block)
const FOG_DISTS = [18, 32, 48, 68, 90];

let gsens = 0.0025;
let gfog  = 3;

// ── SESSION ─────────────────────────────────────────────
const SESSION = { username: 'Invitado', id: '????????' };
try {
  const s = JSON.parse(localStorage.getItem('cw_user') || '{}');
  if (s.username) SESSION.username = s.username;
  if (s.id)       SESSION.id       = s.id;
} catch (_) {}

// ── FRIENDS ─────────────────────────────────────────────
const getFriends  = () => { try { return JSON.parse(localStorage.getItem('vw_friends') || '[]'); } catch { return []; } };
const saveFriends = f => localStorage.setItem('vw_friends', JSON.stringify(f));

// ════════════════════════════════════════════════════════
// BLOCK DATA
// ════════════════════════════════════════════════════════
const BNAME     = ['', 'Pasto', 'Tierra', 'Piedra', 'Madera', 'Hojas', 'Arena', 'Cristal'];
const HCOL      = ['', '#4CAF50', '#8B6914', '#707070', '#6B4226', '#2D7D32', '#D4B483', '#ADD8E6'];
// Break time in seconds per block type
const BREAK_DUR = [0,  0.75,     0.5,      2.0,      1.2,      0.25,    0.55,    0.45];
// RGB colours: top / side / bottom
const BCOL = [
  null,
  { t:[0.29,0.66,0.29], s:[0.52,0.36,0.13], b:[0.45,0.31,0.10] }, // Grass
  { t:[0.53,0.37,0.13], s:[0.51,0.36,0.12], b:[0.48,0.34,0.10] }, // Dirt
  { t:[0.49,0.49,0.50], s:[0.44,0.44,0.45], b:[0.40,0.40,0.41] }, // Stone
  { t:[0.59,0.44,0.22], s:[0.42,0.27,0.11], b:[0.55,0.41,0.20] }, // Wood
  { t:[0.20,0.52,0.22], s:[0.19,0.50,0.21], b:[0.17,0.46,0.18] }, // Leaves
  { t:[0.84,0.72,0.51], s:[0.83,0.71,0.50], b:[0.80,0.68,0.47] }, // Sand
  { t:[0.62,0.82,0.94], s:[0.60,0.80,0.92], b:[0.56,0.76,0.88] }, // Glass
];

function bCol(type, face) {
  const b = BCOL[type]; if (!b) return [1, 1, 1];
  if (face === 't') return b.t;
  if (face === 'b') return b.b;
  return b.s;
}

// ════════════════════════════════════════════════════════
// WORLD ARRAY
// ════════════════════════════════════════════════════════
const world = new Uint8Array(W * H * D);
const wi  = (x, y, z) => x + W * (y + H * z);
const gb  = (x, y, z) => { if (x<0||x>=W||y<0||y>=H||z<0||z>=D) return 1; return world[wi(x,y,z)]; };
const sb  = (x, y, z, t) => { if (x<0||x>=W||y<0||y>=H||z<0||z>=D) return; world[wi(x,y,z)] = t; };

// ── Terrain noise helpers ────────────────────────────────
function n2(x, z, s) {
  const v = Math.sin(x * 127.1 + z * 311.7 + s * 74.2) * 43758.5453;
  return v - Math.floor(v);
}
function sn(x, z, sc, s) {
  const ix = Math.floor(x/sc), iz = Math.floor(z/sc);
  const fx = (x/sc)-ix, fz = (z/sc)-iz;
  const ux = fx*fx*(3-2*fx), uz = fz*fz*(3-2*fz);
  return n2(ix,iz,s)*(1-ux)*(1-uz) + n2(ix+1,iz,s)*ux*(1-uz)
       + n2(ix,iz+1,s)*(1-ux)*uz   + n2(ix+1,iz+1,s)*ux*uz;
}
function terrHeight(x, z, seed) {
  return Math.floor(
    18 + sn(x,z,28,seed)*12 + sn(x,z,14,seed+1)*6
       + sn(x,z,7,seed+2)*3  + sn(x,z,3,seed+3)*1.5
  );
}

function generateTerrain(seed) {
  world.fill(0);
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    const h    = Math.min(terrHeight(x, z, seed), H - 8);
    const sand = h <= 20;
    for (let y = 0; y <= h; y++) {
      if (sand)        sb(x,y,z,6);
      else if (y < h-4) sb(x,y,z,3);
      else if (y < h)   sb(x,y,z,2);
      else              sb(x,y,z,1);
    }
    // Trees — only on grass, not on edges
    if (!sand && h > 22 && x>3 && x<W-4 && z>3 && z<D-4 && n2(x*3.7,z*2.9,seed+5) > 0.88) {
      const trunk = 4 + Math.floor(n2(x,z,seed+3)*3);
      for (let ty = 1; ty <= trunk; ty++) if (h+ty < H) sb(x,h+ty,z,4);
      for (let lx=-2;lx<=2;lx++) for (let lz=-2;lz<=2;lz++) for (let ly=trunk-1;ly<=trunk+1;ly++) {
        if (Math.abs(lx)+Math.abs(lz) <= 3 && h+ly < H && gb(x+lx,h+ly,z+lz)===0)
          sb(x+lx,h+ly,z+lz,5);
      }
    }
  }
}

// ════════════════════════════════════════════════════════
// THREE.JS SCENE
// ════════════════════════════════════════════════════════
let scene, camera, renderer, wMesh, wMat, hlBox, clock;
let needsRebuild = true;

/*
 * Correct CCW face winding — each face's 4 vertices are ordered so that
 * the polygon is front-facing (CCW in NDC) when viewed from OUTSIDE the block.
 * Triangles: [0,1,2] and [0,2,3] from the quad.
 *
 * Verified via cross-product: normal = (v1-v0)×(v2-v0) must point outward.
 *   Top    [0,1,0]:  (0,1,1)→(1,1,1)→(1,1,0)→(0,1,0)   n=+Y ✓
 *   Bottom [0,-1,0]: (0,0,0)→(1,0,0)→(1,0,1)→(0,0,1)   n=-Y ✓
 *   Front  [0,0,1]:  (0,0,1)→(1,0,1)→(1,1,1)→(0,1,1)   n=+Z ✓
 *   Back   [0,0,-1]: (1,0,0)→(0,0,0)→(0,1,0)→(1,1,0)   n=-Z ✓
 *   Right  [1,0,0]:  (1,0,1)→(1,0,0)→(1,1,0)→(1,1,1)   n=+X ✓
 *   Left   [-1,0,0]: (0,0,0)→(0,0,1)→(0,1,1)→(0,1,0)   n=-X ✓
 */
const FACES = [
  { d:[0, 1,0], c:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]], f:'t', bri:1.00 },
  { d:[0,-1,0], c:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]], f:'b', bri:0.55 },
  { d:[0, 0,1], c:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]], f:'s', bri:0.80 },
  { d:[0, 0,-1],c:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]], f:'s', bri:0.85 },
  { d:[1, 0,0], c:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]], f:'s', bri:0.82 },
  { d:[-1,0,0], c:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]], f:'s', bri:0.78 },
];

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  setFog(gfog);

  camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.05, 220);

  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('canvas'),
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));

  clock = new THREE.Clock();

  // Lighting — sun + fill light mimics Minecraft
  scene.add(new THREE.AmbientLight(0xffffff, 0.38));
  const sun = new THREE.DirectionalLight(0xfffaee, 0.95);
  sun.position.set(0.6, 1, 0.5).normalize();
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8090cc, 0.14);
  fill.position.set(-0.5, -0.5, -0.5).normalize();
  scene.add(fill);

  // One shared material — FrontSide (winding is correct so no need for DoubleSide)
  wMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.FrontSide });

  // Block-selection wireframe box
  const hg = new THREE.BoxGeometry(1.005, 1.005, 1.005);
  const hm = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.4 });
  hlBox = new THREE.Mesh(hg, hm);
  hlBox.visible = false;
  scene.add(hlBox);

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

function setFog(v) {
  gfog = parseInt(v);
  if (!scene) return;
  const fd = FOG_DISTS[gfog - 1];
  scene.fog = new THREE.Fog(0x87ceeb, fd * 0.35, fd);
}

function buildWorld() {
  if (wMesh) { scene.remove(wMesh); wMesh.geometry.dispose(); }
  const pos=[], col=[], nor=[], idx=[];
  let vi = 0;
  for (let x=0;x<W;x++) for (let y=0;y<H;y++) for (let z=0;z<D;z++) {
    const bt = gb(x,y,z); if (!bt) continue;
    const hshade = 0.6 + (y/H)*0.4; // underground darkening
    for (const fc of FACES) {
      if (gb(x+fc.d[0], y+fc.d[1], z+fc.d[2]) !== 0) continue;
      const bc = bCol(bt, fc.f);
      const shade = fc.bri * hshade;
      for (const [cx,cy,cz] of fc.c) {
        pos.push(x+cx, y+cy, z+cz);
        col.push(bc[0]*shade, bc[1]*shade, bc[2]*shade);
        nor.push(fc.d[0], fc.d[1], fc.d[2]);
      }
      idx.push(vi,vi+1,vi+2, vi,vi+2,vi+3);
      vi += 4;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color',    new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal',   new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  wMesh = new THREE.Mesh(g, wMat);
  scene.add(wMesh);
  needsRebuild = false;
}

// ════════════════════════════════════════════════════════
// COLLISION — proper AABB vs voxel grid
// ════════════════════════════════════════════════════════
function playerHitsAny(px, foot, pz) {
  const x0 = Math.floor(px - PW),  x1 = Math.floor(px + PW);
  const y0 = Math.floor(foot),      y1 = Math.floor(foot + PH - 0.01);
  const z0 = Math.floor(pz - PW),   z1 = Math.floor(pz + PW);
  for (let bx=x0;bx<=x1;bx++) for (let by=y0;by<=y1;by++) for (let bz=z0;bz<=z1;bz++) {
    if (gb(bx,by,bz) !== 0) return true;
  }
  return false;
}

// ════════════════════════════════════════════════════════
// CONTROLS STATE
// ════════════════════════════════════════════════════════
const keys = {};
let velY     = 0;
let onGround = false;
let locked   = false;
let yaw      = 0;
let pitch    = 0;
let selBlock = 1;
let gameOn   = false;
let chatOpen = false;
let tgtB     = null;  // block being looked at
let tgtF     = null;  // face in front of tgtB (place position)
let health   = 20;
let mouseHeld = false;

// Block-breaking state
const breaking = { active: false, x:-1, y:-1, z:-1, progress: 0, duration: 1 };

// ── Input listeners ─────────────────────────────────────
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (!gameOn || chatOpen) return;
  if (e.code === 'KeyT') { openChat(); e.preventDefault(); return; }
  if (e.code === 'Escape') {
    if (anyOverlayOpen()) { resume(); return; }
  }
  const n = parseInt(e.key);
  if (n >= 1 && n <= 7) { selBlock = n; updateHotbar(); }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

document.addEventListener('mousemove', e => {
  if (!locked || chatOpen) return;
  yaw   -= e.movementX * gsens;
  pitch  = Math.max(-Math.PI/2 + 0.02, Math.min(Math.PI/2 - 0.02, pitch - e.movementY * gsens));
});
document.addEventListener('mousedown', e => {
  if (e.button === 0) mouseHeld = true;
  if (!locked || chatOpen) return;
  if (e.button === 2) placeBlock();
});
document.addEventListener('mouseup', e => {
  if (e.button === 0) {
    mouseHeld = false;
    breaking.active = false;
    breaking.progress = 0;
    document.getElementById('breakwrap').style.display = 'none';
  }
});
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('wheel', e => {
  if (!locked) return;
  selBlock += e.deltaY > 0 ? 1 : -1;
  if (selBlock < 1) selBlock = 7;
  if (selBlock > 7) selBlock = 1;
  updateHotbar();
}, { passive: true });

document.getElementById('canvas').addEventListener('click', () => {
  if (gameOn && !anyOverlayOpen()) document.getElementById('canvas').requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  locked = !!document.pointerLockElement;
  if (gameOn && !anyOverlayOpen() && !locked) showPause();
});

// ════════════════════════════════════════════════════════
// PHYSICS UPDATE
// ════════════════════════════════════════════════════════
function updatePhysics(dt) {
  if (!locked || chatOpen) return;

  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const rgt = new THREE.Vector3( Math.cos(yaw), 0, -Math.sin(yaw));
  const mv  = new THREE.Vector3();

  if (keys['KeyW'] || keys['ArrowUp'])    mv.add(fwd);
  if (keys['KeyS'] || keys['ArrowDown'])  mv.sub(fwd);
  if (keys['KeyA'] || keys['ArrowLeft'])  mv.sub(rgt);
  if (keys['KeyD'] || keys['ArrowRight']) mv.add(rgt);
  if (mv.lengthSq() > 0) mv.normalize().multiplyScalar(SPEED * dt);

  if (keys['Space'] && onGround) { velY = JUMP; onGround = false; }

  let px   = camera.position.x;
  let foot = camera.position.y - PH;
  let pz   = camera.position.z;

  // ── X movement (with auto-step) ──
  if (mv.x !== 0) {
    const nx = px + mv.x;
    if (!playerHitsAny(nx, foot, pz)) {
      px = nx;
    } else if (onGround && !playerHitsAny(nx, foot + STEP_H, pz)) {
      px = nx; foot += STEP_H; velY = 0; // step up
    }
  }
  // ── Z movement (with auto-step) ──
  if (mv.z !== 0) {
    const nz = pz + mv.z;
    if (!playerHitsAny(px, foot, nz)) {
      pz = nz;
    } else if (onGround && !playerHitsAny(px, foot + STEP_H, nz)) {
      pz = nz; foot += STEP_H; velY = 0;
    }
  }

  // ── Y movement (gravity) ──
  velY += GRAV * dt;
  const newFoot = foot + velY * dt;
  if (!playerHitsAny(px, newFoot, pz)) {
    foot = newFoot;
    if (velY < 0) onGround = false;
  } else {
    if (velY < 0) {
      onGround = true;
      // Fall damage: only for falls > ~4 blocks (velY < -11)
      if (velY < -11) takeDamage(Math.floor((-velY - 11) / 3.5));
    }
    velY = 0;
  }

  // World bounds + fall-out-of-world reset
  px   = Math.max(PW + 0.01, Math.min(W - PW - 0.01, px));
  pz   = Math.max(PW + 0.01, Math.min(D - PW - 0.01, pz));
  if (foot < -5) { respawn(); return; }

  camera.position.set(px, foot + PH, pz);
  camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
}

// ════════════════════════════════════════════════════════
// BLOCK BREAKING (hold to break)
// ════════════════════════════════════════════════════════
function updateBreaking(dt) {
  if (!mouseHeld || !locked || chatOpen || !tgtB) {
    if (breaking.active) {
      breaking.active = false; breaking.progress = 0;
      document.getElementById('breakwrap').style.display = 'none';
    }
    return;
  }

  const { x, y, z } = tgtB;

  if (breaking.active && breaking.x===x && breaking.y===y && breaking.z===z) {
    breaking.progress += dt;
    const pct = Math.min(breaking.progress / breaking.duration, 1);
    document.getElementById('breakprog').style.width = (pct * 100) + '%';

    if (breaking.progress >= breaking.duration) {
      // Block fully broken
      sb(x, y, z, 0);
      needsRebuild = true;
      sendBlock(x, y, z, 0);
      breaking.active   = false;
      breaking.progress = 0;
      document.getElementById('breakwrap').style.display = 'none';
    }
  } else {
    // Start breaking new block
    breaking.active   = true;
    breaking.x = x; breaking.y = y; breaking.z = z;
    breaking.progress = 0;
    breaking.duration = BREAK_DUR[gb(x, y, z)] || 0.75;
    document.getElementById('breakwrap').style.display = 'block';
    document.getElementById('breakprog').style.width = '0%';
  }
}

// ════════════════════════════════════════════════════════
// RAYCAST
// ════════════════════════════════════════════════════════
function castRay() {
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  let px = camera.position.x, py = camera.position.y, pz = camera.position.z;
  let lx = -1, ly = -1, lz = -1;
  const step = 0.04;
  for (let i = 0; i < REACH / step; i++) {
    const bx = Math.floor(px), by = Math.floor(py), bz = Math.floor(pz);
    if (gb(bx, by, bz) !== 0) {
      tgtB = { x:bx, y:by, z:bz };
      tgtF = { x:lx, y:ly, z:lz };
      hlBox.position.set(bx+0.5, by+0.5, bz+0.5);
      hlBox.visible = true;
      return;
    }
    lx=bx; ly=by; lz=bz;
    px+=dir.x*step; py+=dir.y*step; pz+=dir.z*step;
  }
  tgtB = null; hlBox.visible = false;
  if (breaking.active) {
    breaking.active = false; breaking.progress = 0;
    document.getElementById('breakwrap').style.display = 'none';
  }
}

function placeBlock() {
  if (!tgtF || tgtF.x < 0) return;
  const { x, y, z } = tgtF;
  if (x<0||x>=W||y<0||y>=H||z<0||z>=D) return;
  const p = camera.position;
  // Don't place inside player
  if (Math.abs(x+0.5-p.x)<0.4 && y >= p.y-PH-0.1 && y < p.y+0.1 && Math.abs(z+0.5-p.z)<0.4) return;
  sb(x, y, z, selBlock);
  needsRebuild = true;
  sendBlock(x, y, z, selBlock);
}

// ════════════════════════════════════════════════════════
// HEALTH
// ════════════════════════════════════════════════════════
function takeDamage(dmg) {
  health = Math.max(0, health - dmg);
  updateHealthbar();
  if (health <= 0) { addMsg('', '💀 Caíste… reapareciendo', true); setTimeout(respawn, 1500); }
}
function respawn() {
  health = 20; updateHealthbar();
  let sy = H - 1;
  const sx = Math.floor(W/2), sz = Math.floor(D/2);
  while (sy > 0 && gb(sx, sy, sz) === 0) sy--;
  camera.position.set(sx + 0.5, sy + PH + 1.5, sz + 0.5);
  velY = 0;
}

// ════════════════════════════════════════════════════════
// REMOTE PLAYERS
// ════════════════════════════════════════════════════════
const rP   = new Map();
const PCOLS = [0x5c7cfa,0xff6b6b,0xffd43b,0x20c997,0x74c0fc,0xf783ac,0xa9e34b,0xff922b];
let rpIdx  = 0;

function addRP(id, uname, ci) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.95, 0.35),
    new THREE.MeshLambertMaterial({ color: PCOLS[ci % PCOLS.length] })
  );
  body.position.y = 0.475; g.add(body);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.55, 0.55),
    new THREE.MeshLambertMaterial({ color: 0xffcc99 })
  );
  head.position.y = 1.23; g.add(head);
  const cv = document.createElement('canvas'); cv.width=256; cv.height=52;
  const ctx = cv.getContext('2d');
  ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.roundRect(2,2,252,48,8); ctx.fill();
  ctx.fillStyle='#00f5d4'; ctx.font='bold 26px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(uname.substring(0,14), 128, 26);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(cv), depthTest:false }));
  sp.scale.set(2, 0.44, 1); sp.position.y = 2.1; g.add(sp);
  scene.add(g);
  rP.set(id, { g, u: uname });
}
function moveRP(id, x, y, z, ry) { const p=rP.get(id); if(p) { p.g.position.set(x,y-PH,z); p.g.rotation.y=ry; } }
function removeRP(id)            { const p=rP.get(id); if(p) { scene.remove(p.g); rP.delete(id); } }

// ════════════════════════════════════════════════════════
// HUD
// ════════════════════════════════════════════════════════
function buildHotbar() {
  const hb = document.getElementById('hotbar'); hb.innerHTML = '';
  for (let i = 1; i <= 7; i++) {
    const s = document.createElement('div');
    s.className = 'hslot' + (i===selBlock?' sel':''); s.id = 'hs'+i;
    s.innerHTML = `<span class="num">${i}</span><div class="sw" style="background:${HCOL[i]}"></div><div>${BNAME[i]}</div>`;
    hb.appendChild(s);
  }
}
function updateHotbar() { for(let i=1;i<=7;i++){const s=document.getElementById('hs'+i);if(s)s.className='hslot'+(i===selBlock?' sel':'');} }
function updateHealthbar() {
  const hb = document.getElementById('healthbar'); hb.innerHTML='';
  for (let i=0;i<10;i++) { const h=document.createElement('div'); h.className='heart'; h.textContent=i<Math.ceil(health/2)?'❤️':'🖤'; hb.appendChild(h); }
}

// ════════════════════════════════════════════════════════
// CHAT
// ════════════════════════════════════════════════════════
function addMsg(name, msg, sys=false) {
  const log = document.getElementById('chatlog');
  const d = document.createElement('div'); d.className='cmsg'+(sys?' sys':'');
  d.innerHTML = sys ? msg : `<span class="cn">${name}:</span> ${msg}`;
  log.appendChild(d); log.scrollTop = log.scrollHeight;
  if (log.children.length > 40) log.children[0].remove();
}
function openChat() {
  if (chatOpen) return; chatOpen = true;
  document.getElementById('cinp-wrap').style.display='block';
  const inp = document.getElementById('cinp');
  document.exitPointerLock(); inp.focus();
  inp.onkeydown = e => {
    e.stopPropagation();
    if (e.key==='Enter') {
      const m = inp.value.trim();
      if (m && ws && ws.readyState===1) { ws.send(JSON.stringify({type:'chat',message:m})); addMsg(myUser,m); }
      inp.value=''; closeChat();
    }
    if (e.key==='Escape') { inp.value=''; closeChat(); }
  };
}
function closeChat() { chatOpen=false; document.getElementById('cinp-wrap').style.display='none'; resume(); }

// ════════════════════════════════════════════════════════
// OVERLAY / PAUSE HELPERS
// ════════════════════════════════════════════════════════
function showPause() {
  document.getElementById('opause').style.display='flex';
  document.getElementById('prc2').textContent = myRoom ? 'Sala: '+myRoom : '';
}
function openInvite() {
  document.exitPointerLock();
  document.getElementById('icode').textContent = myRoom || '------';
  const link = location.origin + location.pathname + '?sala=' + (myRoom||'');
  document.getElementById('ilink').textContent = link;
  document.getElementById('oinvite').style.display='flex';
  // Friend list inside invite
  const fl = document.getElementById('friendinvlist'); fl.innerHTML='';
  const friends = getFriends();
  if (friends.length) {
    fl.innerHTML='<div style="font-size:0.74rem;color:rgba(255,255,255,0.4);margin-bottom:8px">Comparte el enlace con tus amigos:</div>';
    friends.forEach(f=>{
      const d=document.createElement('div');
      d.style.cssText='display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;background:rgba(255,255,255,0.04);margin-bottom:4px';
      d.innerHTML=`<span style="flex:1;font-size:0.82rem">${f.name}</span><span style="font-size:0.68rem;color:rgba(255,255,255,0.4);font-family:monospace">${f.id}</span>`;
      fl.appendChild(d);
    });
  }
}
function openSettings() {
  document.exitPointerLock();
  document.getElementById('osettings').style.display='flex';
}
function closeOverlay(id) { document.getElementById(id).style.display='none'; }
function anyOverlayOpen() { return ['opause','oinvite','osettings'].some(id=>document.getElementById(id).style.display==='flex'); }
function resume() {
  ['opause','oinvite','osettings'].forEach(closeOverlay);
  if (gameOn) document.getElementById('canvas').requestPointerLock();
}
function copyInvLink() {
  const link = location.origin + location.pathname + '?sala=' + (myRoom||'');
  navigator.clipboard.writeText(link).then(()=>{
    const btn=document.getElementById('copybtn');
    btn.textContent='✓ ¡Copiado!'; btn.style.background='rgba(0,245,212,0.25)';
    setTimeout(()=>{ btn.textContent='Copiar enlace de invitación'; btn.style.background=''; }, 2500);
  });
}

// ════════════════════════════════════════════════════════
// WEBSOCKET
// ════════════════════════════════════════════════════════
let ws, myId, myUser, myRoom, mvTimer=0;

function sendBlock(x,y,z,t) { if(ws&&ws.readyState===1) ws.send(JSON.stringify({type:'block',x,y,z,blockType:t})); }
function sendMove()         { if(ws&&ws.readyState===1&&myId) ws.send(JSON.stringify({type:'move',x:camera.position.x,y:camera.position.y,z:camera.position.z,rx:pitch,ry:yaw})); }

function setProgress(pct, text) {
  document.getElementById('pbar').style.width   = pct + '%';
  document.getElementById('lstatus').textContent = text;
}

function connect(username, roomCode) {
  setProgress(10, 'Conectando al servidor…');
  ws = new WebSocket(WS_URL);
  ws.onopen = () => {
    setProgress(30, 'Entrando a la sala…');
    ws.send(JSON.stringify({ type:'join', username, roomCode: roomCode||null, userId: SESSION.id }));
  };
  ws.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'init') {
      myId = msg.playerId; myRoom = msg.roomCode;
      document.getElementById('rcdisp').textContent = myRoom;
      document.getElementById('prc2').textContent   = 'Sala: ' + myRoom;
      const url = new URL(location.href);
      url.searchParams.set('sala', myRoom);
      history.replaceState({}, '', url);
      setProgress(55, 'Generando terreno…');
      setTimeout(() => {
        generateTerrain(msg.seed);
        msg.blocks.forEach(b => sb(b.x,b.y,b.z,b.type));
        needsRebuild = true;
        setProgress(80, 'Cargando jugadores…');
        msg.players.forEach(p => { addRP(p.id,p.username,rpIdx++); moveRP(p.id,p.x,p.y,p.z,p.ry||0); });
        updatePCount();
        setProgress(100, '¡Listo!');
        setTimeout(startGame, 400);
      }, 50);
      return;
    }
    if (msg.type==='playerJoin')  { addRP(msg.id,msg.username,rpIdx++); addMsg('',`✦ ${msg.username} entró al mundo`,true); updatePCount(); }
    if (msg.type==='playerLeave') { const p=rP.get(msg.id); if(p) addMsg('',`✦ ${p.u} salió del mundo`,true); removeRP(msg.id); updatePCount(); }
    if (msg.type==='playerMove' && msg.id!==myId) moveRP(msg.id,msg.x,msg.y,msg.z,msg.ry||0);
    if (msg.type==='blockChange') { sb(msg.x,msg.y,msg.z,msg.blockType); needsRebuild=true; }
    if (msg.type==='chat')        addMsg(msg.username, msg.message);
  };
  ws.onerror = () => setProgress(0, '❌ Error de conexión. Intenta de nuevo.');
  ws.onclose = () => { if(gameOn) addMsg('','⚠ Desconectado del servidor',true); };
}
function updatePCount() { document.getElementById('pcount').textContent = rP.size + 1; }

// ════════════════════════════════════════════════════════
// GAME START + MAIN LOOP
// ════════════════════════════════════════════════════════
function startGame() {
  initThree();    // must be first — creates camera, renderer, clock
  buildHotbar();
  updateHealthbar();
  setFog(gfog);

  // Spawn on terrain surface at world centre
  const sx = Math.floor(W/2), sz = Math.floor(D/2);
  let sy = H - 1;
  while (sy > 0 && gb(sx,sy,sz)===0) sy--;
  camera.position.set(sx+0.5, sy + PH + 1.5, sz+0.5);

  document.getElementById('loading').style.display   = 'none';
  document.getElementById('canvas').style.display    = 'block';
  document.getElementById('xhair').style.display     = 'block';
  document.getElementById('hud').style.display       = 'flex';
  document.getElementById('info').style.display      = 'block';
  document.getElementById('badge').style.display     = 'block';
  document.getElementById('topbtns').style.display   = 'flex';
  document.getElementById('chatbox').style.display   = 'block';
  document.getElementById('hint').style.display      = 'block';
  gameOn = true;

  document.getElementById('canvas').requestPointerLock();

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);

    updatePhysics(dt);
    castRay();
    updateBreaking(dt);
    if (needsRebuild) buildWorld();

    // Send position ~20/s
    mvTimer += dt;
    if (mvTimer > 0.05) { sendMove(); mvTimer = 0; }

    // Top-left debug info
    const p = camera.position;
    document.getElementById('info').textContent =
      `XYZ: ${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}\nBloque: ${BNAME[selBlock]}`;

    renderer.render(scene, camera);
  }
  loop();
}

// ════════════════════════════════════════════════════════
// LOBBY UI
// ════════════════════════════════════════════════════════
function show(id) {
  ['smain','splay','screate','sjoin','sfriends','slobbyset'].forEach(x =>
    document.getElementById(x).style.display = x===id ? 'block' : 'none'
  );
}
const showPlay         = () => show('splay');
const showFriends      = () => { show('sfriends'); renderFriendList(); };
const showLobbySettings= () => show('slobbyset');

function showCreate() {
  show('screate');
  document.getElementById('cu').value = SESSION.username;
}
function showJoin() {
  show('sjoin');
  document.getElementById('ju').value = SESSION.username;
}

function initLobby() {
  document.getElementById('pname').textContent  = SESSION.username;
  document.getElementById('ppid').textContent   = 'ID: ' + SESSION.id;
  document.getElementById('pavatar').textContent = SESSION.username.charAt(0).toUpperCase();
  document.getElementById('myidshow').textContent= SESSION.id;
}
function copyMyId() {
  navigator.clipboard.writeText(SESSION.id).then(()=>{
    const el=document.getElementById('myidshow'); el.style.color='#fff';
    setTimeout(()=>el.style.color='#00f5d4',1500);
  });
}

// ── Friends ──────────────────────────────────────────────
function friendTab(t) {
  document.getElementById('fview-list').style.display = t==='list'?'block':'none';
  document.getElementById('fview-add').style.display  = t==='add' ?'block':'none';
  document.getElementById('ftab-list').className = t==='list'?'active':'';
  document.getElementById('ftab-add').className  = t==='add' ?'active':'';
}
function renderFriendList() {
  const fl = document.getElementById('friendlist');
  const friends = getFriends();
  if (!friends.length) { fl.innerHTML='<div class="empty-friends">No tienes amigos agregados.<br>Agrega con su ID de 8 dígitos.</div>'; return; }
  fl.innerHTML='';
  friends.forEach((f,i)=>{
    const d=document.createElement('div'); d.className='fitem';
    d.innerHTML=`<div class="fa">${f.name.charAt(0).toUpperCase()}</div><div><div class="fn">${f.name}</div><div class="fid">ID: ${f.id}</div></div><button class="fdel" onclick="removeFriend(${i})">✕</button>`;
    fl.appendChild(d);
  });
}
function addFriend() {
  const id   = document.getElementById('addid').value.trim().toUpperCase();
  const name = document.getElementById('addname').value.trim();
  const err  = document.getElementById('adderr');
  if (id.length !== 8)  { err.textContent='El ID debe tener 8 caracteres'; return; }
  if (id === SESSION.id) { err.textContent='No puedes agregarte a ti mismo'; return; }
  const friends = getFriends();
  if (friends.find(f=>f.id===id)) { err.textContent='Ya tienes este amigo'; return; }
  err.textContent='';
  friends.push({ id, name: name||'Amigo' });
  saveFriends(friends);
  document.getElementById('addid').value='';
  document.getElementById('addname').value='';
  friendTab('list'); renderFriendList();
}
function removeFriend(i) { const f=getFriends(); f.splice(i,1); saveFriends(f); renderFriendList(); }

function saveLobbySettings() {
  gsens = document.getElementById('ls-sens').value / 2000;
  gfog  = parseInt(document.getElementById('ls-fog').value);
  show('smain');
}

// ── Create / Join ─────────────────────────────────────────
function doCreate() {
  const u = document.getElementById('cu').value.trim();
  if (!u) { document.getElementById('cerr').textContent='Ingresa tu nombre'; return; }
  document.getElementById('cerr').textContent='';
  myUser = u;
  document.getElementById('lobby').style.display  = 'none';
  document.getElementById('loading').style.display = 'flex';
  connect(u, null);
}
function doJoin() {
  const u = document.getElementById('ju').value.trim();
  const c = document.getElementById('jc').value.trim().toUpperCase();
  if (!u)        { document.getElementById('jerr').textContent='Ingresa tu nombre'; return; }
  if (c.length!==6){ document.getElementById('jerr').textContent='El código debe tener 6 caracteres'; return; }
  document.getElementById('jerr').textContent='';
  myUser = u;
  document.getElementById('lobby').style.display  = 'none';
  document.getElementById('loading').style.display = 'flex';
  connect(u, c);
}

// ════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════
initLobby();

// Auto-detect ?sala= in URL
(function() {
  const sala = new URLSearchParams(location.search).get('sala');
  if (sala && sala.length===6) {
    showJoin();
    document.getElementById('jc').value = sala.toUpperCase();
  }
})();
