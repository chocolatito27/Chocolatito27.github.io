// ════════════════════════════════════════════════════════
// voxel.js — VoxelWorld: lobby, engine, physics, combat
// ════════════════════════════════════════════════════════

// ── CONFIG ──────────────────────────────────────────────
const WS_URL    = 'wss://385fd47d-e4b4-4453-981e-7afca555f923-00-9lnnok86qrfn.picard.replit.dev/api/game/ws';
const W=64, H=64, D=64;
const GRAV=-20, JUMP=7, SPEED=4.3, REACH=6.5, PH=1.8, PW=0.3, STEP_H=0.55;
const FOG_DISTS=[18,32,48,68,90];
const ATTACK_RANGE=2.5, ATTACK_COOLDOWN=0.6;
let gsens=0.0025, gfog=3;

// ── SESSION ─────────────────────────────────────────────
const SESSION={username:'Jugador',id:'????????',credits:0};
try{
  const s=JSON.parse(localStorage.getItem('cw_user')||'{}');
  if(s.username) SESSION.username=s.username;
  if(s.id)       SESSION.id=s.id;
  if(s.credits)  SESSION.credits=parseInt(s.credits)||0;
}catch(_){}

// ── FRIENDS ─────────────────────────────────────────────
const getFriends  =()=>{try{return JSON.parse(localStorage.getItem('vw_friends')||'[]');}catch{return[];}};
const saveFriends =f=>localStorage.setItem('vw_friends',JSON.stringify(f));

// ── OUTFIT (default common) ──────────────────────────────
const DEFAULT_OUTFIT={
  shirtColor:0x3a6abf, pantsColor:0x1e2e5c,
  shoesColor:0x1a1a1a, hairColor:0x3d2b1f,
  skinColor:0xffcc99,  name:'Conjunto Común',rarity:'common'
};
let currentOutfit={...DEFAULT_OUTFIT};

// ── GAME MODE ────────────────────────────────────────────
let gameMode='pvp'; // 'pvp' | 'survival'

// ════════════════════════════════════════════════════════
// BLOCK DATA
// ════════════════════════════════════════════════════════
const BNAME    =['','Pasto','Tierra','Piedra','Madera','Hojas','Arena','Cristal'];
const HCOL     =['','#4CAF50','#8B6914','#707070','#6B4226','#2D7D32','#D4B483','#ADD8E6'];
const BREAK_DUR=[0, 0.75, 0.5, 2.0, 1.2, 0.25, 0.55, 0.45];
const BCOL=[
  null,
  {t:[0.29,0.66,0.29],s:[0.52,0.36,0.13],b:[0.45,0.31,0.10]},
  {t:[0.53,0.37,0.13],s:[0.51,0.36,0.12],b:[0.48,0.34,0.10]},
  {t:[0.49,0.49,0.50],s:[0.44,0.44,0.45],b:[0.40,0.40,0.41]},
  {t:[0.59,0.44,0.22],s:[0.42,0.27,0.11],b:[0.55,0.41,0.20]},
  {t:[0.20,0.52,0.22],s:[0.19,0.50,0.21],b:[0.17,0.46,0.18]},
  {t:[0.84,0.72,0.51],s:[0.83,0.71,0.50],b:[0.80,0.68,0.47]},
  {t:[0.62,0.82,0.94],s:[0.60,0.80,0.92],b:[0.56,0.76,0.88]},
];
function bCol(type,face){const b=BCOL[type];if(!b)return[1,1,1];return face==='t'?b.t:face==='b'?b.b:b.s;}

// ════════════════════════════════════════════════════════
// WORLD
// ════════════════════════════════════════════════════════
const world=new Uint8Array(W*H*D);
const wi =(x,y,z)=>x+W*(y+H*z);
const gb =(x,y,z)=>{if(x<0||x>=W||y<0||y>=H||z<0||z>=D)return 1;return world[wi(x,y,z)];};
const sb =(x,y,z,t)=>{if(x<0||x>=W||y<0||y>=H||z<0||z>=D)return;world[wi(x,y,z)]=t;};

