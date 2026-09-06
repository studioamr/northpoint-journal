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

  /* ---- pirámide: árbol binario como en la libreta (cada recuadro abre en dos), creciendo hacia abajo.
     WIN a la izquierda, LOSS a la derecha. Verde al llegar a la meta, X al quemar. Se scrollea a lo ancho. */
  function piramide(P, etapa){
    const pisoGlobal = P.inicial - P.quema;   // nadie baja de inicial − 2k
    const cfg = etapa === 'eval' ? {bal0: P.inicial, tp: P.evalTP, dl: P.evalLoss, fin: P.inicial + P.objetivo, finTxt:'PASAS', prof: Math.max(3, Math.min(5, Math.ceil(P.objetivo / P.evalTP)))}
      : etapa === 'buffer' ? {bal0: P.inicial, tp: P.fondTP, dl: P.fondLoss, fin: P.inicial + P.buffer, finTxt:'BUFFER', prof: P.prof || 4}
      : {bal0: P.inicial + P.buffer, tp: P.fondTP, dl: P.fondLoss, fin: P.inicial + P.buffer + P.tope, finTxt:'COBRAS', prof: P.prof || 4};
    const piso = Math.max(pisoGlobal, cfg.bal0 - P.quema);   // y siempre que pierdes 2k desde donde arrancas, pierdes la cuenta
    const hojas = Math.pow(2, cfg.prof), colW = 66, W = Math.max(600, hojas * colW + 40), dy = 78, T = 34, H = T + cfg.prof * dy + 40;
    let g = '';
    const nodo = (d, i, bal) => {
      const x = 20 + (i + 0.5) * (W - 40) / Math.pow(2, d), y = T + d * dy; const term = bal >= cfg.fin ? 'fin' : bal <= piso ? 'quema' : null;
      const col = term === 'fin' ? UP : term === 'quema' ? DOWN : d === 0 ? TXT : 'var(--dim)';
      const w = Math.min(150, (W - 40) / Math.pow(2, d) - 8); const txt = term === 'fin' ? cfg.finTxt + ' ' + Math.round(bal).toLocaleString('en-US') : term === 'quema' ? 'X ' + Math.round(bal).toLocaleString('en-US') : Math.round(bal).toLocaleString('en-US');
      g += `<rect x="${x - w/2}" y="${y - 10}" width="${w}" height="20" rx="10" fill="${term === 'fin' ? 'var(--upSuave)' : term === 'quema' ? 'var(--downSuave)' : 'rgba(255,255,255,.05)'}" stroke="${col}" stroke-opacity="${term || d === 0 ? .95 : .4}"/>`;
      g += `<text x="${x}" y="${y + 3.5}" text-anchor="middle" font-size="${w < 60 ? 8 : 9.5}" font-weight="${term || d === 0 ? 700 : 400}" fill="${col}" font-family="JetBrains Mono, monospace">${txt}</text>`;
      if(term || d >= cfg.prof) return;
      const xl = 20 + (2*i + 0.5) * (W - 40) / Math.pow(2, d+1), xr = 20 + (2*i + 1.5) * (W - 40) / Math.pow(2, d+1), y2 = y + dy;
      g += `<line x1="${x}" y1="${y + 10}" x2="${xl}" y2="${y2 - 10}" stroke="${UP}" stroke-opacity=".6" stroke-width="1.2"/><line x1="${x}" y1="${y + 10}" x2="${xr}" y2="${y2 - 10}" stroke="${DOWN}" stroke-opacity=".6" stroke-width="1.2"/>`;
      if(d === 0) g += `<text x="${(x + xl)/2 - 12}" y="${(y + y2)/2}" text-anchor="end" font-size="9" fill="${UP}" font-family="JetBrains Mono, monospace">WIN +${num(cfg.tp)}</text><text x="${(x + xr)/2 + 12}" y="${(y + y2)/2}" font-size="9" fill="${DOWN}" font-family="JetBrains Mono, monospace">LOSS -${num(cfg.dl)}</text>`;
      nodo(d+1, 2*i, bal + cfg.tp); nodo(d+1, 2*i + 1, Math.max(piso, bal - cfg.dl));   // nadie baja de inicial − 2k: ahí se quema
    };
    nodo(0, 0, cfg.bal0);
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">${g}</svg>`;   // completo a lo ancho de la tarjeta, raíz al centro
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
    const tarjeta = (t, sub, cls, etapa) => `<div class="card etapa ${cls}"><div class="fila"><h3>${t}</h3><span class="mono dim">${sub}</span><div class="crece"></div>${etapa !== 'eval' ? `<span class="mono dim">${prof} niveles</span><button class="btn chico fantasma" data-acc="simProf" data-v="-1">− raíces</button><button class="btn chico fantasma" data-acc="simProf" data-v="1">+ raíces</button>` : ''}</div><div class="arbol">${piramide(P, etapa)}</div></div>`;
    return `
    <div class="grid g5" style="margin-bottom:14px">
      ${kpi('Riesgo por trade', fmt(riesgo), (A.riesgoPctCuenta||0.01)*100 + '% de ' + fmt(ini))}
      ${kpi('Contratos', contratos + ' ' + A.instrumento, 'stop ' + (A.slPuntos||20) + ' pts = ' + fmt(stopUSD) + ' c/u · máx ' + (A.maxContratos||1) + ' mini')}
      ${kpi('Trades por día', '1–' + (A.maxTradesDia||2), 'if W → fuera · ' + (A.pararTrasPerdidas||2) + ' pérdidas → fuera')}
      ${kpi('Eval', '+' + fmt(P.evalTP) + ' / -' + fmt(P.evalLoss), 'por día · R:R ' + rr(P.evalTP, P.evalLoss))}
      ${kpi('Fondeada', '+' + fmt(P.fondTP) + ' / -' + fmt(P.fondLoss), 'por día · R:R ' + rr(P.fondTP, P.fondLoss))}
    </div>
    <div class="card" style="margin-bottom:14px"><h3>Mi gestión</h3>
      <div class="gestion">
        <div><b>1 · Condición, no sesgo.</b> El día empieza con un «si esto → entonces aquello» escrito sobre el FVG de la apertura. Reacciono a la que se cumpla.</div>
        <div><b>2 · Solo continuaciones.</b> A favor del impulso, nunca reversiones.</div>
        <div><b>3 · Equilibrio + FVG.</b> La entrada vive en el retroceso 0.705–0.79 del impulso, con un FVG que haga match. Dos confluencias, nunca una.</div>
        <div><b>4 · TP interno.</b> Mi pedazo del pastel: la liquidez interna, no la externa.</div>
        <div><b>5 · 1% y un mini.</b> Nunca más del 1% de la cuenta por trade; los contratos salen del stop, no de las ganas.</div>
        <div><b>6 · 1–2 trades y fuera.</b> Si gano, cierro la plataforma. Dos pérdidas seguidas o el daily loss, y el día se acabó.</div>
        <div><b>7 · La etapa manda el tamaño del día.</b> En eval arriesgo ${fmt(P.evalLoss)} para ${fmt(P.evalTP)} y paso en 3 días; ya fondeado, +${fmt(P.fondTP)} al día y nunca más de -${fmt(P.fondLoss)}; en payouts, cobro en cuanto toco el tope.</div>
      </div></div>
    <div class="card" style="margin-bottom:14px"><div class="fila"><h3>Parámetros</h3><span class="mono dim">cambia uno y los árboles se recalculan</span><div class="crece"></div><button class="btn chico fantasma" data-acc="simReset">valores de Ajustes</button></div>
      <div class="grid g6" style="margin-top:10px">
        ${campo('inicial', 'Cuenta inicial ($)', 1000)}${campo('objetivo', 'Objetivo eval ($)', 100)}${campo('buffer', 'Buffer ($)', 100)}${campo('tope', 'Tope por retiro ($)', 100)}${campo('quema', 'Se quema a inicial − ($)', 100)}${campo('winRate', 'Win rate por día (%)', 1)}
        ${campo('evalTP', 'Eval · TP por día ($)', 50)}${campo('evalLoss', 'Eval · riesgo por día ($)', 50)}${campo('fondTP', 'Funded · TP por día ($)', 50)}${campo('fondLoss', 'Funded · riesgo por día ($)', 50)}${campo('maxPagos', 'Retiros máx', 1)}${campo('split', 'Split (%)', 5)}
      </div></div>
    <div class="grid g3 arboles">
      ${tarjeta('EVAL', 'WIN +' + num(P.evalTP) + ' izquierda · LOSS -' + num(P.evalLoss) + ' derecha · pasas en ' + num(P.inicial + P.objetivo), 'et-eval', 'eval')}
      ${tarjeta('FUNDED · BUFFER', 'WIN +' + num(P.fondTP) + ' · LOSS -' + num(P.fondLoss) + ' · buffer en ' + num(P.inicial + P.buffer) + ' · se quema en ' + num(P.inicial - P.quema), 'et-buffer', 'buffer')}
      ${tarjeta('PAYOUTS', 'desde el buffer · cobras al tocar ' + num(P.inicial + P.buffer + P.tope), 'et-payouts', 'payouts')}
    </div>`;
  };
  window.Riesgo = { params, canica, canicas, soltar(){ ultima = canica(params()); }, lote(){ lote = canicas(params(), 1000); }, reset(){ Store.ajustes.simRiesgo = null; Store.guardar(); } };
})();
