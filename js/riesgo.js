/* ============================================================================
   NORTHPOINT — GESTIÓN DE RIESGO: su gestión explicada + árbol de decisión por etapa
   (EVAL · BUFFER · PAYOUTS). Los números salen de Ajustes y de la cuenta activa.
   ========================================================================= */
(function(){
  const {h, fmt, kpi} = UI;
  /* nodo: {q, si, no} · hoja: {fin, tono, nota} */
  function nodo(n){
    if(!n) return '';
    if(n.fin) return `<div class="hoja ${n.tono||''}"><b>${h(n.fin)}</b>${n.nota ? `<span>${h(n.nota)}</span>` : ''}</div>`;
    return `<div class="rama"><div class="preg">${h(n.q)}</div>
      <div class="hijos">
        <div class="hijo"><i class="si">SÍ</i>${nodo(n.si)}</div>
        <div class="hijo"><i class="no">NO</i>${nodo(n.no)}</div></div></div>`;
  }
  Vistas.riesgo = function(){
    const A = Store.ajustes, F = Store.fases(), cta = Store.cuentaActiva(); const est = cta ? Motor.estadoCuenta(cta) : null;
    const ini = cta ? cta.inicial : 50000; const riesgo = ini * (A.riesgoPctCuenta || 0.01);
    const ins = (window.INSTRUMENTOS||{})[A.instrumento] || {puntoUSD:2}; const stopUSD = (A.slPuntos||20) * ins.puntoUSD;
    const contratos = Math.max(1, Math.min((A.instrumento === 'MNQ' || A.instrumento === 'MES') ? (A.maxContratos||1)*10 : (A.maxContratos||1), Math.floor(riesgo / stopUSD)));
    const r = cta ? cta.reglas : {}; const cap = r.capPayout ? fmt(r.capPayout) : 'el tope de tu plan'; const maxP = r.maxPayouts || null;
    const buffer = est && est.buffer ? fmt(est.buffer) : 'el buffer';
    const entrada = {q:'¿Condición cumplida · continuación · equilibrio + FVG · TP interno?', si:{fin:'ENTRA', tono:'ok', nota:`1% = ${fmt(riesgo)} · ${contratos} ${A.instrumento} · stop ${A.slPuntos||20} pts · TP a la liquidez interna`}, no:{fin:'ESPERA', tono:'', nota:'sin las 4 reglas no hay trade'}};
    const diaComun = (loss, tgt) => ({q:'¿Ya ganaste hoy?', si:{fin:'FUERA', tono:'ok', nota:'if W → get off the charts'}, no:{q:`¿Trades de hoy < ${A.maxTradesDia||2} y pérdidas seguidas < ${A.pararTrasPerdidas||2}?`, si:{q:`¿Pérdida del día < ${fmt(loss)}?`, si:entrada, no:{fin:'FUERA', tono:'mal', nota:'daily loss tocado · mañana existe'}}, no:{fin:'FUERA', tono:'mal', nota:'tope de trades del día'}}});
    const arbolEval = {q:`¿Balance ≥ objetivo (${cta && est && est.objetivo ? fmt(est.objetivo) : 'target del examen'})?`, si:{fin:'PIDE LA FONDEADA', tono:'ok', nota:'eval pasada · deja de operar esta cuenta'}, no:diaComun(F.eval.loss, F.eval.target)};
    const arbolBuffer = {q:`¿Balance ≥ ${buffer}?`, si:{fin:'PASAS A PAYOUTS', tono:'ok', nota:'el buffer ya está · ahora cada dólar arriba es tuyo'}, no:diaComun(F.fond.loss, F.fond.target)};
    const arbolPay = {q:`¿Sobre el buffer ≥ ${cap}${r.minDias ? ' y días válidos ≥ ' + r.minDias : ''}?`, si:{q: maxP ? `¿Es el retiro #${maxP} (el último del plan)?` : '¿Es el último retiro que permite el plan?', si:{fin:'COBRA Y LA CUENTA CONCLUYE', tono:'ok', nota:'compra la siguiente con una parte del cobro'}, no:{fin:'COBRA', tono:'ok', nota:'nunca esperes «un poco más» · el balance vuelve al buffer → etapa BUFFER'}}, no:diaComun(F.fond.loss, F.fond.target)};
    const tarjeta = (t, sub, col, arbol) => `<div class="card etapa ${col}"><div class="fila"><h3>${t}</h3><span class="mono dim">${sub}</span></div><div class="arbol">${nodo(arbol)}</div></div>`;
    return `
    <div class="grid g5" style="margin-bottom:14px">
      ${kpi('Riesgo por trade', fmt(riesgo), (A.riesgoPctCuenta||0.01)*100 + '% de ' + fmt(ini))}
      ${kpi('Contratos', contratos + ' ' + A.instrumento, 'stop ' + (A.slPuntos||20) + ' pts = ' + fmt(stopUSD) + ' c/u · máx ' + (A.maxContratos||1) + ' mini')}
      ${kpi('Trades por día', '1–' + (A.maxTradesDia||2), 'if W → fuera · ' + (A.pararTrasPerdidas||2) + ' pérdidas → fuera')}
      ${kpi('Eval', '+' + fmt(F.eval.target) + ' / -' + fmt(F.eval.loss), 'por día · full port para pasar en ~3 días')}
      ${kpi('Fondeada', '+' + fmt(F.fond.target) + ' / -' + fmt(F.fond.loss), 'por día · consistencia ' + Math.round((F.fond.consistencia||0.4)*100) + '%')}
    </div>
    <div class="card" style="margin-bottom:14px"><h3>Mi gestión</h3>
      <div class="gestion">
        <div><b>1 · Condición, no sesgo.</b> El día empieza con un «si esto → entonces aquello» escrito sobre el FVG de la apertura. Reacciono a la que se cumpla.</div>
        <div><b>2 · Solo continuaciones.</b> A favor del impulso, nunca reversiones.</div>
        <div><b>3 · Equilibrio + FVG.</b> La entrada vive en el retroceso 0.705–0.79 del impulso, con un FVG que haga match. Dos confluencias, nunca una.</div>
        <div><b>4 · TP interno.</b> Mi pedazo del pastel: la liquidez interna, no la externa.</div>
        <div><b>5 · 1% y un mini.</b> Nunca más del 1% de la cuenta por trade; los contratos salen del stop, no de las ganas.</div>
        <div><b>6 · 1–2 trades y fuera.</b> Si gano, cierro la plataforma. Dos pérdidas seguidas o el daily loss, y el día se acabó.</div>
        <div><b>7 · La etapa manda el tamaño del día.</b> En eval arriesgo el drawdown para pasar rápido; ya fondeado, +${fmt(F.fond.target)} al día y nunca más de -${fmt(F.fond.loss)}; en payouts, cobro en cuanto toco el tope.</div>
      </div></div>
    <div class="grid g3 arboles">
      ${tarjeta('EVAL', 'target +' + fmt(F.eval.target) + ' · daily loss -' + fmt(F.eval.loss), 'et-eval', arbolEval)}
      ${tarjeta('BUFFER', 'target +' + fmt(F.fond.target) + ' · daily loss -' + fmt(F.fond.loss), 'et-buffer', arbolBuffer)}
      ${tarjeta('PAYOUTS', 'cobra al tope · el balance vuelve al buffer', 'et-payouts', arbolPay)}
    </div>`;
  };
})();