function n2(x,z,s){const v=Math.sin(x*127.1+z*311.7+s*74.2)*43758.5453;return v-Math.floor(v);}
function sn(x,z,sc,s){
  const ix=Math.floor(x/sc),iz=Math.floor(z/sc),fx=(x/sc)-ix,fz=(z/sc)-iz;
  const ux=fx*fx*(3-2*fx),uz=fz*fz*(3-2*fz);
  return n2(ix,iz,s)*(1-ux)*(1-uz)+n2(ix+1,iz,s)*ux*(1-uz)+n2(ix,iz+1,s)*(1-ux)*uz+n2(ix+1,iz+1,s)*ux*uz;
}
function terrHeight(x,z,seed){
  return Math.floor(18+sn(x,z,28,seed)*12+sn(x,z,14,seed+1)*6+sn(x,z,7,seed+2)*3+sn(x,z,3,seed+3)*1.5);
}
function generateTerrain(seed){
  world.fill(0);
  for(let x=0;x<W;x++) for(let z=0;z<D;z++){
    const h=Math.min(terrHeight(x,z,seed),H-8);
    const sand=h<=20;
    for(let y=0;y<=h;y++){
      if(sand) sb(x,y,z,6);
      else if(y<h-4) sb(x,y,z,3);
      else if(y<h)   sb(x,y,z,2);
      else           sb(x,y,z,1);
    }
    if(!sand&&h>22&&x>3&&x<W-4&&z>3&&z<D-4&&n2(x*3.7,z*2.9,seed+5)>0.88){
      const trunk=4+Math.floor(n2(x,z,seed+3)*3);
      for(let ty=1;ty<=trunk;ty++) if(h+ty<H) sb(x,h+ty,z,4);
      for(let lx=-2;lx<=2;lx++) for(let lz=-2;lz<=2;lz++) for(let ly=trunk-1;ly<=trunk+1;ly++)
        if(Math.abs(lx)+Math.abs(lz)<=3&&h+ly<H&&gb(x+lx,h+ly,z+lz)===0) sb(x+lx,h+ly,z+lz,5);
    }
  }
}

// ════════════════════════════════════════════════════════
// THREE.JS — SCENE & RENDERING
// ════════════════════════════════════════════════════════
let scene,camera,renderer,wMesh,wMat,hlBox,clock;
let needsRebuild=true;

// Corrected CCW winding — normals all point outward (verified via cross product)
const FACES=[
  {d:[0, 1,0],c:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],f:'t',bri:1.00},  // top
  {d:[0,-1,0],c:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],f:'b',bri:0.55},  // bottom
  {d:[0, 0,1],c:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]],f:'s',bri:0.80},  // front
  {d:[0, 0,-1],c:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]],f:'s',bri:0.85}, // back
  {d:[1, 0,0],c:[[1,0,1],[1,0,0],[1,1,0],[1,1,1]],f:'s',bri:0.82},  // right
  {d:[-1,0,0],c:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],f:'s',bri:0.78},  // left
];

