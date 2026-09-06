/* ============================================================================
   MESA — fondo vivo: campo de flujo en canvas + cinta de trades
   ========================================================================= */
(function(){
  const cv = document.getElementById('fondo'); if(!cv) return;
  const ctx = cv.getContext('2d');
  let W, H, P = [], t0 = performance.now();
  const N = 420;
  let colorTema = 'rgba(198,255,61,0.16)';
  function leeColor(){ const el = document.createElement('div'); el.style.color = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#C6FF3D'; document.body.appendChild(el); const rgb = getComputedStyle(el).color.match(/\d+/g); el.remove(); if(rgb) colorTema = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${document.documentElement.dataset.theme === 'papel' ? 0.35 : 0.16})`; const fondo = getComputedStyle(document.documentElement).getPropertyValue('--fondo').trim(); fondoTema = fondo || '#050506'; }
  let fondoTema = '#050506';
  document.addEventListener('mesa:tema', leeColor); setTimeout(leeColor, 0);
  function tam(){ W = cv.width = innerWidth * devicePixelRatio; H = cv.height = innerHeight * devicePixelRatio; }
  function nace(){ return {x: Math.random()*W, y: Math.random()*H, v: 0, vida: 200 + Math.random()*400}; }
  function campo(x, y, t){
    const s = 0.0009 / devicePixelRatio;
    return Math.sin(x*s + t*0.00012) * Math.cos(y*s*1.3 - t*0.00009) * Math.PI * 2 + Math.sin((x+y)*s*0.5 + t*0.00005) * Math.PI;
  }
  /* ---- Diamante: cristales que flotan sobre el liquid glass (solo en ese tema) */
  let modo = 'flujo', S = [];
  function esDiamante(){ return document.documentElement.getAttribute('data-theme') === 'glass-diamante'; }
  function naceCristal(){ const r = Math.random(); return {x: Math.random()*W, y: H + Math.random()*H*0.3, s: (9 + Math.pow(r, 2.4)*42) * devicePixelRatio, rot: Math.random()*Math.PI*2, vr: (Math.random()-.5)*0.004, vy: -(0.08 + Math.random()*0.35) * devicePixelRatio, vx: (Math.random()-.5)*0.12*devicePixelRatio, a: 0.035 + Math.random()*0.11, fase: Math.random()*Math.PI*2}; }
  function gema(x, y, s, rot, a, brillo){
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    const P = [[-1,-.35],[-.55,-.75],[.55,-.75],[1,-.35],[0,1]];
    const g = ctx.createLinearGradient(-s, -s, s, s); g.addColorStop(0, `rgba(255,255,255,${a*1.6})`); g.addColorStop(.5, `rgba(200,225,255,${a*.5})`); g.addColorStop(1, `rgba(255,255,255,${a*1.2})`);
    ctx.beginPath(); P.forEach(([px,py], i) => i ? ctx.lineTo(px*s, py*s) : ctx.moveTo(px*s, py*s)); ctx.closePath();
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(1, s*0.03); ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, a*2.6)})`; ctx.stroke();
    // facetas
    ctx.beginPath(); ctx.moveTo(-s, -.35*s); ctx.lineTo(s, -.35*s); ctx.moveTo(-.55*s, -.75*s); ctx.lineTo(-.3*s, -.35*s); ctx.lineTo(0, s); ctx.moveTo(.55*s, -.75*s); ctx.lineTo(.3*s, -.35*s); ctx.lineTo(0, s); ctx.moveTo(-.3*s, -.35*s); ctx.lineTo(.3*s, -.35*s);
    ctx.strokeStyle = `rgba(255,255,255,${a*1.4})`; ctx.lineWidth = 1; ctx.stroke();
    if(brillo > 0){ // destello de 4 puntas
      ctx.globalAlpha = brillo; ctx.fillStyle = '#fff'; const d = s*0.9;
      ctx.beginPath(); ctx.moveTo(0,-d); ctx.quadraticCurveTo(0,0,d,0); ctx.quadraticCurveTo(0,0,0,d); ctx.quadraticCurveTo(0,0,-d,0); ctx.quadraticCurveTo(0,0,0,-d); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  function pasoCristales(now){
    const t = now - t0;
    ctx.clearRect(0,0,W,H);
    for(const c of S){
      c.y += c.vy; c.x += c.vx + Math.sin(t*0.0004 + c.fase)*0.15*devicePixelRatio; c.rot += c.vr;
      const tw = Math.max(0, Math.sin(t*0.0011 + c.fase*3)); const brillo = tw > 0.985 ? (tw-0.985)/0.015*0.55 : 0;
      gema(c.x, c.y, c.s, c.rot, c.a, brillo);
      if(c.y < -c.s*2) Object.assign(c, naceCristal(), {y: H + c.s});
    }
  }
  function paso(now){
    if(esDiamante()){ if(modo !== 'diamante'){ modo = 'diamante'; S = []; for(let i = 0; i < 26; i++){ const c = naceCristal(); c.y = Math.random()*H; S.push(c); } }
      pasoCristales(now);
      if(!document.hidden) requestAnimationFrame(paso); else setTimeout(() => requestAnimationFrame(paso), 1500); return; }
    if(modo === 'diamante'){ modo = 'flujo'; ctx.fillStyle = fondoTema; ctx.fillRect(0,0,W,H); }
    const t = now - t0;
    ctx.fillStyle = fondoTema; ctx.globalAlpha = 0.08; ctx.fillRect(0,0,W,H); ctx.globalAlpha = 1;
    ctx.lineWidth = 1 * devicePixelRatio;
    for(const p of P){
      const a = campo(p.x, p.y, t);
      const nx = p.x + Math.cos(a) * 1.1 * devicePixelRatio, ny = p.y + Math.sin(a) * 1.1 * devicePixelRatio;
      ctx.strokeStyle = colorTema;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
      p.x = nx; p.y = ny; p.vida--;
      if(p.vida <= 0 || p.x < 0 || p.x > W || p.y < 0 || p.y > H) Object.assign(p, nace());
    }
    if(!document.hidden && getComputedStyle(cv).display !== 'none') requestAnimationFrame(paso); else setTimeout(() => requestAnimationFrame(paso), 1500);
  }
  tam(); for(let i = 0; i < N; i++) P.push(nace());
  ctx.fillStyle = fondoTema; ctx.fillRect(0,0,W,H);
  addEventListener('resize', () => { tam(); ctx.fillStyle = fondoTema; ctx.fillRect(0,0,W,H); });
  document.addEventListener('mesa:tema', () => { if(esDiamante()){ ctx.clearRect(0,0,W,H); } else { ctx.fillStyle = fondoTema; ctx.fillRect(0,0,W,H); } });
  document.addEventListener('visibilitychange', () => { if(!document.hidden) requestAnimationFrame(paso); });
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(paso);

  /* ---- cinta: los últimos trades corren por arriba */
  function cinta(){
    const el = document.getElementById('cinta'); if(!el || !window.Store) return;
    const t = Store.estado.trades.filter(x => x.modo === 'real').slice().sort((a,b) => (b.fecha+(b.hora||'')) < (a.fecha+(a.hora||'')) ? -1 : 1).slice(0, 24);
    if(!t.length){ el.innerHTML = '<span class="ci">' + (window.Tema ? Tema.voz('cinta.vacia', '<em>NORTHPOINT</em> · del examen al payout · sin trades todavía') : '') + '</span>'; return; }
    const items = t.map(x => { const n = Motor.neto(x); return `<span class="ci"><em>${UI.fechaCorta(x.fecha)}</em> ${x.instrumento} <b class="${x.direccion==='long'?'up':'down'}">${x.direccion==='long'?'▲':'▼'}</b> <b class="${UI.signo(n)}">${UI.masMenos(n)}</b> <i>${Motor.adherencia(x).puntos}</i></span>`; }).join('');
    el.innerHTML = `<div class="cinta-track">${items}${items}</div>`;
  }
  cinta(); document.addEventListener('mesa:cambio', cinta);
})();
