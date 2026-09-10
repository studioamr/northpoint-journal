/* ============================================================================
   NORTHPOINT — HOY. La única pantalla que mira hacia adelante.
   El día tiene tres momentos y cada uno una sola pregunta, así que la vista
   cambia sola con el reloj:
     1) ANTES DE LA APERTURA  ¿cuál es mi condición? ¿cuánto busco y cuánto arriesgo?
     2) MERCADO ABIERTO       ¿cuánto llevo? ¿me queda bala? ¿cuántos trades me quedan?
     3) DÍA CERRADO           se acabó, y por qué. Dos preguntas de un clic.
   Regla 1 hecha candado: sin condición escrita no se registra un trade de hoy.
   Nada del pasado vive aquí. Para eso están Dashboard y Reportes.
   ========================================================================= */
(function(){
  const {h, fmt, kpi, masMenos, signo} = UI;
  let visto = null;

  /* ------------------------------------------------------------ el estado del día */
  function estadoHoy(){
    const A = Store.ajustes;
    const hoy = Store.hoyISO();
    const dia = Store.dia(hoy);
    const cta = Store.cuentaActiva();
    const est = cta ? Motor.estadoCuenta(cta) : null;
    const trades = cta ? Store.tradesReales(cta.id).filter(t => t.fecha === hoy) : [];
    const pnl = trades.reduce((a, t) => a + Motor.neto(t), 0);
    const abre = Motor.aperturaNY(), ahora = Motor.minAhora(), cierra = abre + 390;   // 9:30 → 16:00 NY
    const finde = [0, 6].includes(new Date(hoy + 'T12:00').getDay());

    /* target y riesgo de hoy: los mismos números del calendario, ya descontado lo que llevas */
    const pr = (Vistas._proyeccion(hoy, hoy, cta) || {})[hoy] || null;
    const P = window.Riesgo && Riesgo.params ? Riesgo.params() : null;
    const etapa = pr ? pr.etapa : 'eval';
    const perdMax = !P ? 0 : etapa === 'eval' ? P.evalLoss : etapa === 'payouts' ? P.payLoss : P.fondLoss;
    const targetTot = !P ? 0 : etapa === 'eval' ? P.evalTP : etapa === 'payouts' ? P.payTP : P.fondTP;

    /* contratos: el 1% de la cuenta entre el stop, topado por el máximo de minis */
    const ins = (window.INSTRUMENTOS || {})[A.instrumento] || {puntoUSD: 2};
    const stopUSD = (A.slPuntos || 20) * ins.puntoUSD;
    const riesgoTrade = (cta ? cta.inicial : 50000) * (A.riesgoPctCuenta || 0.01);
    const techo = (A.instrumento === 'MNQ' || A.instrumento === 'MES') ? (A.maxContratos || 1) * 10 : (A.maxContratos || 1);
    const contratos = Math.max(1, Math.min(techo, Math.floor(riesgoTrade / stopUSD)));

    /* las tres puertas que cierran el día */
    const orden = trades.slice().sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')));
    let corrida = 0, seguidas = 0;
    orden.forEach(t => { const n = Motor.neto(t); if(n < 0){ corrida++; seguidas = Math.max(seguidas, corrida); } else corrida = 0; });
    const gano = orden.some(t => Motor.neto(t) > 0);
    const topeSeguidas = A.pararTrasPerdidas || 2, topeTrades = A.maxTradesDia || 2;
    const razon =
      finde                                              ? 'hoy no se opera' :
      dia.cerrado                                        ? 'lo cerraste tú' :
      (gano && A.pararTrasGanada !== false)              ? 'ganaste' :
      seguidas >= topeSeguidas                           ? topeSeguidas + ' pérdidas seguidas' :
      (perdMax && pnl <= -perdMax)                       ? 'tocaste tu pérdida máxima' :
      trades.length >= topeTrades                        ? 'ya hiciste tus ' + topeTrades + ' trades' :
      ahora >= cierra                                    ? (trades.length ? 'cerró el mercado' : 'mercado cerrado') : null;

    const momento = razon ? 'cerrado' : (ahora < abre ? 'antes' : 'abierto');
    const prox = (() => { const x = new Date(hoy + 'T12:00'); do { x.setDate(x.getDate() + 1); } while([0, 6].includes(x.getDay())); return x.toLocaleDateString('en-CA'); })();
    return {A, hoy, dia, cta, est, trades, pnl, abre, ahora, cierra, finde, pr, P, etapa, perdMax, targetTot,
            contratos, riesgoTrade, stopUSD, seguidas, gano, topeTrades, razon, momento, prox,
            target: pr ? pr.pnl : targetTot, riesgoQueda: pr ? pr.perd : perdMax};
  }

  /* ------------------------------------------------------------ piezas */
  const faltan = m => { const x = Math.max(0, m); const hh = Math.floor(x / 60), mm = x % 60; return hh ? hh + ' h ' + mm + ' min' : mm + ' min'; };

  /* la condición del día: si esto → entonces aquello, escrita ANTES de la apertura */
  function bloqueCondicion(d, fecha, editable, titulo){
    if(!editable && d.condicion) return `
      <div class="hoy-cond hecha">
        <div class="eti">${titulo || 'Tu condición de hoy'}</div>
        <p>${h(d.condicion)}</p>
        ${d.ramaA || d.ramaB ? `<div class="hoy-ramas">${d.ramaA ? `<div><b class="up">A</b> ${h(d.ramaA)}</div>` : ''}${d.ramaB ? `<div><b class="down">B</b> ${h(d.ramaB)}</div>` : ''}</div>` : ''}
        <div class="seg" style="margin-top:10px">${[['A','se activó A'],['B','se activó B'],['no','no se activó']].map(([v, t]) =>
          `<button class="${d.activada === v ? 'on' : ''}" data-hoy="rama" data-v="${v}">${t}</button>`).join('')}</div>
      </div>`;
    return `
      <div class="hoy-cond ${d.condicion ? 'hecha' : 'falta'}">
        <div class="eti">${titulo || (d.condicion ? 'Tu condición de hoy' : 'Escribe la condición antes de que abra')}</div>
        <textarea data-diac="condicion" data-diaf="${fecha}" rows="2" placeholder="Si barre el low de Asia y deja FVG alcista de 5m a las 9:35, largos al 0.705 del impulso">${h(d.condicion)}</textarea>
        <div class="grid g2" style="gap:8px;margin-top:8px">
          <label class="campo"><span>Rama A</span><input data-diac="ramaA" data-diaf="${fecha}" value="${h(d.ramaA)}" placeholder="qué hago si pasa"></label>
          <label class="campo"><span>Rama B</span><input data-diac="ramaB" data-diaf="${fecha}" value="${h(d.ramaB)}" placeholder="qué hago si pasa lo contrario"></label>
        </div>
      </div>`;
  }

  /* dónde vas: evaluación → buffer → payouts */
  function camino(E){
    if(!E.cta || !E.est) return '';
    const e = E.est, ini = +E.cta.inicial, S = E.A.simRiesgo || {};
    const obj = S.objetivo != null ? ini + S.objetivo : (e.objetivo || ini + 3000);
    const buf = S.buffer != null ? ini + S.buffer : (e.buffer || ini + 2100);
    const tope = S.tope != null ? S.tope : ((E.cta.reglas || {}).capPayout || 1000);
    const bal = e.balance;
    const tramo = (t, cls, de, a, listo) => {
      const p = Math.max(0, Math.min(1, (bal - de) / Math.max(1, a - de)));
      return `<div class="cam ${cls} ${listo ? 'listo' : ''}"><div class="cam-b"><i style="width:${(listo ? 1 : p) * 100}%"></i></div>
        <div class="cam-t">${t}<b>${listo ? '✓' : fmt(Math.max(0, a - bal))}</b></div></div>`;
    };
    const pasoEval = e.pasado || E.cta.fase !== 'eval';
    return `<div class="hoy-camino">
      ${tramo('Evaluación', 'ev', ini, obj, pasoEval)}
      ${tramo('Buffer', 'bu', ini, buf, pasoEval && bal >= buf)}
      ${tramo('Payout', 'pa', buf, buf + tope, (e.payoutsHechos || 0) > 0)}
    </div>`;
  }

  /* ------------------------------------------------------------ la vista */
  Vistas.hoy = function(){
    const E = estadoHoy(); visto = E.momento;
    if(!E.cta) return `<div class="vacio-hero"><h2>NORTHPOINT</h2><p class="dim">Da de alta tu cuenta y aquí vas a ver el día.</p>
      <div class="fila" style="justify-content:center;gap:10px;margin-top:14px"><button class="btn acc" data-acc="nuevaCuenta">+ Nueva cuenta</button></div></div>`;

    const listo = !!E.dia.condicion.trim();
    const botonTrade = `<button class="btn acc grande" data-acc="nuevoTrade" ${listo ? '' : 'disabled'}>+ Registrar trade</button>`;
    const candado = listo ? '' : `<div class="hoy-candado">Sin condición escrita no hay trade. Es tu regla número uno.</div>`;

    /* ---- 1 · antes de la apertura */
    if(E.momento === 'antes'){
      return `<div class="hoy-wrap">
        <div class="hoy-hero">
          <div class="hoy-reloj"><b>${faltan(E.abre - E.ahora)}</b><span>para la apertura · ${Motor.hhmm(E.abre)}</span></div>
          <div class="crece"></div>${botonTrade}
        </div>
        ${candado}
        ${bloqueCondicion(E.dia, E.hoy, true)}
        <div class="grid g3" style="margin-top:12px">
          ${kpi('Target de hoy', '<span class="up">+' + fmt(E.target) + '</span>', E.etapa === 'eval' ? 'evaluación' : E.etapa === 'payouts' ? 'payouts' : 'fondeada')}
          ${kpi('Pérdida máxima', '<span class="down">-' + fmt(E.perdMax) + '</span>', 'y se acabó el día')}
          ${kpi('Tamaño', E.contratos + ' ' + E.A.instrumento, 'stop ' + (E.A.slPuntos || 20) + ' pts · ' + fmt(E.riesgoTrade) + ' de riesgo')}
        </div>
        ${camino(E)}</div>`;
    }

    /* ---- 3 · día cerrado */
    if(E.momento === 'cerrado'){
      const buena = E.gano || E.pnl > 0;
      const err = E.dia.errores || [];
      return `<div class="hoy-wrap">
        <div class="hoy-fin ${E.trades.length ? (buena ? 'ok' : 'mal') : ''}">
          ${E.trades.length ? `<div class="eti">${h(E.razon)}</div>` : ''}
          <b>${E.finde ? 'HOY NO SE OPERA' : !E.trades.length ? 'MERCADO CERRADO' :
               Tema.voz(buena ? 'gana.titulo' : 'fin.titulo', buena ? 'SE ACABÓ · YA GANASTE' : 'SE ACABÓ POR HOY')}</b>
          ${!E.trades.length ? `<span class="dim">abre a las ${Motor.hhmm(E.abre)}${E.finde ? '' : ' · escribe la condición antes'}</span>` : ''}
          ${E.trades.length ? `<div class="hoy-num ${signo(E.pnl)}">${masMenos(E.pnl)}</div><span class="dim">${E.trades.length} trade${E.trades.length > 1 ? 's' : ''} hoy</span>` : ''}
        </div>
        ${E.trades.length ? `<div class="hoy-cierre">
          <div class="fila"><div class="eti">¿Respetaste tu condición?</div><div class="crece"></div>
            <div class="seg">${[['si','sí'],['no','no']].map(([v, t]) => `<button class="${E.dia.respeto === v ? 'on' : ''}" data-hoy="respeto" data-v="${v}">${t}</button>`).join('')}</div></div>
          <div class="eti" style="margin-top:12px">¿Qué se te salió?</div>
          <div class="fila" style="gap:6px;flex-wrap:wrap;margin-top:6px">${ESTRATEGIA.errores.map(x =>
            `<button class="check ${err.includes(x) ? 'on' : ''}" data-hoy="err" data-v="${h(x)}">${h(x)}</button>`).join('')}</div>
        </div>` : ''}
        <div style="margin-top:12px">${bloqueCondicion(Store.dia(E.prox), E.prox, true,
          'La condición del ' + new Date(E.prox + 'T12:00').toLocaleDateString('es-MX', {weekday:'long'}))}</div>
        <div class="fila" style="margin-top:12px;gap:10px">
          ${E.dia.cerrado ? `<button class="btn fantasma" data-hoy="abrir">Reabrir el día</button>`
                          : `<button class="btn fantasma" data-hoy="cerrar">Cerrar el día</button>`}
          ${E.finde ? '' : `<button class="btn fantasma" data-acc="nuevoTrade">Registrar otro trade</button>`}
          <div class="crece"></div>
        </div>
        ${camino(E)}</div>`;
    }

    /* ---- 2 · mercado abierto */
    const quedan = Math.max(0, E.topeTrades - E.trades.length);
    return `<div class="hoy-wrap">
      <div class="hoy-hero">
        <div><div class="eti">llevas hoy</div><div class="hoy-num ${signo(E.pnl)}">${masMenos(E.pnl)}</div></div>
        <div class="crece"></div>${botonTrade}
      </div>
      ${candado}
      ${bloqueCondicion(E.dia, E.hoy, !E.dia.condicion)}
      <div class="grid g3" style="margin-top:12px">
        ${kpi('Te falta del target', '<span class="up">+' + fmt(E.target) + '</span>', 'de ' + fmt(E.targetTot) + ' del día')}
        ${kpi('Riesgo que te queda', '<span class="down">-' + fmt(E.riesgoQueda) + '</span>', 'de ' + fmt(E.perdMax) + ' · ' + E.seguidas + ' seguidas')}
        ${kpi('Trades que te quedan', quedan + ' de ' + E.topeTrades, quedan ? E.contratos + ' ' + E.A.instrumento + ' cada uno' : 'se acabó')}
      </div>
      ${camino(E)}</div>`;
  };

  /* ------------------------------------------------------------ acciones */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-hoy]'); if(!b) return;
    const hoy = Store.hoyISO(), d = Store.dia(hoy);
    const acc = b.dataset.hoy, v = b.dataset.v;
    if(acc === 'rama')    Store.guardaDia(hoy, {activada: d.activada === v ? '' : v});
    if(acc === 'respeto') Store.guardaDia(hoy, {respeto: d.respeto === v ? '' : v});
    if(acc === 'err'){ const l = (d.errores || []).slice(); const i = l.indexOf(v); i >= 0 ? l.splice(i, 1) : l.push(v); Store.guardaDia(hoy, {errores: l}); }
    if(acc === 'cerrar')  Store.guardaDia(hoy, {cerrado: true});
    if(acc === 'abrir')   Store.guardaDia(hoy, {cerrado: false});
  });
  /* la condición se guarda sola al salir del campo, sin botón */
  document.addEventListener('change', e => {
    const t = e.target; if(!t.dataset || !t.dataset.diac) return;
    Store.guardaDia(t.dataset.diaf || Store.hoyISO(), {[t.dataset.diac]: t.value});
  });
  /* El reloj se actualiza SOLO en su elemento: repintar entero borraría lo que está escribiendo.
     Solo cuando el día cambia de momento (abre el mercado, se cierra el día) se repinta. */
  setInterval(() => {
    if(document.hidden || location.hash.replace('#','') !== 'hoy') return;
    const E = estadoHoy();
    if(visto && visto !== E.momento){ visto = E.momento; App.pinta(); return; }
    visto = E.momento;
    const r = document.querySelector('.hoy-reloj b'); if(r) r.textContent = faltan(E.abre - E.ahora);
  }, 30000);

  window.Hoy = { estado: estadoHoy };
})();