function initThree(){
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x87ceeb);
  setFog(gfog);
  camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,0.05,220);
  renderer=new THREE.WebGLRenderer({canvas:document.getElementById('canvas'),antialias:false,powerPreference:'high-performance'});
  renderer.setSize(innerWidth,innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  clock=new THREE.Clock();
  scene.add(new THREE.AmbientLight(0xffffff,0.38));
  const sun=new THREE.DirectionalLight(0xfffaee,0.95); sun.position.set(0.6,1,0.5).normalize(); scene.add(sun);
  const fill=new THREE.DirectionalLight(0x8090cc,0.14); fill.position.set(-0.5,-0.5,-0.5).normalize(); scene.add(fill);
  wMat=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.FrontSide});
  const hg=new THREE.BoxGeometry(1.005,1.005,1.005);
  const hm=new THREE.MeshBasicMaterial({color:0x000000,wireframe:true,transparent:true,opacity:0.38});
  hlBox=new THREE.Mesh(hg,hm); hlBox.visible=false; scene.add(hlBox);
  window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
}
function setFog(v){
  gfog=parseInt(v);
  if(!scene) return;
  const fd=FOG_DISTS[gfog-1];
  scene.fog=new THREE.Fog(0x87ceeb,fd*0.35,fd);
}
function buildWorld(){
  if(wMesh){scene.remove(wMesh);wMesh.geometry.dispose();}
  const pos=[],col=[],nor=[],idx=[];
  let vi=0;
  for(let x=0;x<W;x++) for(let y=0;y<H;y++) for(let z=0;z<D;z++){
    const bt=gb(x,y,z); if(!bt) continue;
    const hshade=0.6+(y/H)*0.4;
    for(const fc of FACES){
      if(gb(x+fc.d[0],y+fc.d[1],z+fc.d[2])!==0) continue;
      const bc=bCol(bt,fc.f), shade=fc.bri*hshade;
      for(const[cx,cy,cz]of fc.c){pos.push(x+cx,y+cy,z+cz);col.push(bc[0]*shade,bc[1]*shade,bc[2]*shade);nor.push(fc.d[0],fc.d[1],fc.d[2]);}
      idx.push(vi,vi+1,vi+2,vi,vi+2,vi+3); vi+=4;
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  g.setIndex(idx);
  wMesh=new THREE.Mesh(g,wMat); scene.add(wMesh); needsRebuild=false;
}

// ════════════════════════════════════════════════════════
// CHARACTER BUILDER (shared by lobby preview & in-game)
// ════════════════════════════════════════════════════════
function buildCharacter(outfit={}){
  const o={...DEFAULT_OUTFIT,...outfit};
  const g=new THREE.Group();
  const mat=c=>new THREE.MeshLambertMaterial({color:c});

  // Head
  const head=new THREE.Mesh(new THREE.BoxGeometry(0.52,0.56,0.52),mat(o.skinColor));
  head.position.y=1.63; g.add(head);
  // Hair
  const hair=new THREE.Mesh(new THREE.BoxGeometry(0.54,0.22,0.54),mat(o.hairColor));
  hair.position.y=1.96; g.add(hair);
  // Ears
  [-1,1].forEach(s=>{const ear=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.16,0.16),mat(o.skinColor));ear.position.set(s*0.29,1.63,0);g.add(ear);});
  // Torso
  const torso=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.72,0.32),mat(o.shirtColor));
  torso.position.y=0.98; g.add(torso);
  // Arms
  [-1,1].forEach(s=>{
    const arm=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.62,0.28),mat(o.shirtColor));
    arm.position.set(s*0.45,0.98,0); g.add(arm);
    const hand=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.16,0.26),mat(o.skinColor));
    hand.position.set(s*0.45,0.65,0); g.add(hand);
  });
  // Legs
  [-1,1].forEach(s=>{
    const leg=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.72,0.28),mat(o.pantsColor));
    leg.position.set(s*0.16,0.36,0); g.add(leg);
  });
  // Shoes
  [-1,1].forEach(s=>{
    const shoe=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.13,0.34),mat(o.shoesColor));
    shoe.position.set(s*0.16,0.0,0.02); g.add(shoe);
  });
  return g;
}

// ════════════════════════════════════════════════════════
// LOBBY — 3D CHARACTER PREVIEW
// ════════════════════════════════════════════════════════
let lobbyRenderer,lobbyScene,lobbyChar,lobbyAnimId;

function initLobbyChar(){
  const canvas=document.getElementById('charcanvas');
  lobbyScene=new THREE.Scene();
  const cam=new THREE.PerspectiveCamera(42,canvas.width/canvas.height,0.1,50);
  cam.position.set(0,1.5,4.2); cam.lookAt(0,1,0);
  lobbyRenderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  lobbyRenderer.setSize(canvas.width,canvas.height);
  lobbyRenderer.setClearColor(0x000000,0);
  lobbyScene.add(new THREE.AmbientLight(0xffffff,0.5));
  const kl=new THREE.DirectionalLight(0x00f5d4,1.1); kl.position.set(1,2,2); lobbyScene.add(kl);
  const fl=new THREE.DirectionalLight(0xffffff,0.4); fl.position.set(-1,0,2); lobbyScene.add(fl);
  // Platform
  const plat=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,0.08,32),new THREE.MeshLambertMaterial({color:0x1a1a3e}));
  plat.position.y=-0.04; lobbyScene.add(plat);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.1,0.04,8,32),new THREE.MeshBasicMaterial({color:0x00f5d4,transparent:true,opacity:0.5}));
  ring.rotation.x=Math.PI/2; ring.position.y=0.0; lobbyScene.add(ring);
  // Character
  lobbyChar=buildCharacter(currentOutfit); lobbyScene.add(lobbyChar);
  function animateLobby(){
    lobbyAnimId=requestAnimationFrame(animateLobby);
    lobbyChar.rotation.y+=0.007;
    // Subtle float
    lobbyChar.position.y=Math.sin(Date.now()*0.0015)*0.04;
    lobbyRenderer.render(lobbyScene,cam);
  }
  animateLobby();
}

