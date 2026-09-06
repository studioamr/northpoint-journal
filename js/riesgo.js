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
    const caja = (x, y, w, lineas, col, fill) => `<rect x="${x - w/2}" y="${y - 20}" width="${w}" height="${lineas.length * 15 + 14}" rx="10" fill="${fill || 'rgba(255,255,255,.05)'}" stroke="${col}" stroke-opacity=".9"/>` +
      lineas.map((t, i) => `<text x="${x}" y="${y + i * 15}" text-anchor="middle" font-size="${i ? 10 : 11}" font-weight="${i ? 400 : 700}" fill="${i ? 'var(--dim)' : col}" font-family="${i ? 'Inter, sans-serif' : 'JetBrains Mono, monospace'}">${t}</text>`).join('');
    const rama = (x1, y1, x2, y2, col, txt) => `<path d="M${x1} ${y1} C ${x1} ${(y1+y2)/2}, ${x2} ${(y1+y2)/2}, ${x2} ${y2}" fill="none" stroke="${col}" stroke-width="2.5" stroke-opacity=".8"/><text x="${(x1+x2)/2 + (x2 < x1 ? -14 : 14)}" y="${(y1+y2)/2 - 4}" text-anchor="middle" font-size="9" font-weight="700" letter-spacing=".12em" fill="${col}" font-family="JetBrains Mono, monospace">${txt}</text>`;
    const UP = 'var(--up)', DOWN = 'var(--down)', TXT = 'var(--txt)', ORO = 'var(--oro)';
    const tp = e.tp, rk = e.riesgo;
    let out = '';
    if(e.lattice){   // TODOS los caminos, día por día, para irle bajando: cada fila es un día con los balances posibles (izquierda = más alto) y cuántos caminos llegan a cada uno
      const bufBal = e.balance + e.hasta, quemaBal = e.balance - e.quema; const D = 24;
      let vivos = new Map([[e.balance, 1]]); const filas = []; let totBuf = 0, totQuema = 0;
      for(let d = 1; d <= D && vivos.size; d++){ const sig = new Map(); let buf = 0, quema = 0;
        vivos.forEach((c, b) => { const up = b + e.tp, dn = b - e.dl;
          if(up >= bufBal) buf += c; else sig.set(up, (sig.get(up) || 0) + c);
          if(dn <= quemaBal) quema += c; else sig.set(dn, (sig.get(dn) || 0) + c); });
        totBuf += buf; totQuema += quema; vivos = sig;
        filas.push({d, buf, quema, estados: [...sig.entries()].sort((a, b) => b[0] - a[0]), vivos: [...sig.values()].reduce((a, b) => a + b, 0)}); }
      const pill = (txt, cls) => `<span class="cam ${cls}">${txt}</span>`;
      return `<div class="caminos">
        <div class="cam-fila cab"><span class="cam-dia">HOY</span><div class="cam-est">${pill(num(e.balance), 'raiz')}</div></div>
        ${filas.map(f => `<div class="cam-fila"><span class="cam-dia">D${f.d}</span><div class="cam-est">${f.buf ? pill((e.finTxt || 'BUFFER') + ' ×' + f.buf, 'fin') : ''}${f.estados.map(([b, c]) => pill(num(b) + (c > 1 ? ' ×' + c : ''), b > e.balance ? 'arriba' : b < e.balance ? 'abajo' : '')).join('')}${f.quema ? pill('QUEMADA ×' + f.quema, 'quema') : ''}</div></div>`).join('')}
        <div class="cam-fila tot"><span class="cam-dia">Σ</span><div class="cam-est">${pill((e.finTxt || 'BUFFER') + ' · ' + totBuf.toLocaleString('en-US') + ' caminos', 'fin')}${vivos.size ? pill('siguen ' + [...vivos.values()].reduce((a, b) => a + b, 0).toLocaleString('en-US') + ' después del día ' + D, '') : ''}${pill('QUEMADA · ' + totQuema.toLocaleString('en-US') + ' caminos', 'quema')}</div></div>
      </div>`;
    }
    if(e.escalera){   // BUFFER: cada día ganado sube +target por la rama verde hasta el buffer; cada día perdido baja -daily loss por la roja hasta quemar la cuenta
      const nW = Math.max(1, Math.ceil(e.hasta / e.tp)), nL = Math.max(1, Math.ceil(e.quema / e.dl)); const dy = 46; const Hc = 60 + Math.max(nW, nL) * dy + 30; const Wc = 700;
      const x0 = 350, y0 = 40; out += caja(x0, y0, 250, [e.balanceTxt + ' · riesgo ' + num(e.riesgo) + ' · TP ' + num(e.tp)], TXT);
      let px = x0, py = y0;
      for(let k = 1; k <= nW; k++){ const x = x0 - 40 - k * 18, y = y0 + k * dy; const bal = e.balance + Math.min(e.hasta, k * e.tp); const fin = k === nW;
        out += rama(px, py + 18, x, y - 18, UP, k === 1 ? 'WIN +' + num(e.tp) : ''); out += caja(x, y, fin ? 230 : 150, [fin ? 'BUFFER · ' + num(bal) : num(bal)], UP, 'var(--upSuave)'); px = x; py = y; }
      px = x0; py = y0;
      for(let k = 1; k <= nL; k++){ const x = x0 + 40 + k * 30, y = y0 + k * dy; const bal = e.balance - Math.min(e.quema, k * e.dl); const fin = k === nL;
        out += rama(px, py + 18, x, y - 18, DOWN, k === 1 ? 'MAX LOSS -' + num(e.dl) : ''); out += caja(x, y, fin ? 230 : 150, [fin ? 'CUENTA QUEMADA · ' + num(bal) : num(bal)], DOWN, 'var(--downSuave)'); px = x; py = y; }
      return `<svg viewBox="0 0 ${Wc} ${Hc}" style="width:100%;height:auto;display:block">${out}</svg>`;
    }
    if(e.cadena){   // EVAL: si ganas, la rama sigue hasta el objetivo; si pierdes, no hay trade 2
      const n = Math.max(1, Math.min(4, Math.ceil(e.objetivo / tp))); const dy = 92; const Wc = 700; const Hc = 60 + n * dy + 40;
      for(let k = 0; k < n; k++){ const x = 450 - k * 105, y = 40 + k * dy; const xNext = x - 105, yNext = y + dy; const xLoss = x + 125, yLoss = y + dy;
        out += rama(x, y + 22, xNext, yNext - 22, UP, 'WIN ' + num(tp)) + rama(x, y + 22, xLoss, yLoss - 22, DOWN, 'LOSS ' + num(rk));
        out += caja(x, y, 236, ['TRADE ' + (k+1) + ' · riesgo ' + num(rk) + ' · TP ' + num(tp)], k ? UP : TXT, k ? 'var(--upSuave)' : null);
        out += caja(xLoss, yLoss, 170, ['MAX LOSS · -' + num(rk)], DOWN, 'var(--downSuave)'); }
      const xF = 450 - n * 105, yF = 40 + n * dy;
      out += caja(xF, yF, 236, ['OBJETIVO ' + num(e.objetivo)], UP, 'var(--upSuave)');
      return `<svg viewBox="0 0 ${Wc} ${Hc}" style="width:100%;height:auto;display:block">${out}</svg>`;
    }
    // raíz: trade 1
    out += rama(310, 62, 150, 150, UP, 'WIN ' + num(tp)) + rama(310, 62, 470, 150, DOWN, 'LOSS ' + num(rk));
    out += caja(310, 40, 250, ['TRADE 1 · riesgo ' + num(rk) + ' · TP ' + num(tp)], TXT);
    // izquierda: paras
    out += caja(150, 172, 210, [e.winTitulo + ' · +' + num(tp)], UP, 'var(--upSuave)');
    // derecha: trade 2
    out += rama(470, 190, 330, 290, UP, 'WIN ' + num(tp)) + rama(470, 190, 510, 290, DOWN, 'LOSS ' + num(rk));
    out += caja(470, 172, 220, ['TRADE 2 · riesgo ' + num(rk) + ' · TP ' + num(tp)], TXT);
    // hojas del trade 2
    out += caja(330, 312, 200, ['PARAS · +' + num(tp - rk)], UP, 'var(--upSuave)');
    out += caja(510, 312, 190, [e.lossTitulo + ' · -' + num(2*rk)], DOWN, 'var(--downSuave)');
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">${out}</svg>`;
  }
  Vistas.riesgo = function(){
    const A = Store.ajustes, F = Store.fases(), cta = Store.cuentaActiva(); const est = cta ? Motor.estadoCuenta(cta) : null;
    const ini = cta ? cta.inicial : 50000; const riesgo = ini * (A.riesgoPctCuenta || 0.01);
    const ins = (window.INSTRUMENTOS||{})[A.instrumento] || {puntoUSD:2}; const stopUSD = (A.slPuntos||20) * ins.puntoUSD;
    const contratos = Math.max(1, Math.min((A.instrumento === 'MNQ' || A.instrumento === 'MES') ? (A.maxContratos||1)*10 : (A.maxContratos||1), Math.floor(riesgo / stopUSD)));
    const r = cta ? cta.reglas : {}; const cap = r.capPayout ? fmt(r.capPayout) : 'el tope de tu plan'; const maxP = r.maxPayouts || null;
    const buffer = est && est.buffer ? fmt(est.buffer) : 'el buffer'; const ORO_ = 'var(--oro)';
    const piso = ini - 2000;      // el stop de la cuenta siempre es el balance inicial − $2,000 (él lo fijó así)
    const balAct = (cta && est) ? est.balance : ini;
    const objetivoEval = (cta && est && est.objetivo && cta.fase === 'eval') ? est.objetivo : ini + 3000;
    const bufferBal = (est && est.buffer) ? est.buffer : ini + 2100;
    const capPay = (cta && cta.reglas && cta.reglas.capPayout) ? cta.reglas.capPayout : 1000;
    const E = {
      eval:  {lattice: true, finTxt:'PASAS', fin:'pasar la eval', balance: cta && cta.fase === 'eval' ? balAct : ini, hasta: Math.max(F.eval.target, objetivoEval - (cta && cta.fase === 'eval' ? balAct : ini)), quema: Math.max(F.eval.loss, (cta && cta.fase === 'eval' ? balAct : ini) - piso), tp: F.eval.target, dl: F.eval.loss, riesgo: F.eval.loss},
      buffer:{lattice: true, finTxt:'BUFFER', fin:'llegar al buffer', balance: cta && cta.fase !== 'eval' ? balAct : ini, hasta: Math.max(F.fond.target, bufferBal - (cta && cta.fase !== 'eval' ? balAct : ini)), quema: Math.max(F.fond.loss, (cta && cta.fase !== 'eval' ? balAct : ini) - piso), tp: F.fond.target, dl: F.fond.loss, riesgo: F.fond.loss},
      pay:   {lattice: true, finTxt:'COBRAS', fin:'cobrar', balance: bufferBal, hasta: capPay, quema: Math.max(F.fond.loss, bufferBal - piso), tp: F.fond.target, dl: F.fond.loss, riesgo: F.fond.loss}
    };
    /* probabilidad de llegar al buffer antes de quemar la cuenta, con su win rate real por día (o 60% si no hay datos) */
    function probBuffer(e){ const bufBal = e.balance + e.hasta, quemaBal = e.balance - e.quema; const dias = Motor.porDia(Store.tradesReales ? Store.tradesReales((cta||{}).id) : []); const wr = dias.length >= 10 ? dias.filter(x => x.pnl > 0).length / dias.length : 0.6;
      // iteración de valor sobre los balances (paso $100): V = wr·V(b+TP) + (1−wr)·V(b−DL); V(buffer)=1, V(quemada)=0
      const paso = 100, n = Math.round((bufBal - quemaBal) / paso); const V = new Array(n + 1).fill(0.5); V[0] = 0; V[n] = 1;
      const idx = b => Math.max(0, Math.min(n, Math.round((b - quemaBal) / paso)));
      for(let it = 0; it < 2000; it++){ for(let k = 1; k < n; k++){ const b = quemaBal + k * paso; V[k] = wr * V[idx(b + e.tp)] + (1 - wr) * V[idx(b - e.dl)]; } }
      return {p: V[idx(e.balance)], wr, dias: dias.length}; }
    const tarjeta = (t, sub, col, e) => `<div class="card etapa ${col}"><div class="fila"><h3>${t}</h3><span class="mono dim">${sub}</span>${e.lattice ? (() => { const q = probBuffer(e); return `<div class="crece"></div><span class="mono ${q.p >= 0.5 ? 'up' : 'down'}">${Math.round(q.p*100)}% de ${e.fin} antes de quemarla · win rate por día ${Math.round(q.wr*100)}%${q.dias >= 10 ? ' (tus ' + q.dias + ' días)' : ' (supuesto)'}</span>`; })() : ''}</div><div class="arbol">${arbolSVG(e)}</div></div>`;
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
      ${tarjeta('EVAL', 'todos los caminos · +' + fmt(F.eval.target) + ' por día ganado · -' + fmt(F.eval.loss) + ' por día perdido · hasta pasar o quemar', 'et-eval', E.eval)}
      ${tarjeta('BUFFER', 'todos los caminos · +' + fmt(F.fond.target) + ' por día ganado · -' + fmt(F.fond.loss) + ' por día perdido', 'et-buffer', E.buffer)}
      ${tarjeta('PAYOUTS', 'todos los caminos desde el buffer · +' + fmt(F.fond.target) + ' / -' + fmt(F.fond.loss) + ' por día · hasta cobrar ' + fmt(capPay) + ' o quemar', 'et-payouts', E.pay)}
    </div>`;
  };
})();
