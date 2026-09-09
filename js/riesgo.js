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
      evalTP: F.eval.target, evalLoss: F.eval.loss, fondTP: F.fond.target, fondLoss: F.fond.loss, payTP: F.fond.target, payLoss: 250, winRate: Math.round((wrReal != null ? wrReal : 0.6) * 100), quema: 2000
    };
    return Object.assign({}, base, A.simRiesgo || {}, {wrReal, diasReales: dias.length});
  }

  /* ---- una canica: recorre día a día desde la eval con la probabilidad de ganar el día = win rate */
  function canica(P, rnd){
    rnd = rnd || Math.random; const piso = P.inicial - P.quema; let bal = P.inicial, fase = 'eval', dia = 0, pagos = 0, cobrado = 0; const ruta = [{dia:0, bal, fase}];
    while(dia < 400){ dia++; const gana = rnd() < P.winRate / 100;
      if(fase === 'eval'){ bal += gana ? P.evalTP : -P.evalLoss; if(bal <= piso){ ruta.push({dia, bal, fase, fin:'quemada'}); return {ruta, fin:'quemada en eval', dia, pagos, cobrado}; }
        if(bal >= P.inicial + P.objetivo){ ruta.push({dia, bal, fase, hito:'PASAS'}); fase = 'buffer'; bal = P.inicial; continue; } }
      else { bal += gana ? (fase === 'payouts' ? P.payTP : P.fondTP) : -(fase === 'payouts' ? P.payLoss : P.fondLoss); if(bal <= (fase === 'payouts' ? P.inicial + P.buffer - P.quema : piso)){ ruta.push({dia, bal, fase, fin:'quemada'}); return {ruta, fin:'quemada en ' + fase, dia, pagos, cobrado}; }
        if(fase === 'buffer' && bal >= P.inicial + P.buffer){ fase = 'payouts'; ruta.push({dia, bal, fase, hito:'BUFFER'}); continue; }
        if(fase === 'payouts' && bal >= P.inicial + P.buffer + P.tope){ pagos++; cobrado += P.tope * P.split / 100; bal = P.inicial + P.buffer; ruta.push({dia, bal, fase, hito:'COBRAS #' + pagos});
          if(pagos >= P.maxPagos){ return {ruta, fin:'cuenta concluida · ' + pagos + ' retiros', dia, pagos, cobrado}; } continue; } }
      ruta.push({dia, bal, fase}); }
    return {ruta, fin:'sigue viva a los 400 días', dia, pagos, cobrado};
  }
  function canicas(P, n){ const out = {pasan:0, buffer:0, pagan:0, queman:0, concluyen:0, pagos:0, cobrado:0, dias:0}; const hist = {};
    for(let i = 0; i < n; i++){ const c = canica(P); if(c.ruta.some(r => r.hito === 'PASAS')) out.pasan++; if(c.ruta.some(r => r.hito === 'BUFFER')) out.buffer++; if(c.pagos > 0) out.pagan++; if(/quemada/.test(c.fin)) out.queman++; if(/concluida/.test(c.fin)) out.concluyen++; out.pagos += c.pagos; out.cobrado += c.cobrado; out.dias += c.dia; hist[c.pagos] = (hist[c.pagos] || 0) + 1; }
    return Object.assign(out, {n, hist}); }

  /* ---- pirámide por fase, como en la libreta: cada recuadro abre en dos (WIN izquierda · LOSS derecha).
     EVAL: cada día perdido es el drawdown completo → X. BUFFER: −loss por día, se quema en inicial − 2k (4 malos días).
     PAYOUTS: −payLoss por día, se quema en buffer − 2k (8 malos días); cobras al tocar buffer + tope. */
  function piramide(P, etapa){
    /* EVAL: drawdown TRAILING de `quema` desde el pico → con riesgo 2,000 un mal día quema; con 1,000, dos; etc.
       BUFFER: −loss por día, piso fijo en inicial − quema.  PAYOUTS: −payLoss por día, piso fijo en buffer − quema. */
    const cfg = etapa === 'eval' ? {bal0: P.inicial, tp: P.evalTP, dl: P.evalLoss, fin: P.inicial + P.objetivo, finTxt:'PASAS', trailing: true}
      : etapa === 'buffer' ? {bal0: P.inicial, tp: P.fondTP, dl: P.fondLoss, fin: P.inicial + P.buffer, finTxt:'BUFFER', piso: P.inicial - P.quema}
      : {bal0: P.inicial + P.buffer, tp: P.payTP, dl: P.payLoss, fin: P.inicial + P.buffer + P.tope, finTxt:'COBRAS', piso: P.inicial + P.buffer - P.quema};
    const prof = P.prof || 4; const hojas = Math.pow(2, prof), colW = 66, W = Math.max(600, hojas * colW + 40), dy = 78, T = 34, H = T + prof * dy + 40;
    let g = '';
    const nodo = (d, i, bal, pico, quemado) => {
      const piso = cfg.trailing ? pico - P.quema : cfg.piso;
      const x = 20 + (i + 0.5) * (W - 40) / Math.pow(2, d), y = T + d * dy; const term = quemado || bal <= piso ? 'quema' : bal >= cfg.fin ? 'fin' : null;
      const col = term === 'fin' ? UP : term === 'quema' ? DOWN : d === 0 ? TXT : 'var(--dim)';
      const w = Math.min(150, (W - 40) / Math.pow(2, d) - 8); const txt = term === 'fin' ? cfg.finTxt + ' ' + Math.round(bal).toLocaleString('en-US') : term === 'quema' ? 'X ' + Math.round(Math.max(piso, bal)).toLocaleString('en-US') : Math.round(bal).toLocaleString('en-US');
      g += `<rect x="${x - w/2}" y="${y - 10}" width="${w}" height="20" rx="10" fill="${term === 'fin' ? 'var(--upSuave)' : term === 'quema' ? 'var(--downSuave)' : 'rgba(255,255,255,.05)'}" stroke="${col}" stroke-opacity="${term || d === 0 ? .95 : .4}"/>`;
      g += `<text x="${x}" y="${y + 3.5}" text-anchor="middle" font-size="${w < 60 ? 8 : 9.5}" font-weight="${term || d === 0 ? 700 : 400}" fill="${col}" font-family="JetBrains Mono, monospace">${txt}</text>`;
      if(term || d >= prof) return;
      const xl = 20 + (2*i + 0.5) * (W - 40) / Math.pow(2, d+1), xr = 20 + (2*i + 1.5) * (W - 40) / Math.pow(2, d+1), y2 = y + dy;
      g += `<line x1="${x}" y1="${y + 10}" x2="${xl}" y2="${y2 - 10}" stroke="${UP}" stroke-opacity=".6" stroke-width="1.2"/><line x1="${x}" y1="${y + 10}" x2="${xr}" y2="${y2 - 10}" stroke="${DOWN}" stroke-opacity=".6" stroke-width="1.2"/>`;
      if(d === 0) g += `<text x="${(x + xl)/2 - 12}" y="${(y + y2)/2}" text-anchor="end" font-size="9" fill="${UP}" font-family="JetBrains Mono, monospace">WIN +${num(cfg.tp)}</text><text x="${(x + xr)/2 + 12}" y="${(y + y2)/2}" font-size="9" fill="${DOWN}" font-family="JetBrains Mono, monospace">LOSS -${num(cfg.dl)}</text>`;
      const bw = bal + cfg.tp, bl = bal - cfg.dl;
      nodo(d+1, 2*i, bw, Math.max(pico, bw), false); nodo(d+1, 2*i + 1, Math.max(piso, bl), pico, bl <= piso);
    };
    nodo(0, 0, cfg.bal0, cfg.bal0, false);
    return `<div style="overflow-x:auto"><svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:${Math.min(W, Math.round(W * 0.55))}px;height:auto;display:block">${g}</svg></div>`;
  }

  let ultima = null, lote = null;   // la última canica y el último lote (viven mientras la vista esté abierta)
  Vistas.riesgo = function(){
    const P = params(); const A = Store.ajustes, F = Store.fases(), cta = Store.cuentaActiva();
    const ini = cta ? cta.inicial : 50000; const riesgo = ini * (A.riesgoPctCuenta || 0.01);
    const ins = (window.INSTRUMENTOS||{})[A.instrumento] || {puntoUSD:2}; const stopUSD = (A.slPuntos||20) * ins.puntoUSD;
    const contratos = Math.max(1, Math.min((A.instrumento === 'MNQ' || A.instrumento === 'MES') ? (A.maxContratos||1)*10 : (A.maxContratos||1), Math.floor(riesgo / stopUSD)));
    const rr = (a, b) => (a / b).toFixed(2);
    const campo = (k, t, step) => `<label class="campo"><span>${t}</span><input type="number" step="${step || 1}" data-sim="${k}" value="${P[k]}"></label>`;
    const prof = P.prof || 4;
    const tarjeta = (t, sub, cls, etapa) => `<div class="card etapa ${cls}"><div class="fila"><h3>${t}</h3><span class="mono dim">${sub}</span></div><div class="arbol">${piramide(P, etapa)}</div></div>`;
    return `
    <div class="grid g5" style="margin-bottom:14px">
      ${kpi('Riesgo por trade', fmt(riesgo), (A.riesgoPctCuenta||0.01)*100 + '% de ' + fmt(ini))}
      ${kpi('Contratos', contratos + ' ' + A.instrumento, 'stop ' + (A.slPuntos||20) + ' pts = ' + fmt(stopUSD) + ' c/u · máx ' + (A.maxContratos||1) + ' mini')}
      ${kpi('Trades por día', '1–' + (A.maxTradesDia||2), 'if W → fuera · ' + (A.pararTrasPerdidas||2) + ' pérdidas → fuera')}
      ${kpi('Eval', '+' + fmt(P.evalTP) + ' / -' + fmt(P.evalLoss), 'por día · ' + Math.max(1, Math.round(P.quema / P.evalLoss)) + (Math.round(P.quema / P.evalLoss) > 1 ? ' malos días y pierdes' : ' mal día y pierdes'))}
      ${kpi('Fondeada', '+' + fmt(P.fondTP) + ' / -' + fmt(P.fondLoss) + ' · +' + fmt(P.payTP) + ' / -' + fmt(P.payLoss), 'buffer ' + Math.round(P.quema / P.fondLoss) + ' malos días · payouts ' + Math.round(P.quema / P.payLoss))}
    </div>
    <div class="card" style="margin-bottom:14px"><h3>Mis reglas</h3>
      <div class="gestion">
        <div><b>1 · 2 trades al día en NY.</b> Si el día lo opero en Asia o en Londres, uno solo.</div>
        <div><b>2 · Si gano, fuera.</b> Con la primera ganada cierro la plataforma.</div>
        <div><b>3 · Dos pérdidas seguidas y se acabó.</b> O el daily loss, lo que llegue primero.</div>
        <div><b>4 · 1% por trade y máximo un mini.</b> Los contratos salen del stop, no de las ganas.</div>
        <div><b>5 · La etapa manda el tamaño del día.</b> En eval arriesgo ${fmt(P.evalLoss)} para ${fmt(P.evalTP)}: ${Math.max(1, Math.round(P.quema / P.evalLoss))} ${Math.round(P.quema / P.evalLoss) > 1 ? 'malos días' : 'mal día'} y pierdo, paso en ${Math.ceil(P.objetivo / P.evalTP)}. En buffer, +${fmt(P.fondTP)} al día y -${fmt(P.fondLoss)} máximo: tengo ${Math.round(P.quema / P.fondLoss)} malos días. En payouts, -${fmt(P.payLoss)} máximo: tengo ${Math.round(P.quema / P.payLoss)}, y cobro en cuanto toco el tope.</div>
      </div></div>
    <div class="card" style="margin-bottom:14px"><div class="fila"><h3>Parámetros</h3><span class="mono dim">cambia uno y los tres árboles se recalculan</span><div class="crece"></div><span class="mono dim">${prof} niveles</span><button class="btn chico fantasma" data-acc="simProf" data-v="-1">− raíces</button><button class="btn chico fantasma" data-acc="simProf" data-v="1">+ raíces</button><button class="btn chico fantasma" data-acc="simReset">valores de Ajustes</button></div>
      <div class="grid g6" style="margin-top:10px">
        ${campo('inicial', 'Cuenta inicial ($)', 1000)}${campo('objetivo', 'Objetivo eval ($)', 100)}${campo('buffer', 'Buffer ($)', 100)}${campo('tope', 'Tope por retiro ($)', 100)}${campo('quema', 'Drawdown ($)', 100)}${campo('maxPagos', 'Retiros máx', 1)}
        ${campo('evalTP', 'Eval · TP por día ($)', 50)}${campo('evalLoss', 'Eval · riesgo por día ($)', 50)}${campo('fondTP', 'Funded · TP por día ($)', 50)}${campo('fondLoss', 'Buffer · riesgo por día ($)', 50)}${campo('payTP', 'Payouts · TP por día ($)', 50)}${campo('payLoss', 'Payouts · riesgo por día ($)', 50)}${campo('split', 'Split (%)', 5)}
      </div></div>
    <div class="grid g3 arboles">
      ${tarjeta('EVAL', 'WIN +' + num(P.evalTP) + ' izquierda · LOSS -' + num(P.evalLoss) + ' derecha · drawdown ' + num(P.quema) + ' desde el pico · pasas en ' + num(P.inicial + P.objetivo), 'et-eval', 'eval')}
      ${tarjeta('FUNDED · BUFFER', 'WIN +' + num(P.fondTP) + ' · LOSS -' + num(P.fondLoss) + ' · buffer en ' + num(P.inicial + P.buffer) + ' · se quema en ' + num(P.inicial - P.quema), 'et-buffer', 'buffer')}
      ${tarjeta('PAYOUTS', 'desde el buffer · WIN +' + num(P.payTP) + ' · LOSS -' + num(P.payLoss) + ' · cobras en ' + num(P.inicial + P.buffer + P.tope) + ' · se quema en ' + num(P.inicial + P.buffer - P.quema), 'et-payouts', 'payouts')}
    </div>`;
  };
  window.Riesgo = { params, canica, canicas, reset(){ Store.ajustes.simRiesgo = null; Store.guardar(); } };
})();