function stopLobbyChar(){
  if(lobbyAnimId) cancelAnimationFrame(lobbyAnimId);
  if(lobbyRenderer) lobbyRenderer.dispose();
}

// ════════════════════════════════════════════════════════
// COLLISION
// ════════════════════════════════════════════════════════
function playerHitsAny(px,foot,pz){
  const x0=Math.floor(px-PW),x1=Math.floor(px+PW);
  const y0=Math.floor(foot),  y1=Math.floor(foot+PH-0.01);
  const z0=Math.floor(pz-PW), z1=Math.floor(pz+PW);
  for(let bx=x0;bx<=x1;bx++) for(let by=y0;by<=y1;by++) for(let bz=z0;bz<=z1;bz++)
    if(gb(bx,by,bz)!==0) return true;
  return false;
}

// ════════════════════════════════════════════════════════
// CONTROLS STATE
// ════════════════════════════════════════════════════════
const keys={};
let velY=0,onGround=false,locked=false,yaw=0,pitch=0;
let selBlock=1,gameOn=false,chatOpen=false;
let tgtB=null,tgtF=null,health=20,mouseHeld=false;
let attackTimer=0;
const breaking={active:false,x:-1,y:-1,z:-1,progress:0,duration:1};

document.addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(!gameOn||chatOpen) return;
  if(e.code==='KeyT'){openChat();e.preventDefault();return;}
  if(e.code==='Escape'){if(anyOverlayOpen()){resume();return;}}
  if(e.code==='KeyF') tryMeleeAttack();
  const n=parseInt(e.key);
  if(n>=1&&n<=7){selBlock=n;updateHotbar();}
});
document.addEventListener('keyup',e=>{keys[e.code]=false;});
document.addEventListener('mousemove',e=>{
  if(!locked||chatOpen) return;
  yaw-=e.movementX*gsens;
  pitch=Math.max(-Math.PI/2+0.02,Math.min(Math.PI/2-0.02,pitch-e.movementY*gsens));
});
document.addEventListener('mousedown',e=>{
  if(e.button===0) mouseHeld=true;
  if(!locked||chatOpen) return;
  if(e.button===2) placeBlock();
});
document.addEventListener('mouseup',e=>{
  if(e.button!==0) return;
  mouseHeld=false; breaking.active=false; breaking.progress=0;
  document.getElementById('breakwrap').style.display='none';
});
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('wheel',e=>{
  if(!locked) return;
  selBlock+=e.deltaY>0?1:-1;
  if(selBlock<1) selBlock=7; if(selBlock>7) selBlock=1;
  updateHotbar();
},{passive:true});
document.getElementById('canvas').addEventListener('click',()=>{
  if(gameOn&&!anyOverlayOpen()) document.getElementById('canvas').requestPointerLock();
});
document.addEventListener('pointerlockchange',()=>{
  locked=!!document.pointerLockElement;
  if(gameOn&&!anyOverlayOpen()&&!locked) showPause();
});

