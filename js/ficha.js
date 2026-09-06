/* ============================================================================
   NORTHPOINT — la FICHA OFICIAL del día
   Una imagen (1080×1350, lista para compartir) con el reporte del día:
   P&L, stats, la condición, los trades, hasta dos screenshots y las notas.
   Se dibuja en canvas, sin librerías.
   ========================================================================= */
(function(){
  const {fmt, masMenos, pct} = UI;
  const W = 1080, H = 1350;

  function color(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function cargaImg(src){ return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
  function corta(ctx, txt, max){ let s = String(txt||''); while(s.length > 2 && ctx.measureText(s).width > max) s = s.slice(0, -2); return s.length < String(txt||'').length ? s.trim() + '…' : s; }
  function lineas(ctx, txt, max, n){ const out = []; let linea = ''; String(txt||'').split(/\s+/).forEach(w => { const t = linea ? linea + ' ' + w : w; if(ctx.measureText(t).width > max && linea){ out.push(linea); linea = w; } else linea = t; }); if(linea) out.push(linea); return out.slice(0, n); }
  function redondo(ctx, x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x+r, y); ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r); ctx.arcTo(x, y+h, x, y, r); ctx.arcTo(x, y, x+w, y, r); ctx.closePath(); }

  async function dibuja(iso){
    const ts = Store.tradesCal().filter(t => t.fecha === iso).sort((a,b) => (a.hora||'') < (b.hora||'') ? -1 : 1);
    const d = Store.estado.dias[iso] || {};
    const m = Stats.metricas(ts);
    const cta = Store.cuentaCal(); const sel = [cta].filter(Boolean);
    const P = Tema.perfil();
    const acc = color('--acc') || '#C6FF3D', up = color('--up') || '#C6FF3D', down = color('--down') || '#FF4D5A';
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    // fondo
    c.fillStyle = '#050506'; c.fillRect(0, 0, W, H);
    const g = c.createRadialGradient(W*0.85, 0, 40, W*0.85, 0, 700); g.addColorStop(0, 'rgba(198,255,61,.14)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0,0,W,H);
    // marca
    c.fillStyle = '#F4F4F4'; c.font = '600 34px Inter, "Space Grotesk", sans-serif'; c.fillText('NORTHPOINT', 64, 96);
    c.fillStyle = '#8a8a86'; c.font = '500 18px "JetBrains Mono", monospace';
    c.fillText(UI.fechaLarga(iso).toUpperCase() + '  ·  ' + (sel.length > 1 ? sel.length + ' CUENTAS' : (cta ? (cta.alias || cta.firma).toUpperCase() : '')), 64, 132);
    c.textAlign = 'right'; c.fillText((P.nombre || 'ANDRÉ').toUpperCase() + (P.ciudad ? '  ·  ' + P.ciudad.toUpperCase() : ''), W-64, 96); c.textAlign = 'left';
    // P&L grande
    const n = m.pnl;
    c.fillStyle = n > 0 ? up : n < 0 ? down : '#F4F4F4';
    let fs = 168; const txt = masMenos(Math.round(n));
    do { c.font = '800 ' + fs + 'px Syne, "Space Grotesk", sans-serif'; fs -= 6; } while(c.measureText(txt).width > W - 120 && fs > 60);
    c.fillText(txt, 56, 320);
    c.fillStyle = '#8a8a86'; c.font = '500 18px "JetBrains Mono", monospace';
    c.fillText(`${m.n} TRADE${m.n === 1 ? '' : 'S'}  ·  ${m.ganadas}G ${m.perdidas}P ${m.be}BE  ·  ${m.rTotal ? m.rTotal.toFixed(1) + 'R' : ''}`, 64, 364);
    // KPIs
    const kpis = [['WIN RATE', m.n ? pct(m.winRate,0) : '—'], ['PROFIT FACTOR', m.n ? (m.pf === Infinity ? '∞' : m.pf.toFixed(2)) : '—'], ['DISCIPLINA', m.n ? m.adherencia.toFixed(0) + '/100' : '—'], ['MEJOR · PEOR', m.n ? fmt(Math.round(m.mejor)) + ' · ' + fmt(Math.round(m.peor)) : '—']];
    kpis.forEach(([k, v], i) => { const x = 64 + i * 238, y = 400;
      c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 1.5; redondo(c, x, y, 222, 96, 4); c.stroke();
      c.fillStyle = '#8a8a86'; c.font = '500 13px "JetBrains Mono", monospace'; c.fillText(k, x+16, y+30);
      c.fillStyle = '#F4F4F4'; let fk = 30; do { c.font = '600 ' + fk + 'px "JetBrains Mono", monospace'; fk -= 2; } while(c.measureText(v).width > 190 && fk > 14); c.fillText(v, x+16, y+72); });
    // condición
    let y = 548;
    c.fillStyle = acc; c.font = '600 13px "JetBrains Mono", monospace'; c.fillText('CONDICIÓN DEL DÍA', 64, y); y += 30;
    c.fillStyle = '#F4F4F4'; c.font = '500 24px "Space Grotesk", sans-serif';
    const cond = d.condicion ? d.condicion + (d.ramaA ? '  ·  A: ' + d.ramaA : '') + (d.ramaB ? '  ·  B: ' + d.ramaB : '') + (d.activada && d.activada !== '—' ? '  ·  se activó ' + d.activada : '') : 'Sin condición escrita';
    lineas(c, cond, W-128, 2).forEach(l => { c.fillText(l, 64, y); y += 32; });
    y += 18;
    // trades
    c.fillStyle = acc; c.font = '600 13px "JetBrains Mono", monospace'; c.fillText('TRADES', 64, y); y += 26;
    c.font = '500 19px "JetBrains Mono", monospace';
    ts.slice(0, 6).forEach(t => { const v = Motor.neto(t), a = Motor.adherencia(t);
      c.fillStyle = '#8a8a86'; c.fillText(t.hora || '--:--', 64, y);
      c.fillStyle = t.direccion === 'long' ? up : down; c.fillText(t.direccion === 'long' ? '▲ LARGO' : '▼ CORTO', 150, y);
      c.fillStyle = '#F4F4F4'; c.fillText(corta(c, (t.estrategia || '') + (t.r != null ? '  ' + (+t.r).toFixed(2) + 'R' : ''), 380), 300, y);
      c.fillStyle = v > 0 ? up : v < 0 ? down : '#F4F4F4'; c.textAlign = 'right'; c.fillText(masMenos(v), 900, y);
      c.fillStyle = a.limpio ? up : a.puntos >= 75 ? acc : down; c.fillText(a.puntos + '', W-64, y); c.textAlign = 'left';
      y += 34; });
    if(ts.length > 6){ c.fillStyle = '#8a8a86'; c.fillText('+ ' + (ts.length - 6) + ' más', 64, y); y += 34; }
    if(!ts.length){ c.fillStyle = '#8a8a86'; c.fillText('Sin trades: día de espera.', 64, y); y += 34; }
    y += 10;
    // screenshots (hasta 2)
    const conImg = ts.filter(t => t.img).slice(0, 2);
    const srcs = []; for(const t of conImg){ const s = await Img.get(t.id); if(s) srcs.push(await cargaImg(s)); }
    const imgs = srcs.filter(Boolean);
    const areaH = Math.max(120, Math.min(420, H - y - 150));
    if(imgs.length){
      const w = imgs.length === 1 ? W-128 : (W-128-16)/2;
      imgs.forEach((im, i) => { const x = 64 + i * (w + 16); const esc = Math.min(w / im.width, areaH / im.height); const iw = im.width*esc, ih = im.height*esc;
        c.save(); redondo(c, x, y, w, areaH, 6); c.clip(); c.fillStyle = '#0b0b0d'; c.fillRect(x, y, w, areaH); c.drawImage(im, x + (w-iw)/2, y + (areaH-ih)/2, iw, ih); c.restore();
        c.strokeStyle = 'rgba(255,255,255,.14)'; redondo(c, x, y, w, areaH, 6); c.stroke(); });
      y += areaH + 24;
    }
    // notas
    const notas = [d.notas].concat(ts.filter(t => t.notas).map(t => t.hora + ' · ' + t.notas)).filter(Boolean).join('   ');
    if(notas && y < H - 120){ c.fillStyle = acc; c.font = '600 13px "JetBrains Mono", monospace'; c.fillText('NOTAS', 64, y); y += 26;
      c.fillStyle = '#c9c9c4'; c.font = '400 19px "Space Grotesk", sans-serif'; lineas(c, notas, W-128, Math.max(1, Math.floor((H - 110 - y) / 26))).forEach(l => { c.fillText(l, 64, y); y += 26; }); }
    // pie
    c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(64, H-72, W-128, 1.5);
    c.fillStyle = '#8a8a86'; c.font = '500 13px "JetBrains Mono", monospace';
    c.fillText('DEL EXAMEN AL PAYOUT  ·  CONDICIÓN · CONTINUACIÓN · EQUILIBRIO + FVG · TP INTERNO', 64, H-40);
    c.textAlign = 'right'; c.fillText('northpoint', W-64, H-40); c.textAlign = 'left';
    return cv.toDataURL('image/png');
  }

  async function descarga(iso){
    const src = await dibuja(iso);
    const nombre = 'northpoint-' + iso + '.png';
    if(window.__npNativo){ try{ window.webkit.messageHandlers.np.postMessage({cmd:'guardarPng', nombre, b64: src.split(',')[1]}); return; }catch(e){} }
    const a = document.createElement('a'); a.href = src; a.download = nombre; a.click();
  }
  async function comparte(iso){
    const src = await dibuja(iso);
    try{ const blob = await (await fetch(src)).blob(); const file = new File([blob], 'northpoint-' + iso + '.png', {type:'image/png'});
      if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file], title:'NORTHPOINT · ' + iso}); return true; } }catch(e){}
    return false;
  }
  /* ---- la ficha de UN trade: se genera sola al registrar ---- */
  async function dibujaTrade(id){
    const t = Store.estado.trades.find(x => x.id === id); if(!t) return null;
    const cta = Store.cuenta(t.cuentaId); const P = Tema.perfil(); const a = Motor.adherencia(t); const n = Motor.neto(t);
    const acc = color('--acc') || '#5B9BFF', up = color('--up') || '#6FCF97', down = color('--down') || '#F07C8A';
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    c.fillStyle = '#0a0d14'; c.fillRect(0, 0, W, H);
    const g = c.createRadialGradient(W*0.85, 0, 40, W*0.85, 0, 760); g.addColorStop(0, (n >= 0 ? 'rgba(111,207,151,.16)' : 'rgba(240,124,138,.16)')); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0,0,W,H);
    c.fillStyle = '#F4F4F4'; c.font = '600 34px Inter, sans-serif'; c.fillText('NORTHPOINT', 64, 96);
    c.fillStyle = '#8a8a86'; c.font = '500 18px "JetBrains Mono", monospace';
    c.fillText(UI.fechaLarga(t.fecha).toUpperCase() + '  ·  ' + (t.hora || '') + '  ·  ' + (cta ? (cta.alias || cta.firma).toUpperCase() : (t.modo === 'backtest' ? 'BACKTEST' : '')), 64, 132);
    c.textAlign = 'right'; c.fillText((P.nombre || 'ANDRÉ').toUpperCase(), W-64, 96); c.textAlign = 'left';
    // dirección + instrumento
    c.fillStyle = t.direccion === 'long' ? up : down; c.font = '700 26px Inter, sans-serif';
    c.fillText((t.direccion === 'long' ? '▲ LARGO' : '▼ CORTO') + '   ' + t.instrumento + '   ×' + (t.contratos || 1), 64, 214);
    // P&L grande
    let fs = 168; const txt = masMenos(Math.round(n));
    do { c.font = '700 ' + fs + 'px Inter, sans-serif'; fs -= 6; } while(c.measureText(txt).width > W - 120 && fs > 60);
    c.fillStyle = n > 0 ? up : n < 0 ? down : '#F4F4F4'; c.fillText(txt, 56, 380);
    c.fillStyle = '#8a8a86'; c.font = '500 18px "JetBrains Mono", monospace';
    const linea2 = [t.entrada != null ? 'ENTRADA ' + t.entrada : '', t.salida != null ? 'SALIDA ' + t.salida : '', t.sl != null ? 'SL ' + t.sl : '', t.r != null ? (+t.r).toFixed(2) + 'R' : '', t.estrategia ? t.estrategia.toUpperCase() : ''].filter(Boolean).join('  ·  ');
    c.fillText(corta(c, linea2, W-128), 64, 424);
    // 4 reglas
    let y = 480;
    const boxW = (W - 128 - 3*14) / 4;
    a.det.forEach((r, i) => { const x = 64 + i * (boxW + 14);
      c.fillStyle = r.ok ? 'rgba(111,207,151,.14)' : 'rgba(240,124,138,.12)'; redondo(c, x, y, boxW, 104, 14); c.fill();
      c.strokeStyle = r.ok ? up : down; c.lineWidth = 1.5; redondo(c, x, y, boxW, 104, 14); c.stroke();
      c.fillStyle = r.ok ? up : down; c.font = '700 22px Inter, sans-serif'; c.fillText(r.ok ? '✓' : '✗', x+16, y+38);
      c.fillStyle = '#F4F4F4'; c.font = '600 15px Inter, sans-serif'; lineas(c, r.titulo, boxW-32, 2).forEach((l, j) => c.fillText(l, x+16, y+62+j*19)); });
    c.fillStyle = a.limpio ? up : a.puntos >= 75 ? acc : down; c.font = '700 22px Inter, sans-serif'; c.textAlign = 'right'; c.fillText('DISCIPLINA ' + a.puntos + '/100', W-64, y - 14); c.textAlign = 'left';
    y += 134;
    // condición
    if(t.condicion){ c.fillStyle = acc; c.font = '600 13px "JetBrains Mono", monospace'; c.fillText('CONDICIÓN', 64, y); y += 30;
      c.fillStyle = '#F4F4F4'; c.font = '500 22px Inter, sans-serif'; lineas(c, t.condicion, W-128, 2).forEach(l => { c.fillText(l, 64, y); y += 30; }); y += 12; }
    // errores
    if((t.errores||[]).length){ c.fillStyle = down; c.font = '600 13px "JetBrains Mono", monospace'; c.fillText('ERRORES', 64, y); y += 28;
      c.fillStyle = '#F0A0A8'; c.font = '500 19px Inter, sans-serif'; c.fillText(corta(c, t.errores.join('  ·  '), W-128), 64, y); y += 34; }
    // screenshot
    const src = t.img ? await Img.get(t.id) : null; const im = src ? await cargaImg(src) : null;
    const notas = t.notas || '';
    const notasH = notas ? 90 : 0;
    const areaH = Math.max(160, H - y - 120 - notasH);
    if(im){ const w = W-128; const esc = Math.min(w / im.width, areaH / im.height); const iw = im.width*esc, ih = im.height*esc;
      c.save(); redondo(c, 64, y, w, areaH, 16); c.clip(); c.fillStyle = '#0b0b0d'; c.fillRect(64, y, w, areaH); c.drawImage(im, 64 + (w-iw)/2, y + (areaH-ih)/2, iw, ih); c.restore();
      c.strokeStyle = 'rgba(255,255,255,.14)'; redondo(c, 64, y, w, areaH, 16); c.stroke(); y += areaH + 22; }
    else { c.fillStyle = 'rgba(255,255,255,.04)'; redondo(c, 64, y, W-128, areaH, 16); c.fill();
      const cifras = [[t.entrada != null ? String(t.entrada) : '—', 'ENTRADA'], [t.salida != null ? String(t.salida) : '—', 'SALIDA'], [t.r != null ? (+t.r).toFixed(2) + 'R' : '—', 'RESULTADO EN R']];
      const cw = (W-128)/3; cifras.forEach(([v, k], i) => { const cx = 64 + cw*i + cw/2; c.textAlign = 'center';
        c.fillStyle = '#F4F4F4'; c.font = '700 44px Inter, sans-serif'; c.fillText(corta(c, v, cw-30), cx, y + areaH/2 - 4);
        c.fillStyle = '#8a8a86'; c.font = '500 13px "JetBrains Mono", monospace'; c.fillText(k, cx, y + areaH/2 + 28); });
      c.fillStyle = '#5f6a7e'; c.font = '500 14px "JetBrains Mono", monospace'; c.fillText('SIN SCREENSHOT · pégalo al editar', W/2, y + areaH - 24); c.textAlign = 'left'; y += areaH + 22; }
    if(notas){ c.fillStyle = acc; c.font = '600 13px "JetBrains Mono", monospace'; c.fillText('NOTAS', 64, y); y += 26;
      c.fillStyle = '#c9c9c4'; c.font = '400 19px Inter, sans-serif'; lineas(c, notas, W-128, 2).forEach(l => { c.fillText(l, 64, y); y += 26; }); }
    c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(64, H-72, W-128, 1.5);
    c.fillStyle = '#8a8a86'; c.font = '500 13px "JetBrains Mono", monospace';
    c.fillText('CONDICIÓN · CONTINUACIÓN · EQUILIBRIO + FVG · TP INTERNO', 64, H-40);
    c.textAlign = 'right'; c.fillText('northpoint', W-64, H-40); c.textAlign = 'left';
    return cv.toDataURL('image/png');
  }
  async function descargaTrade(id){
    const src = await dibujaTrade(id); if(!src) return; const t = Store.estado.trades.find(x => x.id === id);
    const nombre = 'northpoint-trade-' + t.fecha + '-' + (t.hora||'').replace(':','') + '.png';
    if(window.__npNativo){ try{ window.webkit.messageHandlers.np.postMessage({cmd:'guardarPng', nombre, b64: src.split(',')[1]}); return; }catch(e){} }
    const a = document.createElement('a'); a.href = src; a.download = nombre; a.click();
  }
  async function comparteTrade(id){
    const src = await dibujaTrade(id); if(!src) return false;
    try{ const blob = await (await fetch(src)).blob(); const file = new File([blob], 'northpoint-trade.png', {type:'image/png'});
      if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file], title:'NORTHPOINT'}); return true; } }catch(e){}
    return false;
  }
  window.Ficha = { dibuja, descarga, comparte, dibujaTrade, descargaTrade, comparteTrade };
})();
