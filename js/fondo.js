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
  function paso(now){
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
    if(!document.hidden) requestAnimationFrame(paso);
  }
  tam(); for(let i = 0; i < N; i++) P.push(nace());
  ctx.fillStyle = fondoTema; ctx.fillRect(0,0,W,H);
  addEventListener('resize', () => { tam(); ctx.fillStyle = fondoTema; ctx.fillRect(0,0,W,H); });
  document.addEventListener('mesa:tema', () => { ctx.fillStyle = fondoTema; ctx.fillRect(0,0,W,H); });
  document.addEventListener('visibilitychange', () => { if(!document.hidden) requestAnimationFrame(paso); });
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(paso);

  /* ---- cinta: los últimos trades corren por arriba */
  function cinta(){
    const el = document.getElementById('cinta'); if(!el || !window.Store) return;
    const t = Store.estado.trades.filter(x => x.modo === 'real').slice().sort((a,b) => (b.fecha+(b.hora||'')) < (a.fecha+(a.hora||'')) ? -1 : 1).slice(0, 24);
    if(!t.length){ el.innerHTML = '<span class="ci"><em>NORTHPOINT</em> · del examen al payout · sin trades todavía</span>'; return; }
    const items = t.map(x => { const n = Motor.neto(x); return `<span class="ci"><em>${UI.fechaCorta(x.fecha)}</em> ${x.instrumento} <b class="${x.direccion==='long'?'up':'down'}">${x.direccion==='long'?'▲':'▼'}</b> <b class="${UI.signo(n)}">${UI.masMenos(n)}</b> <i>${Motor.adherencia(x).puntos}</i></span>`; }).join('');
    el.innerHTML = `<div class="cinta-track">${items}${items}</div>`;
  }
  cinta(); document.addEventListener('mesa:cambio', cinta);
})();
