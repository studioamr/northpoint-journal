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
    const esD = document.documentElement.getAttribute('data-theme') === 'glass-diamante';
    const up = esD ? '#39FF14' : (color('--up') || '#6FCF97'), down = esD ? '#FF2E63' : (color('--down') || '#F07C8A'), acc = esD ? '#EAF4FF' : (color('--acc') || '#5B9BFF');
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    c.fillStyle = esD ? '#04050a' : '#0a0d14'; c.fillRect(0, 0, W, H);
    const g = c.createRadialGradient(W*0.85, 0, 40, W*0.85, 0, 760); g.addColorStop(0, (n >= 0 ? 'rgba(111,207,151,.16)' : 'rgba(240,124,138,.16)')); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0,0,W,H);
    const MONO = '"JetBrains Mono", monospace';
    /* --- datos derivados */
    const ins = (window.INSTRUMENTOS||{})[t.instrumento] || {}; const pUSD = ins.puntoUSD || null;
    const puntos = (t.entrada != null && t.salida != null) ? (t.direccion === 'long' ? t.salida - t.entrada : t.entrada - t.salida) : null;
    const riesgoPts = (t.entrada != null && t.sl != null) ? Math.abs(t.entrada - t.sl) : null;
    const riesgoUSD = riesgoPts != null && pUSD ? riesgoPts * pUSD * (t.contratos||1) : null;
    const rCalc = t.r != null ? +t.r : (riesgoUSD ? n / riesgoUSD : null);
    const clave = x => x.fecha + (x.hora||'');
    const balanceDespues = cta ? cta.inicial + Store.estado.trades.filter(x => x.cuentaId === cta.id && clave(x) <= clave(t)).reduce((s2,x) => s2 + Motor.neto(x), 0) : null;
    const pctCta = cta ? n / cta.inicial * 100 : null;
    let fase = ''; try{ if(cta){ const est = Motor.estadoCuenta(cta); fase = cta.fase === 'eval' && est.pasado ? 'pasada' : Motor.faseReal(est); } else if(t.modo === 'backtest') fase = 'backtest'; }catch(e){}
    const faseTxt = {eval:'EVALUACIÓN', pasada:'EVAL PASADA', buffer:'FUNDED · BUFFER', payouts:'FUNDED · PAYOUTS', backtest:'BACKTEST'}[fase] || '';
    let sesion = '—';
    if(t.hora){ const [hh, mm] = t.hora.split(':').map(Number); const m = hh*60 + (mm||0); const ny = Motor.aperturaNY(new Date(t.fecha + 'T12:00'));
      sesion = m < ny - 60 ? 'PRE-NY' : m < ny ? 'PRE-APERTURA' : m < ny + 90 ? 'NY AM · KILLZONE' : m < ny + 210 ? 'NY MEDIODÍA' : 'NY PM'; }
    const num = (v, d) => v == null || isNaN(v) ? '—' : (+v).toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});
    const etiqueta = (x, y, k, v, col, ancho, tam) => { c.textAlign = 'left'; c.fillStyle = '#8a8a86'; c.font = '500 12px ' + MONO; c.fillText(k, x, y); c.fillStyle = col || '#F4F4F4'; c.font = '600 ' + (tam||24) + 'px Inter, sans-serif'; c.fillText(corta(c, v, ancho - 8), x, y + (tam||24) + 8); };
    /* --- cabecera */
    c.fillStyle = '#F4F4F4'; c.font = '600 34px Inter, sans-serif'; c.fillText('NORTHPOINT', 64, 96);
    c.fillStyle = '#8a8a86'; c.font = '500 18px ' + MONO;
    c.fillText(UI.fechaLarga(t.fecha).toUpperCase() + '  ·  ' + (t.hora || '') + '  ·  ' + (cta ? (cta.alias || cta.firma).toUpperCase() : (t.modo === 'backtest' ? 'BACKTEST' : '')) + (faseTxt ? '  ·  ' + faseTxt : ''), 64, 132);
    c.textAlign = 'right'; c.fillText((P.nombre || 'ANDRÉ').toUpperCase(), W-64, 96); c.textAlign = 'left';
    /* --- pills */
    let px = 64; const py = 176;
    const pill = (txt, col) => { c.font = '700 20px Inter, sans-serif'; const w = c.measureText(txt).width + 36; c.fillStyle = col ? col : 'rgba(255,255,255,.08)'; redondo(c, px, py, w, 44, 22); c.fill(); c.fillStyle = col ? '#000' : '#F4F4F4'; c.fillText(txt, px + 18, py + 30); px += w + 12; };
    pill(t.direccion === 'long' ? '▲ LARGO' : '▼ CORTO', t.direccion === 'long' ? up : down); pill(t.instrumento + '  ×' + (t.contratos || 1)); if(t.estrategia) pill(t.estrategia.toUpperCase()); pill(t.modo === 'backtest' ? 'BACKTEST' : 'REAL');
    /* --- P&L grande + columna derecha */
    let fs = 150; const txt = masMenos(Math.round(n));
    do { c.font = '700 ' + fs + 'px Inter, sans-serif'; fs -= 6; } while(c.measureText(txt).width > 640 && fs > 60);
    c.fillStyle = n > 0 ? up : n < 0 ? down : '#F4F4F4'; c.fillText(txt, 56, 372);
    c.textAlign = 'right';
    c.fillStyle = '#8a8a86'; c.font = '500 12px ' + MONO; c.fillText('BALANCE DESPUÉS', W-64, 262);
    c.fillStyle = '#F4F4F4'; c.font = '600 34px Inter, sans-serif'; c.fillText(balanceDespues != null ? fmt(balanceDespues) : '—', W-64, 300);
    c.fillStyle = '#8a8a86'; c.font = '500 12px ' + MONO; c.fillText('% DE LA CUENTA  ·  R', W-64, 336);
    c.fillStyle = n > 0 ? up : n < 0 ? down : '#F4F4F4'; c.font = '600 30px Inter, sans-serif'; c.fillText((pctCta != null ? (pctCta >= 0 ? '+' : '') + pctCta.toFixed(2) + '%' : '—') + '   ' + (rCalc != null ? (rCalc >= 0 ? '+' : '') + rCalc.toFixed(2) + 'R' : '—'), W-64, 372);
    c.textAlign = 'left';
    /* --- rejilla de datos: 4 × 3 */
    const gx = 64, gw = (W-128 - 3*14)/4; let gy = 420;
    const celdas = [
      ['ENTRADA', num(t.entrada, 2)], ['SALIDA', num(t.salida, 2)], ['STOP', num(t.sl, 2)], ['TAKE PROFIT', num(t.tp, 2)],
      ['PUNTOS', puntos != null ? (puntos >= 0 ? '+' : '') + num(puntos, 2) : '—', puntos > 0 ? up : puntos < 0 ? down : null], ['RIESGO $', riesgoUSD != null ? fmt(riesgoUSD) : '—'], ['COMISIÓN', t.comision ? fmt(t.comision) : '$0'], ['BRUTO', masMenos(t.pnl||0)],
      ['SESIÓN', sesion, null, 18], ['TIPO', t.tipo === 'continuacion' ? 'Continuación' : 'Reversión', t.tipo === 'continuacion' ? up : down, 20], ['TAKE PROFIT A', t.tpTipo === 'interno' ? 'Liquidez interna' : 'Liquidez externa', t.tpTipo === 'interno' ? up : down, 20], ['CONFLUENCIAS', (t.confluencias||[]).length ? t.confluencias.map(x => x.toUpperCase()).join(' + ') : '—', null, 18]
    ];
    celdas.forEach((cd, i) => { const col = i % 4, fila = Math.floor(i/4); const x = gx + col*(gw+14), y = gy + fila*88;
      c.fillStyle = 'rgba(255,255,255,.045)'; redondo(c, x, y, gw, 76, 12); c.fill(); c.strokeStyle = 'rgba(255,255,255,.1)'; c.lineWidth = 1; redondo(c, x, y, gw, 76, 12); c.stroke();
      etiqueta(x+14, y+24, cd[0], cd[1], cd[2], gw-14, cd[3] || 24); });
    let y = gy + 3*88 + 12;
    /* --- 4 reglas */
    c.fillStyle = a.limpio ? up : a.puntos >= 75 ? acc : down; c.font = '700 22px Inter, sans-serif'; c.textAlign = 'right'; c.fillText('DISCIPLINA ' + a.puntos + '/100', W-64, y + 4); c.textAlign = 'left';
    c.fillStyle = '#8a8a86'; c.font = '500 12px ' + MONO; c.fillText('LAS 4 REGLAS', 64, y + 4); y += 18;
    const boxW = (W - 128 - 3*14) / 4;
    a.det.forEach((r, i) => { const x = 64 + i * (boxW + 14);
      c.fillStyle = r.ok ? (esD ? 'rgba(57,255,20,.12)' : 'rgba(111,207,151,.14)') : (esD ? 'rgba(255,46,99,.12)' : 'rgba(240,124,138,.12)'); redondo(c, x, y, boxW, 92, 14); c.fill();
      c.strokeStyle = r.ok ? up : down; c.lineWidth = 1.5; redondo(c, x, y, boxW, 92, 14); c.stroke();
      c.fillStyle = r.ok ? up : down; c.font = '700 22px Inter, sans-serif'; c.fillText(r.ok ? '✓' : '✗', x+16, y+36);
      c.fillStyle = '#F4F4F4'; c.font = '600 14px Inter, sans-serif'; lineas(c, r.titulo, boxW-32, 2).forEach((l, j) => c.fillText(l, x+16, y+58+j*18)); });
    y += 92 + 26;
    /* --- condición · objetivo · errores */
    c.fillStyle = acc; c.font = '600 12px ' + MONO; c.fillText('CONDICIÓN' + (t.condicionCumplida === false ? ' · NO SE CUMPLIÓ' : ''), 64, y); y += 28;
    c.fillStyle = '#F4F4F4'; c.font = '500 21px Inter, sans-serif'; lineas(c, t.condicion || 'Sin condición escrita', W-128, 2).forEach(l => { c.fillText(l, 64, y); y += 28; });
    const extra = [t.condicionPDA ? 'PDA: ' + t.condicionPDA : '', t.objetivo ? 'Objetivo: ' + t.objetivo : ''].filter(Boolean).join('   ·   ');
    if(extra){ c.fillStyle = '#c9c9c4'; c.font = '500 16px ' + MONO; c.fillText(corta(c, extra, W-128), 64, y + 4); y += 26; }
    if((t.errores||[]).length){ c.fillStyle = down; c.font = '600 12px ' + MONO; c.fillText('ERRORES', 64, y + 10); y += 34;
      c.fillStyle = '#F0A0A8'; c.font = '500 18px Inter, sans-serif'; c.fillText(corta(c, t.errores.join('  ·  '), W-128), 64, y); y += 22; }
    y += 14;
    /* --- screenshot + notas en lo que queda */
    const src = t.img ? await Img.get(t.id) : null; const im = src ? await cargaImg(src) : null;
    const notas = (t.notas || '').trim();
    const notasL = notas ? lineas(c, notas, W-128, 3).length : 0; const notasH = notas ? 30 + notasL*24 : 0;
    const areaH = Math.max(120, H - y - 100 - notasH);
    if(im){ const w = W-128; const esc = Math.min(w / im.width, areaH / im.height); const iw = im.width*esc, ih = im.height*esc;
      c.save(); redondo(c, 64, y, w, areaH, 16); c.clip(); c.fillStyle = '#0b0b0d'; c.fillRect(64, y, w, areaH); c.drawImage(im, 64 + (w-iw)/2, y + (areaH-ih)/2, iw, ih); c.restore();
      c.strokeStyle = 'rgba(255,255,255,.14)'; redondo(c, 64, y, w, areaH, 16); c.stroke(); }
    else { c.fillStyle = 'rgba(255,255,255,.035)'; redondo(c, 64, y, W-128, areaH, 16); c.fill();
      c.fillStyle = '#5f6a7e'; c.font = '500 14px ' + MONO; c.textAlign = 'center'; c.fillText('SIN SCREENSHOT · pégalo al editar', W/2, y + areaH/2 + 5); c.textAlign = 'left'; }
    y += areaH + 22;
    if(notas){ c.font = '400 18px Inter, sans-serif'; c.fillStyle = acc; c.font = '600 12px ' + MONO; c.fillText('NOTAS', 64, y); y += 24;
      c.fillStyle = '#c9c9c4'; c.font = '400 18px Inter, sans-serif'; lineas(c, notas, W-128, 3).forEach(l => { c.fillText(l, 64, y); y += 24; }); }
    c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(64, H-72, W-128, 1.5);
    c.fillStyle = '#8a8a86'; c.font = '500 13px ' + MONO;
    c.fillText(Tema.voz('ficha.pie', 'CONDICIÓN · CONTINUACIÓN · EQUILIBRIO + FVG · TP INTERNO'), 64, H-40);
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
