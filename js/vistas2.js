/* ============================================================================
   MESA — vistas: reportes, backtesting, cuentas, payouts, playbook, ajustes
   ========================================================================= */
(function(){
  const {h, fmt, pct, signo, masMenos, kpi, opciones, fechaLarga, fechaCorta, vacio, aviso} = UI;

  function tablaDesglose(titulo, filas, nota){
    if(!filas.length) return `<div class="card"><h3>${h(titulo)}</h3>${vacio('Sin datos')}</div>`;
    const max = Math.max(...filas.map(f => Math.abs(f.pnl))) || 1;
    return `<div class="card"><h3>${h(titulo)}</h3>${nota ? `<div class="sub">${h(nota)}</div>` : ''}
      <table style="margin-top:8px"><thead><tr><th></th><th class="num">n</th><th class="num">win</th>
      <th class="num">P&L</th><th class="num">expect.</th><th style="width:90px"></th></tr></thead><tbody>
      ${filas.map(f => `<tr><td>${h(f.clave)}</td><td class="num tenue">${f.n}</td>
        <td class="num">${pct(f.winRate,0)}</td>
        <td class="num ${signo(f.pnl)}">${masMenos(f.pnl)}</td>
        <td class="num ${signo(f.expectativa)}">${fmt(f.expectativa)}</td>
        <td><div class="barra ${f.pnl >= 0 ? 'up' : 'down'}"><i style="width:${(Math.abs(f.pnl)/max*100).toFixed(0)}%"></i></div></td></tr>`).join('')}
      </tbody></table></div>`;
  }

  /* ======================================================== REPORTES ==== */
  Vistas.reportes = function(){
    return Vistas.historial() + '<hr class="l" style="margin:26px 0">' + reportesBase() + (Vistas.lab ? '<hr class="l" style="margin:26px 0">' + Vistas.lab() : '');
  };
  function reportesBase(){
    const modo = 'real';
    let t = Store.tradesSel();
    if(!t.length) return `<div class="eti">Reportes</div>${vacio('Registra trades y aquí aparece la radiografía.')}`;

    const m = Stats.metricas(t);
    const D = Stats.desglose;
    const hora = D(t, x => x.hora ? x.hora.slice(0,2) + ':00' : null).sort((a,b) => a.clave < b.clave ? -1 : 1);
    const dow = D(t, x => UI.DOW[new Date(x.fecha + 'T12:00').getDay()]);
    const conf = D(t, x => (x.confluencias||[]).map(c => (ESTRATEGIA.confluencias.find(k => k.id === c)||{txt:c}).txt));
    const pda = D(t, x => x.condicionPDA || null);
    const tp = D(t, x => x.tpTipo === 'interno' ? 'TP interno (conservador)' : 'TP externo');
    const tipo = D(t, x => x.tipo === 'continuacion' ? 'Continuación' : 'Reversión');
    const err = D(t.filter(x => (x.errores||[]).length), x => x.errores);
    const dir = D(t, x => x.direccion === 'long' ? 'Largos' : 'Cortos');
    const estr = D(t, x => x.estrategia || 'Sin estrategia');

    return `
    <div class="fila" style="margin-bottom:12px">
      <div><div class="eti">Reportes · ${Store.cuentasSel().length > 1 ? Store.cuentasSel().length + ' cuentas' : h((Store.cuentaActiva()||{}).alias || 'cuenta')}</div>
      <h2 style="margin:3px 0 0;font-size:19px;font-weight:600">Radiografía de ${t.length} trades</h2></div>
    </div>
    <div class="grid g5" style="margin-bottom:12px">
      ${kpi('Expectativa', fmt(m.expectativa), 'por trade')}
      ${kpi('R promedio', m.rProm != null ? m.rProm.toFixed(2) + 'R' : '—', m.rTotal ? m.rTotal.toFixed(1) + 'R acumulados' : 'captura R en el trade')}
      ${kpi('Mejor / peor', `${fmt(m.mejor)} <span class="tenue">/</span> ${fmt(m.peor)}`, 'trade suelto')}
      ${kpi('Racha', `${m.rachaG}G <span class="tenue">/</span> ${m.rachaP}P`, 'máximas seguidas')}
      ${kpi('Disciplina', m.adherencia.toFixed(0) + '/100', 'promedio de las 4 reglas')}
    </div>
    <div class="card" style="margin-bottom:12px"><h3>Hallazgos</h3>
      <div style="margin-top:9px;display:flex;flex-direction:column;gap:7px">${hallazgos(t).map(x => `<div class="fila" style="align-items:flex-start;gap:8px">
        <span class="mono ${x.tono}" style="font-size:10px;margin-top:2px">${x.tono === 'up' ? '▲' : x.tono === 'down' ? '▼' : '■'}</span>
        <span style="font-size:12.5px;color:var(--dim)">${x.txt}</span></div>`).join('')}</div></div>
    <div class="grid g2" style="margin-bottom:12px">
      ${tablaDesglose('Por estrategia', estr, 'Cuál rinde y cuál te cuesta')}
      ${tablaDesglose('Por regla de TP', tp, 'Regla 4: el TP conservador debería ganarte más veces')}
    </div>
    <div class="grid g2" style="margin-bottom:12px">
      ${tablaDesglose('Continuación vs reversión', tipo, 'Regla 2: solo continuaciones')}
    </div>
    <div class="grid g2" style="margin-bottom:12px">
      ${tablaDesglose('Por confluencia', conf, 'Un trade puede contar en varias')}
      ${tablaDesglose('Por PDA de la condición', pda, 'Regla 1: sobre qué decides el día')}
    </div>
    <div class="grid g2" style="margin-bottom:12px">
      ${tablaDesglose('Por hora de entrada', hora)}
      ${tablaDesglose('Por día de la semana', dow)}
    </div>
    <div class="grid g2">
      ${tablaDesglose('Por dirección', dir)}
      ${tablaDesglose('Por error cometido', err, 'Cuánto te cuesta cada vicio')}
    </div>`;
  };

  function hallazgos(t){
    const out = [];
    const cmp = (a, b, nomA, nomB, minN) => {
      if(a.length < (minN||8) || b.length < (minN||8)) return null;
      const ma = Stats.metricas(a), mb = Stats.metricas(b);
      return {ma, mb, nomA, nomB};
    };
    const lim = t.filter(x => Motor.adherencia(x).limpio), rot = t.filter(x => !Motor.adherencia(x).limpio);
    let c = cmp(lim, rot, 'con las 4 reglas', 'rompiendo alguna', 5);
    if(c) out.push({tono: c.ma.winRate > c.mb.winRate ? 'up' : 'down',
      txt: `Con las 4 reglas cumplidas ganas <b class="mono">${pct(c.ma.winRate,0)}</b> de tus trades y sacas ${fmt(c.ma.expectativa)} por trade; rompiendo alguna, <b class="mono">${pct(c.mb.winRate,0)}</b> y ${fmt(c.mb.expectativa)}.`});

    const inte = t.filter(x => x.tpTipo === 'interno'), ext = t.filter(x => x.tpTipo === 'externo');
    c = cmp(inte, ext, 'TP interno', 'TP externo', 5);
    if(c) out.push({tono: c.ma.winRate >= c.mb.winRate ? 'up' : 'down',
      txt: `TP a liquidez interna: <b class="mono">${pct(c.ma.winRate,0)}</b> de acierto. Yendo por la externa: <b class="mono">${pct(c.mb.winRate,0)}</b>. Diferencia de ${fmt(c.ma.expectativa - c.mb.expectativa)} por trade.`});

    const rev = t.filter(x => x.tipo === 'reversion');
    if(rev.length >= 3){ const mr = Stats.metricas(rev);
      out.push({tono: mr.pnl >= 0 ? 'acc' : 'down',
        txt: `Tomaste <b class="mono">${rev.length}</b> reversiones (la regla 2 las prohíbe): ${masMenos(mr.pnl)} y win ${pct(mr.winRate,0)}.`}); }

    const sinCond = t.filter(x => !x.condicion || !x.condicion.trim());
    if(sinCond.length){ const ms = Stats.metricas(sinCond);
      out.push({tono: ms.pnl >= 0 ? 'acc' : 'down',
        txt: `<b class="mono">${sinCond.length}</b> trades sin condición escrita: ${masMenos(ms.pnl)}. Esos son los que no deberían existir.`}); }

    const dias = Motor.porDia(t);
    const sobreop = dias.filter(d => d.n > Store.ajustes.maxTradesDia);
    if(sobreop.length){ const p = sobreop.reduce((a,d) => a + d.pnl, 0);
      out.push({tono: p >= 0 ? 'acc' : 'down',
        txt: `<b class="mono">${sobreop.length}</b> días pasaste tu tope de ${Store.ajustes.maxTradesDia} trades: ${masMenos(p)} en total.`}); }

    const mej = dias.length ? Math.max(...dias.map(d => d.pnl)) : 0;
    const tot = dias.reduce((a,d) => a + d.pnl, 0);
    if(tot > 0 && mej / tot > 0.4)
      out.push({tono:'down', txt:`Tu mejor día es el <b class="mono">${pct(mej/tot,0)}</b> de toda tu ganancia. Cualquier firma con consistencia de 40% te bloquearía el retiro hoy.`});

    if(t.length < 30) out.push({tono:'acc', txt:`Llevas <b class="mono">${t.length}</b> trades. Debajo de 30 la muestra no dice nada todavía — sigue registrando antes de sacar conclusiones.`});
    return out;
  }

  /* ======================================================= BACKTEST ==== */
  Vistas.backtest = function(){
    const S = Store.estado;
    const ses = S.sesiones;
    const todosBt = S.trades.filter(t => t.modo === 'backtest');
    const estrSel = Store.ajustes.btEstrategia || '';
    const bt = estrSel ? todosBt.filter(t => (t.estrategia || 'Sin estrategia') === estrSel) : todosBt;
    const estrategias = [...new Set((Store.ajustes.estrategias || []).concat(todosBt.map(t => t.estrategia || 'Sin estrategia')))];
    const m = Stats.metricas(bt);

    const filas = ses.map(s => {
      const ts = bt.filter(t => t.sesionId === s.id);
      const ms = Stats.metricas(ts);
      return `<tr>
        <td><b style="font-weight:500">${h(s.nombre)}</b>${s.variante ? `<div class="mini tenue">${h(s.variante)}</div>` : ''}</td>
        <td class="mono tenue">${h(s.instrumento)}</td>
        <td class="mono tenue">${h(s.desde || '—')} → ${h(s.hasta || '—')}</td>
        <td class="num">${ts.length}</td>
        <td class="num">${pct(ms.winRate,0)}</td>
        <td class="num">${ms.pf === Infinity ? '∞' : ms.pf.toFixed(2)}</td>
        <td class="num ${signo(ms.rTotal)}">${ms.rTotal ? ms.rTotal.toFixed(1) + 'R' : '—'}</td>
        <td class="num ${signo(ms.pnl)}">${masMenos(ms.pnl)}</td>
        <td class="num">${ms.adherencia.toFixed(0)}</td>
        <td style="text-align:right">
          <button class="btn chico fantasma" data-acc="tradeSesion" data-id="${s.id}">+ trade</button>
          <button class="btn chico fantasma" data-acc="borraSesion" data-id="${s.id}">✕</button></td></tr>`;
    }).join('');

    const comparar = '';

    return `
    <div class="fila" style="margin-bottom:12px">
      <div><div class="eti">Backtesting${estrSel ? ' · ' + h(estrSel) : ''}</div>
      <h2>${bt.length} trades probados <span class="dim mono" style="font-size:13px">${m.rTotal ? m.rTotal.toFixed(1)+'R · ' : ''}win ${pct(m.winRate,0)}</span></h2></div>
      <div class="crece"></div>
      <label class="campo" style="min-width:230px"><span>Estrategia</span><select data-ajuste="btEstrategia">${opciones([{v:'', t:'Todas las estrategias'}].concat(estrategias.map(e => ({v:e, t:e}))), estrSel)}</select></label>
      <button class="btn acc" data-acc="tradeBacktest">+ Trade de backtest</button>
    </div>
    ${bt.length < 30 ? aviso('Antes de arriesgar una cuenta: <b>mínimo 50 trades</b> de backtest de esta estrategia. Con menos, cualquier win rate es ruido.') : ''}
    <div class="grid g5" style="margin:12px 0">
      ${kpi('Trades', bt.length, estrSel ? 'de ' + todosBt.length + ' en total' : estrategias.length + ' estrategias')}
      ${kpi('Win rate', pct(m.winRate,1), `${m.ganadas}G · ${m.perdidas}P`)}
      ${kpi('Profit factor', m.pf === Infinity ? '∞' : m.pf.toFixed(2), 'bruto ganado / perdido')}
      ${kpi('R acumulados', m.rTotal ? m.rTotal.toFixed(1) + 'R' : '—', m.rProm != null ? m.rProm.toFixed(2) + 'R por trade' : '')}
      ${kpi('Disciplina', m.adherencia.toFixed(0) + '/100', 'adherencia a las 4 reglas')}
    </div>
    ${comparar}
    <div class="card" style="margin-bottom:12px"><h3>Curva de R</h3>
      
      <div style="margin-top:10px">${curvaR(bt)}</div></div>
    <div class="card" style="padding:0"><div class="tabla-scroll">${Vistas._tablaTrades(bt.slice().reverse().slice(0,40), true)}</div></div>`;
  };

  function curvaR(trades){
    const ord = trades.slice().sort((a,b) => (a.fecha + (a.hora||'')) < (b.fecha + (b.hora||'')) ? -1 : 1);
    let acc = 0;
    const pts = [{bal:0}].concat(ord.map(t => { acc += (t.r != null && t.r !== '' && !isNaN(+t.r)) ? +t.r : (Motor.neto(t) > 0 ? 1 : Motor.neto(t) < 0 ? -1 : 0); return {bal: acc}; }));
    return pts.length > 2 ? Stats.linea(pts, {base:0, color:'var(--azul)'}) : Stats.vacio(640, 180, 'Registra trades de backtest');
  }

  /* ===================================================== HISTORIAL ==== */
  /* Mismo formato que Backtesting, pero con TODAS las cuentas reales:
     el desempeño general, lo invertido en evaluaciones y lo cobrado. */
  function porMes(trades){
    const m = new Map();
    trades.forEach(t => { const k = t.fecha.slice(0,7); if(!m.has(k)) m.set(k, []); m.get(k).push(t); });
    return [...m.entries()].sort((a,b) => a[0] < b[0] ? 1 : -1).map(([k, ts]) => Object.assign({clave:k}, Stats.metricas(ts)));
  }
  function tablaMeses(trades){
    const meses = porMes(trades);
    if(!meses.length) return '';
    return `<div class="card" style="margin-bottom:12px"><h3>Mes a mes</h3>
      <div class="tabla-scroll"><table style="margin-top:8px"><thead><tr><th>Mes</th><th class="num">trades</th><th class="num">días</th><th class="num">win</th>
      <th class="num">PF</th><th class="num">R</th><th class="num">P&L</th><th class="num">mejor día</th><th class="num">peor día</th><th class="num">disc.</th></tr></thead><tbody>
      ${meses.map(x => { const [y,mm] = x.clave.split('-'); return `<tr><td style="text-transform:capitalize">${UI.MESES[+mm-1]} ${y}</td>
        <td class="num">${x.n}</td><td class="num">${x.dias}</td><td class="num">${pct(x.winRate,0)}</td>
        <td class="num">${x.pf === Infinity ? '∞' : x.pf.toFixed(2)}</td><td class="num ${signo(x.rTotal)}">${x.rTotal ? x.rTotal.toFixed(1) + 'R' : '—'}</td>
        <td class="num ${signo(x.pnl)}">${masMenos(x.pnl)}</td><td class="num up">${fmt(x.mejorDia)}</td><td class="num down">${fmt(x.peorDia)}</td>
        <td class="num">${x.adherencia.toFixed(0)}</td></tr>`; }).join('')}</tbody></table></div></div>`;
  }
  Vistas._tablaMeses = tablaMeses;

  Vistas.historial = function(){
    const S = Store.estado;
    const t = S.trades.filter(x => x.modo === 'real');
    const m = Stats.metricas(t);
    const cuentas = S.cuentas;
    const invertido = cuentas.reduce((a,c) => a + (+c.costo||0), 0);
    const pagados = S.payouts.filter(p => p.estado === 'pagado');
    const cobrado = pagados.reduce((a,p) => a + (+p.monto||0) * ((Store.cuenta(p.cuentaId)||{reglas:{}}).reglas.split || 0.9), 0);
    const neto = cobrado - invertido;
    const est = {viva:0, pasada:0, quemada:0, concluida:0};
    cuentas.forEach(c => { const e = Motor.estadoCuenta(c); const k = e.quemada ? 'quemada' : c.estado; est[k] = (est[k]||0) + 1; });

    const filas = cuentas.slice().sort((a,b) => a.comprada < b.comprada ? 1 : -1).map(c => {
      const ts = t.filter(x => x.cuentaId === c.id);
      const ms = Stats.metricas(ts);
      const e = Motor.estadoCuenta(c);
      const pay = S.payouts.filter(p => p.cuentaId === c.id && p.estado === 'pagado').reduce((a,p) => a + (+p.monto||0), 0);
      const estado = e.quemada ? 'quemada' : c.estado;
      const chip = estado === 'viva' ? 'up' : estado === 'quemada' ? 'down' : estado === 'pasada' ? 'azul' : '';
      return `<tr>
        <td><b style="font-weight:500">${h(c.alias || c.firma)}</b><div class="mini tenue mono">${h(c.firma)} · ${h(c.plan)} · ${(c.tamano/1000)}k · ${h(c.comprada||'')}</div></td>
        <td><span class="chip ${chip}" style="padding:2px 7px"><b></b>${estado}</span></td>
        <td class="num">${ts.length}</td>
        <td class="num">${pct(ms.winRate,0)}</td>
        <td class="num">${ms.pf === Infinity ? '∞' : ms.pf.toFixed(2)}</td>
        <td class="num ${signo(ms.rTotal)}">${ms.rTotal ? ms.rTotal.toFixed(1) + 'R' : '—'}</td>
        <td class="num ${signo(ms.pnl)}">${masMenos(ms.pnl)}</td>
        <td class="num">${ms.adherencia.toFixed(0)}</td>
        <td class="num down">${c.costo ? '-' + fmt(c.costo) : '—'}</td>
        <td class="num up">${pay ? fmt(pay * (c.reglas.split||0.9)) : '—'}</td></tr>`;
    }).join('');

    const curvaUSD = (() => {
      const dias = Motor.porDia(t); let acc = 0;
      return [{bal:0}].concat(dias.map(d => ({bal: acc += d.pnl})));
    })();

    return `
    <div class="fila" style="margin-bottom:12px">
      <div><div class="eti">Historial · todas las cuentas</div>
      <h2>${t.length} trades en ${cuentas.length} cuentas <span class="dim mono" style="font-size:13px">${masMenos(m.pnl)} en cuentas · ${m.rTotal ? m.rTotal.toFixed(1) + 'R · ' : ''}win ${pct(m.winRate,0)}</span></h2></div>
      <div class="crece"></div>
      <button class="btn" data-ir="cuentas">Cuentas</button>
      <button class="btn" data-ir="payouts">Payouts</button>
    </div>

    <div class="grid g5" style="margin-bottom:12px">
      ${kpi('Trades', t.length, `${m.dias} días operados`)}
      ${kpi('Win rate', pct(m.winRate,1), `${m.ganadas}G · ${m.perdidas}P · ${m.be}BE`)}
      ${kpi('Profit factor', m.pf === Infinity ? '∞' : m.pf.toFixed(2), `${fmt(m.bruto)} / ${fmt(m.perd)}`)}
      ${kpi('R acumulados', m.rTotal ? m.rTotal.toFixed(1) + 'R' : '—', m.rProm != null ? m.rProm.toFixed(2) + 'R por trade' : '')}
      ${kpi('Disciplina', m.adherencia.toFixed(0) + '/100', 'promedio histórico')}
    </div>

    <div class="grid" style="grid-template-columns:1fr 1fr 1.2fr;margin-bottom:12px">
      ${kpi('Invertido en cuentas', `<span class="down">-${fmt(invertido)}</span>`, `${cuentas.length} cuentas · ${est.viva||0} vivas · ${est.pasada||0} pasadas · ${est.quemada||0} quemadas`)}
      ${kpi('Cobrado a tu bolsillo', `<span class="up">${fmt(cobrado)}</span>`, `${pagados.length} retiros pagados`)}
      ${kpi('Resultado real', `<span class="${signo(neto)}">${masMenos(neto)}</span>`, 'lo cobrado menos lo que costaron las cuentas — el único número que importa', '', 'Los P&L dentro de las cuentas no son tuyos hasta que se cobran')}
    </div>

    <div class="card" style="margin-bottom:12px"><h3>Curva de R</h3>
      <div style="margin-top:10px">${curvaR(t)}</div></div>

    ${tablaMeses(t)}

    <div class="card" style="padding:0"><div class="tabla-scroll">${Vistas._tablaTrades(t.slice().sort((a,b) => (b.fecha+(b.hora||'')) < (a.fecha+(a.hora||'')) ? -1 : 1).slice(0,40), true)}</div></div>`;
  };

  /* ======================================================== CUENTAS ==== */
  Vistas.cuentas = function(){
    const S = Store.estado;
    if(!S.cuentas.length) return `<div class="fila" style="margin-bottom:12px"><div><div class="eti">Cuentas</div>
      <h2 style="margin:3px 0 0;font-size:19px;font-weight:600">Tu flota</h2></div><div class="crece"></div>
      <button class="btn acc" data-acc="nuevaCuenta">+ Nueva cuenta</button></div>
      ${vacio('Sin cuentas todavía.')}`;

    const tarjetas = S.cuentas.map(c => {
      const e = Motor.estadoCuenta(c);
      const fase = Motor.faseReal(e);
      const info = Motor.FASES[fase];
      const activa = c.id === (Store.cuentaActiva()||{}).id;
      return `<div class="card" style="${activa ? 'border-color:var(--acc2)' : ''}">
        <div class="fila">
          <div><b style="font-size:13.5px">${h(c.alias || c.firma)}</b>
            <div class="mini tenue mono">${h(c.firma)} · ${h(c.plan)} · ${(c.tamano/1000)}k</div></div>
          <div class="crece"></div>
          <span class="chip" style="color:${info.color};border-color:${info.color}55"><b></b>${info.nombre}</span>
          ${e.quemada ? '<span class="chip down"><b></b>TRONADA</span>' : ''}
        </div>
        <div class="grid g4" style="margin-top:11px;gap:8px">
          ${kpi('Balance', fmt(e.balance), masMenos(e.ganancia), 'mini')}
          ${kpi('Colchón', `<span class="${e.colchon < c.reglas.maxDD*.35 ? 'down' : ''}">${fmt(e.colchon)}</span>`, 'piso ' + fmt(e.piso), 'mini')}
          ${kpi(c.reglas.target ? 'Falta objetivo' : 'Retirable', c.reglas.target ? fmt(e.faltaTarget) : fmt(e.retirable), c.reglas.target ? 'de ' + fmt(c.reglas.target) : 'sobre buffer', 'mini')}
          ${kpi('Días válidos', e.diasValidos + (c.reglas.minDias ? ' / ' + c.reglas.minDias : ''), e.umbral ? '≥ ' + fmt(e.umbral) : 'sin umbral', 'mini')}
        </div>
        <div class="fila" style="margin-top:11px">
          ${activa ? '<span class="chip on"><b></b>ACTIVA</span>' : `<button class="btn chico" data-acc="activar" data-id="${c.id}">Hacer activa</button>`}
          ${e.pasado && c.fase === 'eval' && c.estado === 'viva' ? `<button class="btn chico acc" data-acc="promover" data-id="${c.id}">Pasar a fondeada</button>` : ''}
          <button class="btn chico fantasma" data-acc="editaCuenta" data-id="${c.id}">Reglas</button>
          <button class="btn chico fantasma" data-acc="borraCuenta" data-id="${c.id}">Borrar</button>
          <div class="crece"></div>
          <span class="mini tenue mono">${h(c.reglas.ddTipo)}${c.reglas.congelaEn != null ? ' · congela en +' + c.reglas.congelaEn : ''}${c.reglas.consistencia ? ' · consist. ' + (c.reglas.consistencia*100) + '%' : ''}</span>
        </div>
        ${e.consist && !e.consist.cumple && e.ganancia > 0 ? aviso(`Consistencia rota: tu mejor día es el <b>${pct(e.consist.actual,0)}</b> del total (tope ${pct(e.consist.limite,0)}). Necesitas <b>${fmt(e.consist.falta)}</b> más de ganancia acumulada para poder cobrar.`) : ''}
      </div>`;
    }).join('');

    return `<div class="fila" style="margin-bottom:12px">
      <div><div class="eti">Cuentas</div><h2 style="margin:3px 0 0;font-size:19px;font-weight:600">Tu flota · ${S.cuentas.length}</h2></div>
      <div class="crece"></div><button class="btn acc" data-acc="nuevaCuenta">+ Nueva cuenta</button></div>
      <div class="grid g2">${tarjetas}</div>
`;
  };

  /* ======================================================== PAYOUTS ==== */
  Vistas.payouts = function(){
    const c = Store.cuentaActiva();
    if(!c) return `<div class="eti">Payouts</div>${vacio('Crea una cuenta primero.')}`;
    const e = Motor.estadoCuenta(c);
    if(c.fase === 'eval') return `<div class="eti">Payouts · ${h(c.alias || c.firma)}</div>
      <h2 style="margin:3px 0 12px;font-size:19px;font-weight:600">Esta cuenta todavía no cobra</h2>
      ${aviso('Es una cuenta de <b>evaluación</b>: aquí no hay retiros. ' + (e.pasado
        ? 'Ya llegaste al objetivo (' + fmt(e.balance) + ' de ' + fmt(e.objetivo) + '): pide la fondeada y luego marca la cuenta como <b>Fondeada</b> en Cuentas → Reglas para activar esta vista.'
        : 'Te faltan ' + fmt(e.faltaTarget) + ' para el objetivo. Cuando la pases, cambia la fase a Fondeada en Cuentas → Reglas.'))}
      <div class="grid g4" style="margin-top:12px">
        ${kpi('Balance', fmt(e.balance), 'inicial ' + fmt(c.inicial))}
        ${kpi('Objetivo', e.objetivo ? fmt(e.objetivo) : '—', e.pasado ? 'cumplido' : 'faltan ' + fmt(e.faltaTarget))}
        ${kpi('Colchón', fmt(e.colchon), 'piso ' + fmt(e.piso))}
        ${kpi('Días operados', e.dias.length, e.diasGanadores + ' ganadores')}
      </div>
      <div class="card" style="margin-top:12px"><h3>Progreso de cada cuenta</h3>
        <div style="margin-top:6px">${progresoCuentas()}</div></div>`;
    const r = c.reglas;
    const ps = Store.payoutsDe(c.id).slice().sort((a,b) => a.fecha < b.fecha ? 1 : -1);
    const cobrado = ps.filter(p => p.estado === 'pagado').reduce((a,p) => a + (+p.monto||0), 0);
    const mio = cobrado * (r.split || 0.9);
    const muerte = r.maxPayouts ? `Esta cuenta se CIERRA al retiro #${r.maxPayouts}. Llevas ${e.payoutsHechos}.` : '';

    return `
    <div class="fila" style="margin-bottom:12px">
      <div><div class="eti">Payouts · ${h(c.alias || c.firma)}</div>
      <h2 style="margin:3px 0 0;font-size:19px;font-weight:600">${fmt(mio)} <span class="dim mono" style="font-size:13px">cobrados a tu bolsillo (${pct(r.split||0.9,0)} de ${fmt(cobrado)})</span></h2></div>
      <div class="crece"></div><button class="btn acc" data-acc="nuevoPayout">+ Registrar retiro</button></div>

    <div class="grid g4" style="margin-bottom:12px">
      ${kpi('Balance', fmt(e.balance), 'inicial ' + fmt(c.inicial))}
      ${kpi('Buffer', fmt(e.buffer), 'debajo de esto no se retira')}
      ${kpi('Arriba del buffer', `<span class="${e.sobreBuffer > 0 ? 'up' : 'dim'}">${fmt(e.sobreBuffer)}</span>`, r.capPayout ? 'tope por retiro ' + fmt(r.capPayout) : '')}
      ${kpi('Puedes pedir', `<span class="${e.retirable >= 250 && !e.bloqueoRetiro.length ? 'up' : 'dim'}">${e.bloqueoRetiro.length ? '—' : fmt(e.retirable)}</span>`,
            e.bloqueoRetiro.length ? 'hay bloqueos' : 'listo para solicitar')}
    </div>

    ${e.bloqueoRetiro.length ? `<div class="card" style="margin-bottom:12px"><h3>Qué te falta para cobrar</h3>
      <ul class="dim" style="font-size:12.5px;margin:8px 0 0;padding-left:17px">${e.bloqueoRetiro.map(b => `<li>${h(b)}</li>`).join('')}</ul></div>`
      : `<div class="card" style="margin-bottom:12px"><h3 class="up">Puedes solicitar ${fmt(e.retirable)}</h3>
         </div>`}

    ${muerte ? aviso(muerte + ' Con topes de ' + (r.capPayout ? fmt(r.capPayout) : '—') + ' por retiro, la extracción máxima de por vida de esta cuenta es ' + (r.capPayout ? fmt(r.capPayout * r.maxPayouts) : '—') + '. Es una cuenta desechable: planea la siguiente antes del último retiro.') : ''}

    <div class="card" style="margin-top:12px"><h3>Progreso de cada cuenta</h3>
      <div style="margin-top:6px">${progresoCuentas()}</div></div>

    <div class="card" style="padding:0;margin-top:12px">${ps.length ? `<div class="tabla-scroll"><table>
      <thead><tr><th>#</th><th>Fecha</th><th class="num">Monto</th><th class="num">A tu bolsillo</th><th>Estado</th><th>Nota</th><th></th></tr></thead>
      <tbody>${ps.map((p,i) => `<tr><td class="mono tenue">${ps.length - i}</td><td class="mono">${h(fechaLarga(p.fecha))}</td>
        <td class="num">${fmt(p.monto)}</td><td class="num up">${fmt(p.monto * (r.split||0.9))}</td>
        <td><span class="pill ${p.estado === 'pagado' ? 'ok' : ''}">${h(p.estado)}</span></td>
        <td class="mini tenue">${h(p.nota || '')}</td>
        <td style="text-align:right"><button class="btn chico fantasma" data-acc="borraPayout" data-id="${p.id}">✕</button></td></tr>`).join('')}
      </tbody></table></div>` : `<div style="padding:14px">${vacio('Sin retiros registrados.')}</div>`}</div>`;
  };

  /* ==================================================== SINCRONIZAR ==== */
  Vistas.sync = function(){
    const S = Store.estado.sync || {archivos:{}, log:[]};
    const E = Sync.estado, A = Sync.API;
    const cfg = S.apiCfg || {};
    const porCal = Store.estado.trades.filter(t => t.porCalificar).length;
    const soporta = !!window.showDirectoryPicker || !!Sync.nativo;
    return `
    <div class="fila" style="margin-bottom:14px">
      <div><div class="eti">Sincronizar</div>
      <h2 style="margin:3px 0 0;font-size:20px;font-weight:700">Tus trades entran solos</h2></div>
      <div class="crece"></div>${Vistas._latido()}
      ${porCal ? `<button class="btn" data-ir="diario">${porCal} por calificar →</button>` : ''}
    </div>
    ${aviso(`<b>Cómo funciona.</b> En Tradovate: <b>Reports → Performance</b> (o Orders) → exportar CSV. Si vigilas tu carpeta de Descargas,
      ese archivo entra a MESA en segundos, sin tocar nada. Los números (entrada, salida, contratos, P&L) llegan solos; lo único tuyo son las 4 reglas,
      que calificas con cuatro toques en el Diario. Las fondeadoras suelen <b>desactivar la API</b> en cuentas eval/funded — por eso la carpeta es el camino principal.`, 'acc')}

    <div class="grid g3" style="margin-top:14px">
      <div class="card">
        <div class="fila"><h3>Carpeta vigilada</h3><div class="crece"></div>
          ${E.activo ? '<span class="chip up"><span class="latido"></span>VIGILANDO</span>' : '<span class="chip">APAGADA</span>'}</div>
        <div class="sub">La vía principal · ${Sync.nativo ? 'nativa de macOS' : 'Chrome / Edge'}</div>
        <p class="dim" style="font-size:12.5px;margin:10px 0">${E.carpeta ? `Carpeta: <b class="mono">${h(E.carpeta)}</b>.` : 'Elige tu carpeta de Descargas una sola vez.'}
          ${E.ultimoScan ? ` Último barrido ${E.ultimoScan.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}.` : ''}
          ${E.error ? `<br><span class="down">${h(E.error)}</span>` : ''}
          ${!soporta ? '<br><span class="down">Este navegador no soporta carpetas vigiladas: usa Chrome o Edge, o arrastra/pega el archivo.</span>' : ''}</p>
        <div class="fila">
          ${E.activo ? `<button class="btn" data-acc="syncEscanear">Barrer ahora</button><button class="btn fantasma" data-acc="syncDetener">Detener</button>`
                     : E.carpeta ? `<button class="btn acc" data-acc="syncReanudar">Reanudar</button><button class="btn fantasma" data-acc="syncCarpeta">Otra carpeta</button>`
                                 : `<button class="btn acc" data-acc="syncCarpeta" ${soporta ? '' : 'disabled'}>Elegir carpeta</button>`}
        </div>
      </div>
      <div class="card">
        <h3>Arrastrar o pegar</h3>
        <div class="sync-zona" id="zona" style="margin-top:10px" data-acc="syncArchivo">Suelta aquí el CSV de Tradovate<br></div>
        <label class="campo" style="margin-top:10px"><span>O pega la tabla (copiada de Tradovate)</span>
          <textarea id="pegado" placeholder="symbol,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp…" style="min-height:64px;font-family:var(--mono);font-size:11px"></textarea></label>
        <div class="fila" style="margin-top:8px"><button class="btn" data-acc="syncPegar">Importar lo pegado</button></div>
      </div>
      <div class="card">
        <div class="fila"><h3>Tradovate API</h3><div class="crece"></div>
          ${A.activo ? '<span class="chip up"><span class="latido"></span>CONECTADA</span>' : '<span class="chip">EXPERIMENTAL</span>'}</div>
        
        ${A.activo ? `<p class="dim" style="font-size:12.5px;margin:10px 0">Sondeo cada 30 s. ${A.ultimo ? 'Último ' + A.ultimo.toLocaleTimeString('es-MX') + '.' : ''}
            ${A.cuentas.length ? 'Cuenta Tradovate: <b class="mono">' + h((A.cuentas.find(c => c.id === A.cuentaId)||{}).name || A.cuentaId) + '</b>.' : ''}
            ${A.error ? '<br><span class="down">' + h(A.error) + '</span>' : ''}</p>
           <button class="btn fantasma" data-acc="apiDesconectar">Desconectar</button>`
        : `<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
            <div class="grid g2" style="gap:8px">
              <label class="campo"><span>Entorno</span><select name="tvEntorno">${opciones([{v:'live',t:'Live'},{v:'demo',t:'Demo'}], cfg.entorno || 'live')}</select></label>
              <label class="campo"><span>Usuario</span><input name="tvUsuario" value="${h(cfg.usuario||'')}" autocomplete="off"></label>
              <label class="campo"><span>Contraseña</span><input name="tvPass" type="password" autocomplete="off"></label>
              <label class="campo"><span>CID (API key)</span><input name="tvCid" value="${h(cfg.cid||'')}" autocomplete="off"></label>
              <label class="campo" style="grid-column:1/-1"><span>Secret (API key)</span><input name="tvSec" type="password" autocomplete="off"></label>
            </div>
            
            ${A.error ? '<div class="down mini">' + h(A.error) + '</div>' : ''}
            <div><button class="btn acc" data-acc="apiConectar">Conectar</button></div></div>`}
      </div>
    </div>

    <div class="card" style="margin-top:14px"><h3>Bitácora de sincronización</h3>
      ${S.log && S.log.length ? `<table style="margin-top:8px"><tbody>${S.log.slice(0,14).map(l => `<tr>
        <td class="mono tenue" style="width:150px">${new Date(l.t).toLocaleString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
        <td>${h(l.msg)}</td></tr>`).join('')}</tbody></table>` : `<div style="margin-top:10px">${vacio('Todavía no ha entrado nada.')}</div>`}
    </div>`;
  };

  /* ------------------------------------------ estrategia de retiros
     Proyecta todas las cuentas vivas con los targets por fase y ordena los
     cobros por fecha: qué cuenta cobra primero, cuánto, qué va a BTC / a
     evals nuevas / a tu bolsillo, y cuándo el mes llega a la meta de Progreso. */
  function estrategiaRetiros(){
    const S = Store.estado, A = Store.ajustes;
    const vivas = S.cuentas.filter(c => c.estado === 'viva' && !Motor.estadoCuenta(c).quemada);
    if(!vivas.length || !Vistas._proyeccion) return '';
    const hoy = Store.hoyISO();
    const fin = new Date(Date.now() + 120*86400000).toLocaleDateString('en-CA');
    const cobros = [];
    vivas.forEach(c => { const p = Vistas._proyeccion(hoy, fin, c); Object.entries(p).forEach(([iso, d]) => d.hitos.filter(x => x.monto).forEach(x => cobros.push(Object.assign({iso, alias: c.alias || c.firma}, x)))); });
    cobros.sort((a,b) => a.iso < b.iso ? -1 : 1);
    if(!cobros.length) return `<div class="card" style="margin-top:12px"><h3>Estrategia de retiros</h3>${vacio('Con las cuentas de hoy no se proyecta ningún cobro en 120 días.')}</div>`;
    const tc = A.tc || 18.5, metaMXN = A.metaMXN || 100000, metaUSD = metaMXN / tc;
    const btcPor = (A.plan5 && A.plan5.btcPorPayout) || 500, reinv = 0.5, costoEval = 155;
    const meses = {}; let acumBolsillo = 0, acumBtc = 0, evalsNuevas = 0, primerMesMeta = null;
    const filas = cobros.slice(0, 24).map((x, i) => {
      const k = x.iso.slice(0,7); meses[k] = (meses[k] || 0) + x.neto;
      const aBtc = Math.min(btcPor, x.neto), resto = x.neto - aBtc, aEv = resto * reinv, aBol = resto - aEv;
      acumBtc += aBtc; acumBolsillo += aBol; evalsNuevas += Math.floor(aEv / costoEval);
      if(!primerMesMeta && meses[k] >= metaUSD) primerMesMeta = k;
      const [y, mm] = k.split('-');
      return `<tr><td class="mono tenue">${i+1}</td><td class="mono">${h(UI.fechaLarga(x.iso))}</td><td><b>${h(x.alias)}</b> <span class="pill">retiro #${x.n}</span></td>
        <td class="num up">${fmt(x.neto)}</td><td class="num">${fmt(aBtc)}</td><td class="num">${fmt(aEv)} <span class="tenue">(${Math.floor(aEv / costoEval)} eval)</span></td><td class="num">${fmt(aBol)}</td>
        <td class="num ${meses[k] >= metaUSD ? 'up' : ''}">${fmt(meses[k])} <span class="tenue">/ ${fmt(metaUSD)}</span>${meses[k] >= metaUSD ? ' ✓' : ''}</td></tr>`;
    }).join('');
    const F = Store.fases();
    const porCuenta = vivas.map(c => { const e = Motor.estadoCuenta(c); const r = c.reglas; const cap = r.capPayout || 0; return {c, e, cap}; });
    const necesarias = Math.ceil(metaUSD / Math.max(1, (porCuenta[0] && porCuenta[0].cap ? porCuenta[0].cap * 0.9 * 5 : 5400)));
    return `<div class="card" style="margin-top:12px"><div class="fila"><h3>Estrategia de retiros · en orden</h3><div class="crece"></div>
        <span class="chip ${primerMesMeta ? 'up' : ''}"><b></b>${primerMesMeta ? 'meta de ' + metaMXN.toLocaleString('es-MX') + ' MXN en ' + UI.MESES[+primerMesMeta.split('-')[1]-1] : 'la meta mensual no se alcanza aún'}</span></div>
      
      <div class="grid g4" style="gap:8px;margin:12px 0">
        ${kpi('Cuentas vivas', vivas.length, vivas.filter(c => c.fase !== 'eval').length + ' fondeadas · ' + vivas.filter(c => c.fase === 'eval').length + ' en examen', 'mini')}
        ${kpi('Para ' + metaMXN.toLocaleString('es-MX') + ' MXN/mes', necesarias + ' fondeadas', fmt(metaUSD) + ' USD · con retiros de ' + fmt(porCuenta[0] && porCuenta[0].cap ? porCuenta[0].cap*0.9 : 1080), 'mini')}
        ${kpi('Próximo cobro', UI.fechaCorta(cobros[0].iso), h(cobros[0].alias) + ' · ' + fmt(cobros[0].neto), 'mini')}
        ${kpi('En 120 días', fmt(cobros.reduce((a,x) => a + x.neto, 0)), cobros.length + ' retiros · BTC ' + fmt(acumBtc) + ' · ' + evalsNuevas + ' evals nuevas', 'mini')}
      </div>
      <div class="tabla-scroll"><table><thead><tr><th>#</th><th>Cuándo</th><th>Cuenta</th><th class="num">a tu bolsillo</th><th class="num">→ BTC</th><th class="num">→ evals nuevas</th><th class="num">→ para ti</th><th class="num">mes vs meta</th></tr></thead><tbody>${filas}</tbody></table></div>
      <div class="mini dim" style="margin-top:10px;line-height:1.6"><b>El orden que manda:</b> 1) cobra en cuanto llegues al tope de retiro, nunca esperes «un poco más» arriba del buffer; 2) de cada cobro, ${fmt(btcPor)} a BTC, la mitad del resto a exámenes nuevos (la siguiente cuenta se compra con el primer payout, no cuando la actual concluya), lo demás a tu bolsillo; 3) para sostener ${metaMXN.toLocaleString('es-MX')} MXN al mes necesitas <b>${necesarias} fondeadas rotando</b> — cada una muere al 5º retiro, así que el horno de exámenes nunca se apaga. ${vivas.filter(c => c.fase !== 'eval').length < necesarias ? '<b class="down">Hoy te faltan ' + (necesarias - vivas.filter(c => c.fase !== 'eval').length) + ' fondeadas: compra la siguiente eval con el próximo cobro.</b>' : '<b class="up">Ya tienes las fondeadas que pide la meta: ahora es no quemarlas.</b>'}</div></div>`;
  }

  /* -------------------------------------------- progreso por cuenta */
  function progresoCuentas(){
    const S = Store.estado;
    if(!S.cuentas.length) return vacio('Sin cuentas.');
    return S.cuentas.slice().sort((a,b) => (a.comprada||'') < (b.comprada||'') ? 1 : -1).map(c => {
      const e = Motor.estadoCuenta(c), r = c.reglas, ini = +c.inicial;
      const muerta = e.quemada || c.estado === 'quemada';
      const evalHecha = c.fase !== 'eval' || e.pasado || c.estado === 'pasada';
      const pEval = r.target ? Math.max(0, Math.min(1, (e.balance - ini) / r.target)) : 1;
      const bufferHecho = c.fase !== 'eval' && e.balance >= e.buffer;
      const pBuf = c.fase === 'eval' ? 0 : Math.max(0, Math.min(1, (e.balance - ini) / Math.max(1, e.buffer - ini)));
      const maxP = r.maxPayouts || null;
      const pPay = maxP ? Math.min(1, e.payoutsHechos / maxP) : (e.payoutsHechos ? 1 : (e.retirable > 0 ? 0.5 : 0));
      const cls = (hecho, activo) => muerta ? 'muerto' : hecho ? 'hecho' : activo ? 'activo' : '';
      const faseNom = muerta ? 'TRONADA' : c.estado === 'concluida' ? 'CONCLUIDA' : Motor.FASES[Motor.faseReal(e)].nombre;
      return `<div class="prog">
        <div class="pn"><b>${h(c.alias || c.firma)}</b><div class="mini tenue mono">${h(c.plan)} · ${(c.tamano/1000)}k · ${faseNom}</div>
          <div class="mono mini ${signo(e.ganancia)}" style="margin-top:2px">${fmt(e.balance)}</div></div>
        <div class="track">
          <div class="tramo ${cls(evalHecha, c.fase === 'eval')}"><i style="width:${(evalHecha ? 100 : pEval*100).toFixed(0)}%"></i>
            <span>EVALUACIÓN<b>${c.fase === 'eval' && r.target ? (evalHecha ? 'pasada' : fmt(e.faltaTarget) + ' para ' + fmt(e.objetivo)) : (c.plan.toLowerCase().includes('fond') && c.fase !== 'eval' && !evalHecha ? 'directa' : 'pasada')}</b></span></div>
          <div class="tramo ${cls(bufferHecho, c.fase !== 'eval' && !bufferHecho)}"><i style="width:${(bufferHecho ? 100 : pBuf*100).toFixed(0)}%"></i>
            <span>BUFFER ${fmt(e.buffer)}<b>${c.fase === 'eval' ? '—' : bufferHecho ? 'arriba · ' + fmt(e.sobreBuffer) + ' libres' : 'faltan ' + fmt(e.buffer - e.balance)}</b></span></div>
          <div class="tramo ${cls(maxP && e.payoutsHechos >= maxP, bufferHecho)}"><i style="width:${(pPay*100).toFixed(0)}%"></i>
            <span>PAYOUTS<b>${e.payoutsHechos}${maxP ? ' de ' + maxP : ''} · ${fmt(e.retirado)} cobrados${!muerta && bufferHecho && e.retirable >= 250 && !e.bloqueoRetiro.length ? ' · puedes pedir ' + fmt(e.retirable) : ''}</b></span></div>
        </div></div>`;
    }).join('');
  }

  /* ======================================================== TRADING ==== */
  /* TradingView aquí mismo: el chart avanzado embebido (widget oficial) y, en la
     app de escritorio, una ventana con TradingView completo para OPERAR con tu
     bróker conectado (Tradovate). En navegador, el botón abre tradingview.com. */
  Vistas.trading = function(){
    const A = Store.ajustes;
    const plat = A.plataforma || 'tradovate';
    const nativo = !!window.__npNativo;
    const sym = A.tvSymbol || 'CAPITALCOM:US100', iv = A.tvIntervalo || '5';
    const tema = document.documentElement.dataset.theme || 'acido', dark = tema !== 'papel';
    const widget = 'https://s.tradingview.com/widgetembed/?frameElementId=tv&symbol=' + encodeURIComponent(sym) + '&interval=' + iv + '&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=' + (dark ? '0a0a0a' : 'f3f2ed') + '&studies=%5B%5D&theme=' + (dark ? 'dark' : 'light') + '&style=1&timezone=America%2FMexico_City&withdateranges=1&locale=es&hideideas=1';
    const URLS = {tradovate:'https://trader.tradovate.com/', tradingview:'https://www.tradingview.com/chart/?symbol=CME_MINI%3AMNQ1!'};
    const simbolos = [['CAPITALCOM:US100','NQ · US100'],['CAPITALCOM:US500','ES · US500'],['BINANCE:BTCUSDT','BTC'],['NASDAQ:QQQ','QQQ'],['AMEX:SPY','SPY']];
    return `
    <div class="fila" style="margin-bottom:12px">
      <div><div class="eti">Trading</div><h2>Opera aquí mismo</h2></div>
      <div class="crece"></div>
      <div class="seg acc" data-seg="plataforma">
        <button data-v="tradovate" class="${plat==='tradovate'?'on':''}">Tradovate</button>
        <button data-v="tradingview" class="${plat==='tradingview'?'on':''}">TradingView</button>
        <button data-v="chart" class="${plat==='chart'?'on':''}">Chart rápido</button></div>
      ${plat === 'chart' ? `<div class="seg" data-seg="tvSym">${simbolos.map(([v,t2]) => `<button data-v="${v}" class="${sym===v?'on':''}">${t2}</button>`).join('')}</div>
      <div class="seg" data-seg="tvIv">${[['1','1m'],['5','5m'],['15','15m'],['60','1h']].map(([v,t2]) => `<button data-v="${v}" class="${iv===v?'on':''}">${t2}</button>`).join('')}</div>` : ''}
      ${plat !== 'chart' && !nativo ? `<button class="btn acc" data-acc="abrirPlataforma" data-id="${plat}">Abrir ${plat === 'tradovate' ? 'Tradovate' : 'TradingView'} en una pestaña</button>` : ''}
    </div>
    <div class="tv-wrap" id="tvWrap" data-url="${plat === 'chart' ? '' : URLS[plat]}">${plat === 'chart' ? `<iframe id="tv" src="${widget}" allowfullscreen allow="clipboard-write"></iframe>`
      : nativo ? `<div class="tv-hueco">cargando ${plat === 'tradovate' ? 'Tradovate' : 'TradingView'}…</div>`
      : `<div class="tv-hueco">${plat === 'tradovate' ? 'Tradovate' : 'TradingView'} no se deja embeber en un navegador: en la <b>app de escritorio</b> se abre aquí mismo con tu sesión. Aquí, usa el botón para abrirlo en una pestaña o el chart rápido.</div>`}</div>
    <div class="mini tenue" style="margin-top:8px">${plat === 'tradovate' ? 'Inicias sesión en Tradovate una vez y se queda: tus cuentas de fondeo, posiciones y órdenes, aquí dentro.' : plat === 'tradingview' ? 'TradingView completo con tu login: indicadores NP, alertas y, con Tradovate conectado, ejecutar órdenes.' : 'Widget gratis de TradingView, sin login: para ver, no para operar. Los futuros del CME solo salen en tu cuenta.'}</div>`;
  };

  /* ======================================================= PLAYBOOK ==== */
  Vistas.playbook = function(){
    return `
    <div style="max-width:900px">
      <div class="eti">Playbook</div>
      <h2 style="margin:3px 0 4px;font-size:21px;font-weight:600">${h(ESTRATEGIA.nombre)}</h2>
      <p class="dim" style="margin:0 0 16px;font-size:13px">${h(ESTRATEGIA.premisa)}</p>
      <div class="grid g2" style="margin-bottom:14px">
        ${ESTRATEGIA.reglas.map((r,i) => `<div class="regla">
          <div class="n">REGLA 0${i+1} · ${r.peso} pts</div>
          <h4>${h(r.titulo)}</h4>
          <p>${h(r.texto)}</p>
          <div class="falla">Si la rompes: ${h(r.falla)}</div></div>`).join('')}
      </div>
      <div class="card" style="margin-bottom:14px"><h3>Risk management</h3>
        <ul class="dim" style="font-size:13.5px;margin:8px 0 0;padding-left:18px;line-height:1.7">${ESTRATEGIA.riesgo.map(x => `<li>${h(x)}</li>`).join('')}</ul></div>
      <div class="card" style="margin-bottom:14px"><h3>Mentalidad</h3>
        <p class="dim" style="margin:8px 0 0;font-size:13px">${h(ESTRATEGIA.mentalidad)}</p></div>
      <div class="grid g2">
        <div class="card"><h3>PDAs que usas</h3>
          <div class="fila" style="margin-top:9px;gap:6px">${ESTRATEGIA.pdas.map(p => `<span class="pill">${h(p)}</span>`).join('')}</div></div>
        <div class="card"><h3>Liquidez de referencia</h3>
          <div class="fila" style="margin-top:9px;gap:6px">${ESTRATEGIA.liquidez.map(p => `<span class="pill">${h(p)}</span>`).join('')}</div></div>
      </div>
      <div class="card" style="margin-top:14px"><h3>Errores que la app te va a contar</h3>
        <div class="fila" style="margin-top:9px;gap:6px">${ESTRATEGIA.errores.map(p => `<span class="pill no">${h(p)}</span>`).join('')}</div></div>
    </div>`;
  };

  /* ======================================================== AJUSTES ==== */
  Vistas.ajustes = function(){
    const A = Store.ajustes;
    const S = Store.estado;
    const P = Tema.perfil(), AL = Alertas.cfg(), alertas = (S.alertas||[]).slice(0,6);
    return `<div style="max-width:920px">
      <div class="eti">Ajustes</div>
      <h2 style="margin:3px 0 14px">Perfil, tema, alertas y topes</h2>

      <div class="grid g2" style="margin-bottom:12px">
        <div class="card"><h3>Perfil</h3>
          <div class="fila" style="margin-top:12px;gap:12px;align-items:flex-start">
            <div class="perfil" style="margin:0;cursor:default"><div class="av">${P.foto ? `<img src="${P.foto}">` : h(P.iniciales)}</div><div><div class="pn">${h(P.nombre)}</div><div class="pf">${h(P.frase)}</div></div></div>
            <button class="btn chico" data-acc="perfilFoto">Foto</button><button class="btn chico fantasma" data-acc="perfilSinFoto">Quitar</button></div>
          <div class="grid g2" style="gap:8px;margin-top:12px">
            <label class="campo"><span>Nombre</span><input data-perfil="nombre" value="${h(P.nombre)}"></label>
            <label class="campo"><span>Iniciales</span><input data-perfil="iniciales" value="${h(P.iniciales)}" maxlength="3"></label>
            <label class="campo"><span>Ciudad</span><input data-perfil="ciudad" value="${h(P.ciudad)}"></label>
            <label class="campo"><span>Frase</span><input data-perfil="frase" value="${h(P.frase)}"></label>
          </div></div>
        <div class="card"><h3>Tema</h3>
          <div class="temas" style="margin-top:12px">${Tema.TEMAS.map(t => `<div class="tema ${(A.tema||'acido')===t.id?'on':''}" data-acc="tema" data-id="${t.id}" data-theme-preview="${t.id}">
            <div class="sw">${t.sw ? `<i style="background:${t.sw[0]}"></i><i style="background:${t.sw[1]};box-shadow:0 0 10px ${t.sw[1]}"></i>` : t.id==='acido'?'<i style="background:#050506"></i><i style="background:#C6FF3D"></i>':t.id==='blanco'?'<i style="background:#050506"></i><i style="background:#F4F4F4"></i>':t.id==='oro'?'<i style="background:#050506"></i><i style="background:#C9A24A"></i>':t.id==='papel'?'<i style="background:#F3F2ED;border:1px solid #ccc"></i><i style="background:#15161A"></i>':'<i style="background:#050914"></i><i style="background:#9FD3FF"></i>'}</div>
            <b>${h(t.n)}</b><small>${h(t.d)}</small></div>`).join('')}</div></div>
      </div>

      <div class="card" style="margin-bottom:12px"><div class="fila"><h3>Alertas de TradingView y avisos al teléfono</h3><div class="crece"></div>
          ${Alertas.est.conectado ? '<span class="chip up"><span class="latido"></span>ESCUCHANDO</span>' : AL.tema ? '<span class="chip down"><b></b>SIN CONEXIÓN</span>' : '<span class="chip">APAGADO</span>'}</div>
        
        <div class="grid g3" style="gap:8px;margin-top:12px">
          <label class="campo"><span>Tu tema (secreto, tipo contraseña)</span><input data-alerta="tema" value="${h(AL.tema)}" placeholder="np-andre-8f3k2"></label>
          <label class="campo"><span>Servidor</span><input data-alerta="servidor" value="${h(AL.servidor)}"></label>
          <label class="campo"><span>Avisos al teléfono</span><select data-alerta="telefono">${opciones([{v:'1',t:'Sí · con la app ntfy'},{v:'0',t:'No'}], AL.telefono ? '1' : '0')}</select></label>
        </div>
        <div class="fila" style="margin-top:10px">
          <button class="btn chico acc" data-acc="alertasConectar">Conectar</button>
          <button class="btn chico" data-acc="alertasProbar">Probar aviso</button>
          <button class="btn chico fantasma" data-acc="alertasDesconectar">Apagar</button>
          ${AL.tema ? `<span class="mono mini tenue">webhook: ${h(Alertas.url())}</span>` : ''}</div>
        ${Alertas.est.error ? `<div class="down mini" style="margin-top:6px">${h(Alertas.est.error)}</div>` : ''}
        
        ${alertas.length ? `<table style="margin-top:10px"><tbody>${alertas.map(a => `<tr><td class="mono tenue" style="width:130px">${new Date(a.t).toLocaleString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td><td>${h(a.datos ? Alertas.resumen(a.datos) : (a.titulo + ' · ' + a.texto))}</td>
          <td style="text-align:right">${a.datos && a.datos.entrada ? `<button class="btn chico" data-acc="alertaTrade" data-id="${a.id}">registrar trade</button>` : ''}</td></tr>`).join('')}</tbody></table>` : ''}
      </div>

      <div class="card" style="margin-bottom:12px"><h3>Risk management</h3>
        <div class="grid g4" style="gap:8px;margin-top:10px">
          <label class="campo"><span>Trades por día (máx)</span><input type="number" step="1" min="1" data-ajuste="maxTradesDia" value="${A.maxTradesDia}"></label>
          <label class="campo"><span>If W → get off the charts</span><select data-ajuste="pararTrasGanada">${opciones([{v:'1',t:'Sí · un ganador y cierro'},{v:'0',t:'No'}], A.pararTrasGanada === false ? '0' : '1')}</select></label>
          <label class="campo"><span>Riesgo máx por trade (% de la cuenta)</span><input type="number" step="0.25" min="0.25" max="5" data-ajuste="riesgoPctCuentaPct" value="${((A.riesgoPctCuenta ?? 0.01)*100).toFixed(2)}"></label>
          <label class="campo"><span>Contratos máx (1 mini)</span><input type="number" step="1" min="1" data-ajuste="maxContratos" value="${A.maxContratos ?? 1}"></label>
        </div>
        </div>
      <div class="card" style="margin-bottom:12px"><h3>Target y daily loss por fase</h3>
        <div class="grid g3" style="gap:8px;margin-top:10px">
          <label class="campo"><span>EVAL · target/día ($)</span><input type="number" step="50" data-fase="eval.target" value="${Store.fases().eval.target}"></label>
          <label class="campo"><span>EVAL · daily loss ($)</span><input type="number" step="50" data-fase="eval.loss" value="${Store.fases().eval.loss}"></label>
          <label class="campo"><span>EVAL · consistencia (0–1)</span><input type="number" step="0.05" min="0" max="1" data-fase="eval.consistencia" value="${Store.fases().eval.consistencia}"></label>
          <label class="campo"><span>FUNDED · target/día ($)</span><input type="number" step="25" data-fase="fond.target" value="${Store.fases().fond.target}"></label>
          <label class="campo"><span>FUNDED · daily loss ($)</span><input type="number" step="25" data-fase="fond.loss" value="${Store.fases().fond.loss}"></label>
          <label class="campo"><span>FUNDED · consistencia (0–1)</span><input type="number" step="0.05" min="0" max="1" data-fase="fond.consistencia" value="${Store.fases().fond.consistencia}"></label>
        </div>
        </div>
      <div class="card" style="margin-bottom:12px"><h3>Copiador (Tradesyncer / group trading)</h3>
        <label class="check ${A.copiador ? 'on' : ''}" style="margin-top:10px;display:inline-flex"><input type="checkbox" data-ajuste="copiador" ${A.copiador ? 'checked' : ''}> Al importar, meter cada trade en <b>todas las cuentas seleccionadas</b> arriba</label>
        </div>
      <div class="card" style="margin-bottom:12px">
        <h3>Riesgo y ejecución</h3>
        <div class="grid g3" style="margin-top:11px">
          <label class="campo"><span>Instrumento</span><select data-ajuste="instrumento">
            ${opciones(Object.keys(INSTRUMENTOS).map(k => ({v:k, t:k + ' · ' + INSTRUMENTOS[k].nombre + ' ($' + INSTRUMENTOS[k].puntoUSD + '/pt)'})), A.instrumento)}</select></label>
          <label class="campo"><span>Stop típico (puntos)</span><input type="number" step="1" data-ajuste="slPuntos" value="${A.slPuntos}"></label>
          <label class="campo"><span>Meta mínima del día ($)</span><input type="number" step="25" data-ajuste="metaDiaria" value="${A.metaDiaria}"></label>
          <label class="campo"><span>Techo del día · cierras ($)</span><input type="number" step="25" data-ajuste="metaMaxDia" value="${A.metaMaxDia ?? 500}"></label>
          <label class="campo"><span>Pérdida máxima al día ($)</span><input type="number" step="25" data-ajuste="perdidaMaxDia" value="${A.perdidaMaxDia ?? 500}"></label>
          <label class="campo"><span>Evaluación en full port</span><select data-ajuste="evalFullPort">${opciones([{v:'1',t:'Sí · contratos máximos, pasar rápido'},{v:'0',t:'No · mismo riesgo que fondeada'}], A.evalFullPort === false ? '0' : '1')}</select></label>
          <label class="campo"><span>Máximo de trades al día</span><input type="number" step="1" data-ajuste="maxTradesDia" value="${A.maxTradesDia}"></label>
          <label class="campo"><span>Parar tras N pérdidas</span><input type="number" step="1" data-ajuste="pararTrasPerdidas" value="${A.pararTrasPerdidas}"></label>
          <label class="campo"><span>Nombre</span><input data-ajuste="nombre" value="${h(A.nombre)}"></label>
          <label class="campo"><span>Riesgo diario en EVAL (% del colchón)</span><input type="number" step="0.05" min="0.05" max="1" data-ajuste="riesgoEvalPct" value="${A.riesgoEvalPct}"></label>
          <label class="campo"><span>Riesgo diario FONDEADO (% del colchón)</span><input type="number" step="0.05" min="0.05" max="1" data-ajuste="riesgoFondPct" value="${A.riesgoFondPct}"></label>
          <label class="campo"><span>Tamaño tras una pérdida (0–1)</span><input type="number" step="0.05" min="0.1" max="1" data-ajuste="reduceTrasPerdida" value="${A.reduceTrasPerdida ?? 0.5}"></label>
          <label class="campo"><span>Colchón mínimo (en stops)</span><input type="number" step="1" min="1" data-ajuste="stopsMinimos" value="${A.stopsMinimos ?? 3}"></label>
        </div>
      </div>
      <div class="card" style="margin-bottom:12px"><h3>Estrategias</h3>
        <textarea data-ajuste="estrategiasTxt" style="margin-top:10px;min-height:70px">${h((A.estrategias||[]).join('\n'))}</textarea></div>
      <div class="card" style="margin-bottom:12px"><h3>Tus datos</h3>
        
        <div class="fila" style="margin-top:11px">
          <button class="btn acc" data-acc="exportarCompleto">Respaldo completo con screenshots</button>
          <button class="btn" data-acc="importar">Importar respaldo</button>
          <button class="btn fantasma" data-acc="exportar">Solo datos (.json)</button>
          <button class="btn fantasma" data-acc="reporteDia">Reporte del día (.md)</button>
          <button class="btn" data-acc="demo">Cargar ejemplo</button>
          <div class="crece"></div>
          <button class="btn mal" data-acc="borrarTodo">Borrar todo</button>
        </div>
        <div class="mini tenue mono" style="margin-top:10px">${S.trades.length} trades · ${S.cuentas.length} cuentas · ${S.sesiones.length} sesiones · ${Object.keys(S.dias).length} días · creado ${h((S.creado||'').slice(0,10))}</div>
      </div>
      <div class="card"><h3>De dónde salen los números de las firmas</h3>
        <p class="dim" style="font-size:12.4px;margin:8px 0 0">Del catálogo verificado leyendo únicamente centros de ayuda oficiales:
        ${Object.entries(FIRMAS).map(([n,f]) => `<b>${h(n)}</b> (${h(f.fuente)}${f.verificado ? ', ' + h(f.verificado) : ''})`).join(' · ')}.
        Las firmas cambian reglas seguido: <b>manda tu contrato</b>. Todo es editable en Cuentas → Reglas.</p></div>
    </div>`;
  };
})();
