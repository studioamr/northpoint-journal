/* ============================================================================
   NORTHPOINT — GESTIÓN DE RIESGO
   Parámetros arriba (se calcula solito) → pirámides de decisión por etapa
   (EVAL · FUNDED/BUFFER · PAYOUTS) como en su libreta → la canica: simulación
   con probabilidades de cómo le iría desde la eval hasta los payouts.
   ========================================================================= */
(function(){
  const {h, fmt, kpi} = UI;
  const num = v => '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
  const UP = 'var(--up)', DOWN = 'var(--down)', TXT = 'var(--txt)';

  /* ---- parámetros: los de Ajustes/cuenta como base, editables aquí (Store.ajustes.simRiesgo) */
  function params(){
    const A = Store.ajustes, F = Store.fases(), cta = Store.cuentaActiva();
    const dias = Motor.porDia(Store.tradesReales(cta ? cta.id : null)); const wrReal = dias.length >= 10 ? dias.filter(x => x.pnl > 0).length / dias.length : null;
    const base = {
      inicial: cta ? cta.inicial : 50000, objetivo: 3000, buffer: 2100, tope: (cta && cta.reglas && cta.reglas.capPayout) || 1000, maxPagos: (cta && cta.reglas && cta.reglas.maxPayouts) || 5, split: 90,
      evalTP: F.eval.target, evalLoss: F.eval.loss, fondTP: F.fond.target, fondLoss: F.fond.loss, winRate: Math.round((wrReal != null ? wrReal : 0.6) * 100), quema: 2000
    };
    return Object.assign({}, base, A.simRiesgo || {}, {wrReal, diasReales: dias.length});
  }

  /* ---- una canica: recorre día a día desde la eval con la probabilidad de ganar el día = win rate */
  function canica(P, rnd){
    rnd = rnd || Math.random; const piso = P.inicial - P.quema; let bal = P.inicial, fase = 'eval', dia = 0, pagos = 0, cobrado = 0; const ruta = [{dia:0, bal, fase}];
    while(dia < 400){ dia++; const gana = rnd() < P.winRate / 100;
      if(fase === 'eval'){ bal += gana ? P.evalTP : -P.evalLoss; if(bal <= piso){ ruta.push({dia, bal, fase, fin:'quemada'}); return {ruta, fin:'quemada en eval', dia, pagos, cobrado}; }
        if(bal >= P.inicial + P.objetivo){ ruta.push({dia, bal, fase, hito:'PASAS'}); fase = 'buffer'; bal = P.inicial; continue; } }
      else { bal += gana ? P.fondTP : -P.fondLoss; if(bal <= piso){ ruta.push({dia, bal, fase, fin:'quemada'}); return {ruta, fin:'quemada en ' + fase, dia, pagos, cobrado}; }
        if(fase === 'buffer' && bal >= P.inicial + P.buffer){ fase = 'payouts'; ruta.push({dia, bal, fase, hito:'BUFFER'}); continue; }
        if(fase === 'payouts' && bal >= P.inicial + P.buffer + P.tope){ pagos++; cobrado += P.tope * P.split / 100; bal = P.inicial + P.buffer; ruta.push({dia, bal, fase, hito:'COBRAS #' + pagos});
          if(pagos >= P.maxPagos){ return {ruta, fin:'cuenta concluida · ' + pagos + ' retiros', dia, pagos, cobrado}; } continue; } }
      ruta.push({dia, bal, fase}); }
    return {ruta, fin:'sigue viva a los 400 días', dia, pagos, cobrado};
  }
  function canicas(P, n){ const out = {pasan:0, buffer:0, pagan:0, queman:0, concluyen:0, pagos:0, cobrado:0, dias:0}; const hist = {};
    for(let i = 0; i < n; i++){ const c = canica(P); if(c.ruta.some(r => r.hito === 'PASAS')) out.pasan++; if(c.ruta.some(r => r.hito === 'BUFFER')) out.buffer++; if(c.pagos > 0) out.pagan++; if(/quemada/.test(c.fin)) out.queman++; if(/concluida/.test(c.fin)) out.concluyen++; out.pagos += c.pagos; out.cobrado += c.cobrado; out.dias += c.dia; hist[c.pagos] = (hist[c.pagos] || 0) + 1; }
    return Object.assign(out, {n, hist}); }

  /* ---- pirámide: árbol binario completo como en la libreta. WIN a la izquierda, LOSS a la derecha. */
  function piramide(P, etapa, ruta){
    const piso = P.inicial - P.quema;
    const cfg = etapa === 'eval' ? {bal0: P.inicial, tp: P.evalTP, dl: P.evalLoss, fin: P.inicial + P.objetivo, finTxt:'PASAS', prof: Math.max(2, Math.min(4, Math.ceil(P.objetivo / P.evalTP)))}
      : etapa === 'buffer' ? {bal0: P.inicial, tp: P.fondTP, dl: P.fondLoss, fin: P.inicial + P.buffer, finTxt:'BUFFER', prof: 4}
      : {bal0: P.inicial + P.buffer, tp: P.fondTP, dl: P.fondLoss, fin: P.inicial + P.buffer + P.tope, finTxt:'COBRAS', prof: 4};
    const W = 1000, dy = 74, T = 34, H = T + cfg.prof * dy + 40;
    const pasos = ruta ? ruta.filter(r => r.fase === etapa || (etapa === 'buffer' && r.fase === 'buffer') ).slice(0, cfg.prof + 1) : null;   // la canica en esta etapa
    let g = '';
    const nodo = (d, i, bal, camino) => {
      const x = (i + 0.5) / Math.pow(2, d) * W, y = T + d * dy; const term = bal >= cfg.fin ? 'fin' : bal <= piso ? 'quema' : null;
      const enRuta = pasos && pasos[d] && Math.abs(pasos[d].bal - bal) < 1 && camino;
      const col = term === 'fin' ? UP : term === 'quema' ? DOWN : d === 0 ? TXT : 'var(--dim)';
      const w = Math.max(44, Math.min(150, W / Math.pow(2, d) - 8)); const fs = d >= 4 ? 7.5 : d === 3 ? 8.5 : 10;
      const txt = (term === 'fin' ? cfg.finTxt + ' ' : term === 'quema' ? 'X ' : '') + Math.round(bal).toLocaleString('en-US');
      g += `<rect x="${x - w/2}" y="${y - 10}" width="${w}" height="20" rx="10" fill="${term === 'fin' ? 'var(--upSuave)' : term === 'quema' ? 'var(--downSuave)' : enRuta ? 'var(--accSuave)' : 'rgba(255,255,255,.05)'}" stroke="${enRuta ? 'var(--acc)' : col}" stroke-width="${enRuta ? 2 : 1}" stroke-opacity="${term || d === 0 || enRuta ? .95 : .4}"/>`;
      g += `<text x="${x}" y="${y + 3.5}" text-anchor="middle" font-size="${fs}" font-weight="${term || d === 0 || enRuta ? 700 : 400}" fill="${enRuta ? 'var(--acc)' : col}" font-family="JetBrains Mono, monospace">${txt}</text>`;
      if(enRuta) g += `<circle cx="${x - w/2 - 8}" cy="${y}" r="5" fill="var(--acc)" style="filter:drop-shadow(0 0 5px var(--acc))"/>`;
      if(term || d >= cfg.prof) return;
      const xl = (2*i + 0.5) / Math.pow(2, d+1) * W, xr = (2*i + 1.5) / Math.pow(2, d+1) * W, y2 = y + dy;
      const sigueL = enRuta && pasos[d+1] && pasos[d+1].bal > bal, sigueR = enRuta && pasos[d+1] && pasos[d+1].bal < bal;
      g += `<line x1="${x}" y1="${y + 10}" x2="${xl}" y2="${y2 - 10}" stroke="${UP}" stroke-opacity="${sigueL ? 1 : .55}" stroke-width="${sigueL ? 2.5 : 1.2}"/><line x1="${x}" y1="${y + 10}" x2="${xr}" y2="${y2 - 10}" stroke="${DOWN}" stroke-opacity="${sigueR ? 1 : .55}" stroke-width="${sigueR ? 2.5 : 1.2}"/>`;
      if(d === 0) g += `<text x="${(x + xl)/2 - 10}" y="${(y + y2)/2}" text-anchor="end" font-size="8.5" fill="${UP}" font-family="JetBrains Mono, monospace">WIN +${num(cfg.tp)}</text><text x="${(x + xr)/2 + 10}" y="${(y + y2)/2}" font-size="8.5" fill="${DOWN}" font-family="JetBrains Mono, monospace">LOSS -${num(cfg.dl)}</text>`;
      nodo(d+1, 2*i, bal + cfg.tp, sigueL); nodo(d+1, 2*i + 1, bal - cfg.dl, sigueR);
    };
    nodo(0, 0, cfg.bal0, true);
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">${g}</svg>`;
  }

  let ultima = null, lote = null;   // la última canica y el último lote (viven mientras la vista esté abierta)
  Vistas.riesgo = function(){
    const P = params(); const A = Store.ajustes;
    const rr = (a, b) => (a / b).toFixed(2);
    const campo = (k, t, step) => `<label class="campo"><span>${t}</span><input type="number" step="${step || 1}" data-sim="${k}" value="${P[k]}"></label>`;
    const ruta = ultima ? ultima.ruta : null;
    const tarjeta = (t, sub, cls, etapa) => `<div class="card etapa ${cls}"><div class="fila"><h3>${t}</h3><span class="mono dim">${sub}</span></div><div class="arbol">${piramide(P, etapa, ruta)}</div></div>`;
    return `
    <div class="card" style="margin-bottom:14px"><div class="fila"><h3>Parámetros</h3><span class="mono dim">cambia uno y todo se recalcula</span><div class="crece"></div><button class="btn chico fantasma" data-acc="simReset">valores de Ajustes</button></div>
      <div class="grid g6" style="margin-top:10px">
        ${campo('inicial', 'Cuenta inicial ($)', 1000)}${campo('objetivo', 'Objetivo eval ($)', 100)}${campo('buffer', 'Buffer ($)', 100)}${campo('tope', 'Tope por retiro ($)', 100)}${campo('maxPagos', 'Retiros máx', 1)}${campo('split', 'Split (%)', 5)}
        ${campo('evalTP', 'Eval · TP por día ($)', 50)}${campo('evalLoss', 'Eval · riesgo por día ($)', 50)}${campo('fondTP', 'Funded · TP por día ($)', 50)}${campo('fondLoss', 'Funded · riesgo por día ($)', 50)}${campo('winRate', 'Win rate por día (%)', 1)}${campo('quema', 'Se quema a inicial − ($)', 100)}
      </div>
      <div class="mini dim" style="margin-top:8px">R:R eval ${rr(P.evalTP, P.evalLoss)} · R:R funded ${rr(P.fondTP, P.fondLoss)} · ${P.wrReal != null ? 'tu win rate real por día: ' + Math.round(P.wrReal*100) + '% en ' + P.diasReales + ' días' : 'sin 10 días reales todavía: win rate supuesto'}</div></div>

    <div class="card" style="margin-bottom:14px"><div class="fila"><h3>La canica</h3><span class="mono dim">una vida simulada con estos parámetros: de la eval hasta donde le alcance la suerte</span><div class="crece"></div><button class="btn acc chico" data-acc="canica">Soltar una canica</button><button class="btn chico" data-acc="canicas">1,000 canicas</button></div>
      ${ultima ? `<div class="fila" style="margin-top:10px;gap:10px"><span class="pill ${/quemada/.test(ultima.fin) ? 'mal' : 'ok'}">${h(ultima.fin.toUpperCase())}</span><span class="mono dim">${ultima.dia} días · ${ultima.pagos} retiro${ultima.pagos === 1 ? '' : 's'} · cobrado ${fmt(ultima.cobrado)}</span></div>
        <div class="ruta">${ultima.ruta.filter(r => r.hito || r.fin || r.dia === 0).map(r => `<span class="cam ${r.fin ? 'quema' : r.hito ? 'fin' : 'raiz'}">${r.dia === 0 ? 'D0 · ' + num(r.bal) : 'D' + r.dia + ' · ' + (r.fin ? 'QUEMADA ' : r.hito + ' ') + num(r.bal)}</span>`).join('<span class="dim">→</span>')}</div>
        <div class="camino-mini">${ultima.ruta.slice(0, 120).map(r => `<i class="${r.fase} ${r.hito ? 'hito' : ''} ${r.fin ? 'fin' : ''}" title="D${r.dia} · ${num(r.bal)} · ${r.fase}" style="height:${Math.max(6, Math.min(60, (r.bal - (P.inicial - P.quema)) / (P.buffer + P.tope + P.quema) * 60))}px"></i>`).join('')}</div>` : `<div class="mini dim" style="margin-top:8px">Suelta una canica y verás su camino en las pirámides de abajo.</div>`}
      ${lote ? `<div class="grid g6" style="margin-top:12px">
        ${kpi('Pasan la eval', Math.round(lote.pasan/lote.n*100) + '%', 'de ' + lote.n.toLocaleString('en-US') + ' canicas')}${kpi('Llegan al buffer', Math.round(lote.buffer/lote.n*100) + '%', '')}${kpi('Cobran al menos 1', Math.round(lote.pagan/lote.n*100) + '%', '')}${kpi('Concluyen (' + P.maxPagos + ' retiros)', Math.round(lote.concluyen/lote.n*100) + '%', '')}${kpi('Retiros promedio', (lote.pagos/lote.n).toFixed(2), 'por canica')}${kpi('Cobrado promedio', fmt(lote.cobrado/lote.n), 'por cuenta · ' + Math.round(lote.dias/lote.n) + ' días de vida')}
      </div><div class="mini dim" style="margin-top:8px">Retiros por canica: ${Object.keys(lote.hist).sort((a,b)=>a-b).map(k => k + ' → ' + Math.round(lote.hist[k]/lote.n*100) + '%').join(' · ')}</div>` : ''}</div>

    <div class="grid g3 arboles">
      ${tarjeta('EVAL', 'WIN +' + num(P.evalTP) + ' izquierda · LOSS -' + num(P.evalLoss) + ' derecha · hasta ' + num(P.inicial + P.objetivo), 'et-eval', 'eval')}
      ${tarjeta('FUNDED · BUFFER', 'WIN +' + num(P.fondTP) + ' · LOSS -' + num(P.fondLoss) + ' · hasta ' + num(P.inicial + P.buffer) + ' · se quema en ' + num(P.inicial - P.quema), 'et-buffer', 'buffer')}
      ${tarjeta('PAYOUTS', 'desde el buffer · cobras al tocar ' + num(P.inicial + P.buffer + P.tope) + ' y el balance vuelve al buffer', 'et-payouts', 'payouts')}
    </div>`;
  };
  window.Riesgo = { params, canica, canicas, soltar(){ ultima = canica(params()); }, lote(){ lote = canicas(params(), 1000); }, reset(){ Store.ajustes.simRiesgo = null; Store.guardar(); } };
})();
