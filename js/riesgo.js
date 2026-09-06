/* ============================================================================
   NORTHPOINT — GESTIÓN DE RIESGO: su gestión explicada + árbol de decisión por etapa
   (EVAL · BUFFER · PAYOUTS). Los números salen de Ajustes y de la cuenta activa.
   ========================================================================= */
(function(){
  const {h, fmt, kpi} = UI;
  /* árbol con ramas: cada trade es una bifurcación. WIN → rama izquierda → paras el día. LOSS → rama derecha → siguiente trade
     o, si ya no hay más, fuera (y en eval, lo que pasa si se repite). Números: TP = target del día, riesgo = TP/2 (2:1). */
  function arbolSVG(e){
    const W = 620, H = 380; const num = v => '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
    const caja = (x, y, w, lineas, col, fill) => `<rect x="${x - w/2}" y="${y - 22}" width="${w}" height="${lineas.length * 15 + 16}" rx="10" fill="${fill || 'rgba(255,255,255,.05)'}" stroke="${col}" stroke-opacity=".9"/>` +
      lineas.map((t, i) => `<text x="${x}" y="${y + i * 15}" text-anchor="middle" font-size="${i ? 10 : 11}" font-weight="${i ? 400 : 700}" fill="${i ? 'var(--dim)' : col}" font-family="${i ? 'Inter, sans-serif' : 'JetBrains Mono, monospace'}">${t}</text>`).join('');
    const rama = (x1, y1, x2, y2, col, txt) => `<path d="M${x1} ${y1} C ${x1} ${(y1+y2)/2}, ${x2} ${(y1+y2)/2}, ${x2} ${y2}" fill="none" stroke="${col}" stroke-width="2.5" stroke-opacity=".8"/><text x="${(x1+x2)/2 + (x2 < x1 ? -14 : 14)}" y="${(y1+y2)/2 - 4}" text-anchor="middle" font-size="9" font-weight="700" letter-spacing=".12em" fill="${col}" font-family="JetBrains Mono, monospace">${txt}</text>`;
    const UP = 'var(--up)', DOWN = 'var(--down)', TXT = 'var(--txt)', ORO = 'var(--oro)';
    const tp = e.tp, rk = e.riesgo;
    let out = '';
    // raíz: trade 1
    out += rama(310, 62, 150, 150, UP, 'WIN ' + num(tp)) + rama(310, 62, 470, 150, DOWN, 'LOSS ' + num(rk));
    out += caja(310, 40, 250, ['TRADE 1 · riesgo ' + num(rk) + ' · TP ' + num(tp) + ' · 2:1', e.entrada], TXT);
    // izquierda: paras
    out += caja(150, 172, 210, [e.winTitulo, '+' + num(tp) + ' · ' + e.winNota], UP, 'var(--upSuave)');
    // derecha: trade 2
    out += rama(470, 190, 330, 290, UP, 'WIN ' + num(tp)) + rama(470, 190, 540, 290, DOWN, 'LOSS ' + num(rk));
    out += caja(470, 172, 220, ['TRADE 2 · riesgo ' + num(rk) + ' · TP ' + num(tp), 'misma condición, nada de revancha'], TXT);
    // hojas del trade 2
    out += caja(330, 312, 200, ['PARAS · +' + num(tp - rk), 'día verde chico · if W → fuera'], UP, 'var(--upSuave)');
    out += caja(540, 312, 150, [e.lossTitulo, '-' + num(2*rk) + ' · ' + e.lossNota], e.lossCol || DOWN, e.lossCol === ORO ? 'var(--oroSuave)' : 'var(--downSuave)');
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">${out}</svg>`;
  }
  Vistas.riesgo = function(){
    const A = Store.ajustes, F = Store.fases(), cta = Store.cuentaActiva(); const est = cta ? Motor.estadoCuenta(cta) : null;
    const ini = cta ? cta.inicial : 50000; const riesgo = ini * (A.riesgoPctCuenta || 0.01);
    const ins = (window.INSTRUMENTOS||{})[A.instrumento] || {puntoUSD:2}; const stopUSD = (A.slPuntos||20) * ins.puntoUSD;
    const contratos = Math.max(1, Math.min((A.instrumento === 'MNQ' || A.instrumento === 'MES') ? (A.maxContratos||1)*10 : (A.maxContratos||1), Math.floor(riesgo / stopUSD)));
    const r = cta ? cta.reglas : {}; const cap = r.capPayout ? fmt(r.capPayout) : 'el tope de tu plan'; const maxP = r.maxPayouts || null;
    const buffer = est && est.buffer ? fmt(est.buffer) : 'el buffer'; const ORO_ = 'var(--oro)';
    const E = {
      eval:  {tp: F.eval.target, riesgo: F.eval.target/2, entrada: 'condición · continuación · EQ+FVG · TP interno', winTitulo:'PARAS EL DÍA', winNota:'día hecho · faltan ' + (cta && est && est.faltaTarget != null ? fmt(est.faltaTarget) : 'lo que resta') + ' para pasar', lossTitulo:'FUERA', lossNota:'si esto se repite 2 días: cuenta quemada', lossCol: ORO_},
      buffer:{tp: F.fond.target, riesgo: F.fond.target/2, entrada: 'condición · continuación · EQ+FVG · TP interno', winTitulo:'PARAS EL DÍA', winNota:'sumas al buffer', lossTitulo:'FUERA', lossNota:'mañana existe · daily loss -' + fmt(F.fond.loss)},
      pay:   {tp: F.fond.target, riesgo: F.fond.target/2, entrada: 'condición · continuación · EQ+FVG · TP interno', winTitulo:'PARAS · ¿TOPE?', winNota:'si tocaste ' + cap + ' → COBRA', lossTitulo:'FUERA', lossNota:'no toques el buffer · mañana existe'}
    };
    const tarjeta = (t, sub, col, e) => `<div class="card etapa ${col}"><div class="fila"><h3>${t}</h3><span class="mono dim">${sub}</span></div><div class="arbol">${arbolSVG(e)}</div></div>`;
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
      ${tarjeta('EVAL', 'target +' + fmt(F.eval.target) + ' · daily loss -' + fmt(F.eval.loss), 'et-eval', E.eval)}
      ${tarjeta('BUFFER', 'target +' + fmt(F.fond.target) + ' · daily loss -' + fmt(F.fond.loss) + ' · dos trades', 'et-buffer', E.buffer)}
      ${tarjeta('PAYOUTS', 'cobra al tope · el balance vuelve al buffer', 'et-payouts', E.pay)}
    </div>`;
  };
})();