// ════════════════════════════════════════════════════════
// PHYSICS
// ════════════════════════════════════════════════════════
function updatePhysics(dt){
  if(!locked||chatOpen) return;
  const fwd=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  const rgt=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const mv=new THREE.Vector3();
  if(keys['KeyW']||keys['ArrowUp'])    mv.add(fwd);
  if(keys['KeyS']||keys['ArrowDown'])  mv.sub(fwd);
  if(keys['KeyA']||keys['ArrowLeft'])  mv.sub(rgt);
  if(keys['KeyD']||keys['ArrowRight']) mv.add(rgt);
  if(mv.lengthSq()>0) mv.normalize().multiplyScalar(SPEED*dt);
  if(keys['Space']&&onGround){velY=JUMP;onGround=false;}

  let px=camera.position.x, foot=camera.position.y-PH, pz=camera.position.z;

  // X (auto-step)
  if(mv.x!==0){
    const nx=px+mv.x;
    if(!playerHitsAny(nx,foot,pz)) px=nx;
    else if(onGround&&!playerHitsAny(nx,foot+STEP_H,pz)){px=nx;foot+=STEP_H;velY=0;}
  }
  // Z (auto-step)
  if(mv.z!==0){
    const nz=pz+mv.z;
    if(!playerHitsAny(px,foot,nz)) pz=nz;
    else if(onGround&&!playerHitsAny(px,foot+STEP_H,nz)){pz=nz;foot+=STEP_H;velY=0;}
  }
  // Y (gravity)
  velY+=GRAV*dt;
  const nf=foot+velY*dt;
  if(!playerHitsAny(px,nf,pz)){foot=nf;if(velY<0)onGround=false;}
  else{if(velY<0){onGround=true;if(velY<-11)takeDamage(Math.floor((-velY-11)/3.5));}velY=0;}

  px=Math.max(PW+0.01,Math.min(W-PW-0.01,px));
  pz=Math.max(PW+0.01,Math.min(D-PW-0.01,pz));
  if(foot<-5){respawn();return;}
  camera.position.set(px,foot+PH,pz);
  camera.quaternion.setFromEuler(new THREE.Euler(pitch,yaw,0,'YXZ'));
}

// ════════════════════════════════════════════════════════
// BLOCK BREAKING (hold left-click)
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
      sb(x,y,z,0);needsRebuild=true;sendBlock(x,y,z,0);
      breaking.active=false;breaking.progress=0;
      document.getElementById('breakwrap').style.display='none';
    }
  }else{
    breaking.active=true;breaking.x=x;breaking.y=y;breaking.z=z;
    breaking.progress=0;breaking.duration=BREAK_DUR[gb(x,y,z)]||0.75;
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

function placeBlock(){
  if(!tgtF||tgtF.x<0) return;
  const{x,y,z}=tgtF;
  if(x<0||x>=W||y<0||y>=H||z<0||z>=D) return;
  const p=camera.position;
  if(Math.abs(x+0.5-p.x)<0.4&&y>=p.y-PH-0.1&&y<p.y+0.1&&Math.abs(z+0.5-p.z)<0.4) return;
  sb(x,y,z,selBlock);needsRebuild=true;sendBlock(x,y,z,selBlock);
}

// ════════════════════════════════════════════════════════
// COMBAT (PvP)
// ════════════════════════════════════════════════════════
function tryMeleeAttack(){
  if(gameMode!=='pvp') return;
  if(attackTimer>0) return;
  attackTimer=ATTACK_COOLDOWN;
  const myPos=camera.position;
  let closest=null,closestDist=ATTACK_RANGE;
  rP.forEach((p,id)=>{
    const d=myPos.distanceTo(p.g.position.clone().setY(myPos.y));
    if(d<closestDist){closestDist=d;closest=id;}
  });
  if(closest){
    const dmg=3+Math.floor(Math.random()*3);
    sendWS({type:'attack',targetId:closest,damage:dmg});
    showHitEffect();
    addMsg('',`⚔ Golpeaste a ${rP.get(closest).u} (-${dmg}❤)`,true);
  }
}
function showHitEffect(){
  const el=document.createElement('div');
  el.style.cssText='position:fixed;inset:0;pointer-events:none;background:rgba(255,60,60,0.18);z-index:999;animation:fade .25s ease forwards';
  document.body.appendChild(el);setTimeout(()=>el.remove(),250);
  if(!document.querySelector('#hitanim')){
    const s=document.createElement('style');s.id='hitanim';
    s.textContent='@keyframes fade{from{opacity:1}to{opacity:0}}';document.head.appendChild(s);
  }
}
function receiveAttack(damage,fromName){
  takeDamage(damage);
  showHitEffect();
  addMsg('',`⚔ ${fromName} te golpeó (-${damage}❤)`,true);
}
function addKillFeed(killer,victim){
  const kf=document.getElementById('killfeed');
  const d=document.createElement('div');d.className='kf-item';
  d.innerHTML=`<b>${killer}</b> eliminó a <b>${victim}</b>`;
  kf.appendChild(d);setTimeout(()=>d.remove(),3200);
}

// ════════════════════════════════════════════════════════
// HEALTH
// ════════════════════════════════════════════════════════
function takeDamage(dmg){
  health=Math.max(0,health-dmg);updateHealthbar();
  if(health<=0){addMsg('','💀 Fuiste eliminado… reapareciendo',true);setTimeout(respawn,1500);}
}
function respawn(){
  health=20;updateHealthbar();
  const sx=Math.floor(W/2)+Math.floor(Math.random()*10-5);
  const sz=Math.floor(D/2)+Math.floor(Math.random()*10-5);
  let sy=H-1;
  while(sy>0&&gb(sx,sy,sz)===0) sy--;
  camera.position.set(sx+0.5,sy+PH+1.5,sz+0.5);
  velY=0;
}

// ════════════════════════════════════════════════════════
// REMOTE PLAYERS
// ════════════════════════════════════════════════════════
const rP=new Map();
const PCOLS=[0x5c7cfa,0xff6b6b,0xffd43b,0x20c997,0x74c0fc,0xf783ac,0xa9e34b,0xff922b];
let rpIdx=0;

function addRP(id,uname,ci,outfit={}){
  const g=new THREE.Group();
  const char=buildCharacter({shirtColor:PCOLS[ci%PCOLS.length],...outfit});
  g.add(char);
  // Name tag
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
function removeRP(id){const p=rP.get(id);if(p){scene.remove(p.g);rP.delete(id);}}

// ════════════════════════════════════════════════════════
// HUD
// ════════════════════════════════════════════════════════
function buildHotbar(){
  const hb=document.getElementById('hotbar');hb.innerHTML='';
  for(let i=1;i<=7;i++){
    const s=document.createElement('div');
    s.className='hslot'+(i===selBlock?' sel':'');s.id='hs'+i;
    s.innerHTML=`<span class="num">${i}</span><div class="sw" style="background:${HCOL[i]}"></div><div>${BNAME[i]}</div>`;
    hb.appendChild(s);
  }
}
function updateHotbar(){for(let i=1;i<=7;i++){const s=document.getElementById('hs'+i);if(s)s.className='hslot'+(i===selBlock?' sel':'');}}
function updateHealthbar(){
  const hb=document.getElementById('healthbar');hb.innerHTML='';
  for(let i=0;i<10;i++){const h=document.createElement('div');h.className='heart';h.textContent=i<Math.ceil(health/2)?'❤️':'🖤';hb.appendChild(h);}
}

// ════════════════════════════════════════════════════════
// CHAT
// ════════════════════════════════════════════════════════
function addMsg(name,msg,sys=false,pvp=false){
  const log=document.getElementById('chatlog');
  const d=document.createElement('div');d.className='cmsg'+(sys?' sys':'')+(pvp?' pvp-kill':'');
  d.innerHTML=sys?msg:`<span class="cn">${name}:</span> ${msg}`;
  log.appendChild(d);log.scrollTop=log.scrollHeight;
  if(log.children.length>40) log.children[0].remove();
}
function openChat(){
  if(chatOpen) return;chatOpen=true;
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
  if(gameOn) document.getElementById('canvas').requestPointerLock();
}
function copyInvLink(){
  const link=location.origin+location.pathname+'?sala='+(myRoom||'');
  navigator.clipboard.writeText(link).then(()=>{
    const btn=document.getElementById('copybtn');
    btn.textContent='✓ ¡Copiado!';btn.style.background='rgba(0,245,212,0.2)';
    setTimeout(()=>{btn.textContent='Copiar enlace de invitación';btn.style.background='';},2500);
  });
}

// ════════════════════════════════════════════════════════
// WEBSOCKET
// ════════════════════════════════════════════════════════
let ws,myId,myUser,myRoom,mvTimer=0;
const sendWS=msg=>{if(ws&&ws.readyState===1) ws.send(JSON.stringify(msg));};
const sendBlock=(x,y,z,t)=>sendWS({type:'block',x,y,z,blockType:t});
const sendMove=()=>{if(myId) sendWS({type:'move',x:camera.position.x,y:camera.position.y,z:camera.position.z,rx:pitch,ry:yaw});};

function setProgress(pct,text){
  document.getElementById('pbar').style.width=pct+'%';
  document.getElementById('lstatus').textContent=text;
}
function connect(username,roomCode,mode){
  setProgress(10,'Conectando al servidor…');
  ws=new WebSocket(WS_URL);
  ws.onopen=()=>{
    setProgress(30,'Entrando a la sala…');
    sendWS({type:'join',username,roomCode:roomCode||null,userId:SESSION.id,mode});
  };
  ws.onmessage=e=>{
    const msg=JSON.parse(e.data);
    if(msg.type==='init'){
      myId=msg.playerId;myRoom=msg.roomCode;
      if(msg.mode) gameMode=msg.mode;
      document.getElementById('rcdisp').textContent=myRoom;
      document.getElementById('prc2').textContent='Sala: '+myRoom;
      const url=new URL(location.href);url.searchParams.set('sala',myRoom);history.replaceState({},'',url);
      setProgress(55,'Generando terreno…');
      setTimeout(()=>{
        generateTerrain(msg.seed);
        msg.blocks.forEach(b=>sb(b.x,b.y,b.z,b.type));
        needsRebuild=true;
        setProgress(80,'Cargando jugadores…');
        msg.players.forEach(p=>{addRP(p.id,p.username,rpIdx++);moveRP(p.id,p.x,p.y,p.z,p.ry||0);});
        updatePCount();setProgress(100,'¡Listo!');setTimeout(startGame,400);
      },50);return;
    }
    if(msg.type==='playerJoin'){addRP(msg.id,msg.username,rpIdx++);addMsg('',`✦ ${msg.username} entró`,true);updatePCount();}
    if(msg.type==='playerLeave'){const p=rP.get(msg.id);if(p)addMsg('',`✦ ${p.u} salió`,true);removeRP(msg.id);updatePCount();}
    if(msg.type==='playerMove'&&msg.id!==myId) moveRP(msg.id,msg.x,msg.y,msg.z,msg.ry||0);
    if(msg.type==='blockChange'){sb(msg.x,msg.y,msg.z,msg.blockType);needsRebuild=true;}
    if(msg.type==='chat') addMsg(msg.username,msg.message);
    if(msg.type==='attackHit'){
      receiveAttack(msg.damage,msg.fromName);
      // If we died, notify attacker
      if(health<=0) sendWS({type:'playerKilled',killerId:msg.fromId,killerName:msg.fromName,victimName:myUser});
    }
    if(msg.type==='killConfirm') addKillFeed(msg.killerName,msg.victimName);
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
  initThree();buildHotbar();updateHealthbar();setFog(gfog);

  const sx=Math.floor(W/2),sz=Math.floor(D/2);
  let sy=H-1;while(sy>0&&gb(sx,sy,sz)===0) sy--;
  camera.position.set(sx+0.5,sy+PH+1.5,sz+0.5);

  // Show game elements
  ['canvas','xhair','hud','info','badge','chatbox','hint'].forEach(id=>{
    const el=document.getElementById(id);
    el.style.display=id==='hud'?'flex':id==='chatbox'?'block':'block';
  });
  document.getElementById('topbtns').style.display='flex';
  document.getElementById('killfeed').style.display='flex';

  // Mode badge
  const mb=document.getElementById('modebadge');
  mb.style.display='block';
  if(gameMode==='pvp'){mb.className='modebadge pvp';mb.textContent='⚔ MODO PVP — F para atacar';}
  else{mb.className='modebadge surv';mb.textContent='🌿 MODO SUPERVIVENCIA';}
  setTimeout(()=>mb.style.display='none',4000);

  // Update hint
  document.getElementById('hint').innerHTML=
    'WASD — Mover<br>Espacio — Saltar<br>Click izq. (hold) — Romper<br>Click der. — Colocar<br>1-7 — Bloque<br>Rueda — Cambiar<br>'
    +(gameMode==='pvp'?'F — Atacar jugador<br>':'')+
    'T — Chat<br>Esc — Pausa';

  gameOn=true;
  document.getElementById('canvas').requestPointerLock();

  function loop(){
    requestAnimationFrame(loop);
    const dt=Math.min(clock.getDelta(),0.05);
    attackTimer=Math.max(0,attackTimer-dt);
    updatePhysics(dt);castRay();updateBreaking(dt);
    if(needsRebuild) buildWorld();
    mvTimer+=dt;if(mvTimer>0.05){sendMove();mvTimer=0;}
    const p=camera.position;
    document.getElementById('info').textContent=`XYZ: ${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}\nBloque: ${BNAME[selBlock]}`;
    renderer.render(scene,camera);
  }
  loop();
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
}

function selectMode(mode){
  selectedMode=mode;gameMode=mode;
  document.querySelectorAll('.mode-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById('mc-'+mode).classList.add('selected');
}

function openRoomDialog(type){
  const d=document.getElementById(type==='create'?'dlg-create':'dlg-join');
  d.style.display='flex';
  if(type==='create') document.getElementById('cu').value=SESSION.username;
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
function renderFriendList(){
  const fl=document.getElementById('friendlist');
  const friends=getFriends();
  if(!friends.length){fl.innerHTML='<div style="color:rgba(255,255,255,0.3);font-size:0.82rem;padding:20px;text-align:center">No tienes amigos agregados aún.</div>';return;}
  fl.innerHTML='';
  friends.forEach((f,i)=>{
    const d=document.createElement('div');d.className='friend-item';
    d.innerHTML=`<div class="fav">${f.name.charAt(0).toUpperCase()}</div><div class="finfo"><div class="fn">${f.name}</div><div class="fid2">ID: ${f.id}</div></div><button class="fdel" onclick="removeFriend(${i})">✕</button>`;
    fl.appendChild(d);
  });
}
function copyMyId(){
  navigator.clipboard.writeText(SESSION.id).then(()=>{
    const el=document.getElementById('myidshow');el.style.color='#fff';
    setTimeout(()=>el.style.color='#00f5d4',1500);
  });
}
function saveLobbySettings(){
  gsens=document.getElementById('ls-sens').value/2000;
  gfog=parseInt(document.getElementById('ls-fog').value);
}

// Inventory tab (static for now, ready for shop integration)
function buildInventory(){
  const slots=[
    {icon:'🪖',label:'Cabeza',item:'Casco Común',rarity:'common'},
    {icon:'👕',label:'Pecho',item:'Camisa Común',rarity:'common'},
    {icon:'👖',label:'Piernas',item:'Pantalón Común',rarity:'common'},
    {icon:'👟',label:'Pies',item:'Zapatos Comunes',rarity:'common'},
    {icon:'⚔️',label:'Arma',item:'Puños',rarity:'common'},
    {icon:'🎒',label:'Mochila',item:'—',rarity:'common'},
  ];
  const grid=document.getElementById('inv-grid');grid.innerHTML='';
  slots.forEach(s=>{
    const d=document.createElement('div');d.className='equip-slot';
    d.innerHTML=`<div class="rarity-dot ${s.rarity}"></div><div class="slot-icon">${s.icon}</div><div class="slot-label">${s.label}</div><div class="slot-item rarity-${s.rarity}">${s.item}</div>`;
    grid.appendChild(d);
  });
}

// ════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════
function initLobby(){
  document.getElementById('char-name').textContent=SESSION.username;
  document.getElementById('char-id').textContent='ID: '+SESSION.id;
  document.getElementById('credits-amount').textContent=SESSION.credits.toLocaleString();
  document.getElementById('myidshow').textContent=SESSION.id;
  document.getElementById('play-greeting').innerHTML=`Bienvenido, <span>${SESSION.username}</span>`;
  selectMode('pvp');
  renderFriendList();
  buildInventory();
  // Init lobby 3D character after a short delay (Three.js must be loaded)
  setTimeout(initLobbyChar,100);
}

// Auto-detect ?sala= in URL
(function(){
  const sala=new URLSearchParams(location.search).get('sala');
  if(sala&&sala.length===6){
    openRoomDialog('join');
    document.getElementById('jc').value=sala.toUpperCase();
  }
})();

// Run on load
window.addEventListener('load',initLobby);
