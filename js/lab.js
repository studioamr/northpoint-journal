/* ============================================================================
   MESA — LAB · ciencia de datos sobre TUS trades
   Monte Carlo bootstrap contra las reglas de tu cuenta, Kelly, rachas
   esperadas, edge móvil, mapa de calor hora×día y contrafactuales.
   Nada de esto es predicción: es lo que tu muestra dice si se repite.
   ========================================================================= */
(function(){
  const {h, fmt, pct, signo, masMenos, kpi, opciones, vacio, aviso} = UI;
  const neto = Motor.neto;

  /* ------------------------------------------------------------ util */
  function rng(seed){ let x = seed >>> 0 || 1; return () => (x = (x * 1664525 + 1013904223) >>> 0) / 4294967296; }
  const q = (arr, p) => { if(!arr.length) return 0; const s = arr.slice().sort((a,b) => a-b); const i = (s.length-1)*p; const lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi]-s[lo])*(i-lo); };

  /* ------------------------------------------------ Monte Carlo ---- */
  /* Re-muestrea TUS trades (bootstrap) día por día contra las reglas de la
     cuenta: objetivo, drawdown EOD con congelamiento, límite diario.       */
  function monteCarlo(trades, cuenta, opt){
    opt = Object.assign({sims:2000, dias:60, escala:1, semilla:7}, opt||{});
    const r = cuenta.reglas, ini = +cuenta.inicial;
    const est0 = Motor.estadoCuenta(cuenta);          // arranca desde HOY, no desde el inicio
    const pnls = trades.map(t => neto(t) * opt.escala);
    if(pnls.length < 8) return null;
    const porDia = Motor.porDia(trades).map(d => d.n);
    const R = rng(opt.semilla);
    const objetivo = r.target ? ini + r.target : null;
    let pasa = 0, truena = 0, diasPasa = [], finales = [];
    const bandas = Array.from({length: opt.dias+1}, () => []);
    for(let s = 0; s < opt.sims; s++){
      let bal = est0.balance, pico = est0.pico, vivo = true, paso = null;
      bandas[0].push(bal);
      for(let d = 1; d <= opt.dias; d++){
        const k = porDia[Math.floor(R()*porDia.length)] || 1;
        let hoy = 0;
        for(let i = 0; i < k; i++){
          const p = pnls[Math.floor(R()*pnls.length)];
          hoy += p; bal += p;
          if(r.dll && hoy <= -r.dll) break;                    // límite diario: se para
          const piso = pisoDe(pico, ini, r);
          if(bal <= piso){ vivo = false; break; }
          if(objetivo && bal >= objetivo){ paso = d; break; }
        }
        if(!vivo || paso) { for(let dd = d; dd <= opt.dias; dd++) bandas[dd].push(bal); break; }
        pico = Math.max(pico, bal);                            // EOD trailing
        bandas[d].push(bal);
      }
      if(!vivo) truena++;
      else if(paso){ pasa++; diasPasa.push(paso); }
      finales.push(bal);
    }
    const n = opt.sims;
    return {
      n, pPasa: pasa/n, pTruena: truena/n, pSigue: 1 - pasa/n - truena/n,
      diasMediana: diasPasa.length ? q(diasPasa, .5) : null, diasP90: diasPasa.length ? q(diasPasa, .9) : null,
      finalP5: q(finales,.05), finalP50: q(finales,.5), finalP95: q(finales,.95),
      abanico: bandas.map(b => ({p5:q(b,.05), p25:q(b,.25), p50:q(b,.5), p75:q(b,.75), p95:q(b,.95)})),
      objetivo, piso0: est0.piso, desde: est0.balance
    };
  }
  function pisoDe(pico, ini, r){
    if(r.ddTipo === 'estatico') return ini - r.maxDD;
    let piso = pico - r.maxDD;
    if(r.congelaEn != null) piso = Math.min(piso, ini + r.congelaEn);
    if(r.congelaEnObjetivo && r.target) piso = Math.min(piso, ini + r.target - r.maxDD);
    return Math.max(piso, ini - r.maxDD);
  }

  /* --------------------------------------------------- Kelly y rachas */
  function kelly(m){
    if(!m.avgLoss || !m.n) return null;
    const b = m.avgWin / m.avgLoss, p = m.winRate;
    const f = p - (1-p)/b;
    return {f, medio: f/2, b, p};
  }
  const rachaEsperada = (p, n) => (p <= 0 || p >= 1) ? 0 : Math.log(n) / Math.log(1/p);   // pérdida seguida esperada en n trades

  function movil(trades, w){
    const ord = trades.slice().sort((a,b) => (a.fecha+(a.hora||'')) < (b.fecha+(b.hora||'')) ? -1 : 1);
    const out = [];
    for(let i = w; i <= ord.length; i++){
      const v = ord.slice(i-w, i); const g = v.filter(t => neto(t) > 0).length;
      out.push({win: g/w, exp: v.reduce((a,t) => a + neto(t), 0)/w});
    }
    return out;
  }

  function calor(trades){
    const dias = ['lun','mar','mié','jue','vie'];
    const horas = [...new Set(trades.map(t => (t.hora||'').slice(0,2)).filter(Boolean))].sort();
    const celdas = {};
    trades.forEach(t => {
      const d = new Date(t.fecha + 'T12:00').getDay(); if(d < 1 || d > 5) return;
      const k = dias[d-1] + '|' + (t.hora||'').slice(0,2);
      (celdas[k] = celdas[k] || []).push(neto(t));
    });
    return {dias, horas, celdas};
  }

  function contrafactuales(trades){
    const base = Stats.metricas(trades);
    const F = [
      ['Sin reversiones', t => t.tipo !== 'reversion'],
      ['Sin TP externo', t => t.tpTipo !== 'externo'],
      ['Solo dentro de la ventana', t => !(t.errores||[]).includes('Fuera de la ventana')],
      ['Solo con equilibrio + FVG', t => (t.confluencias||[]).includes('equilibrio') && ((t.confluencias||[]).includes('fvg') || (t.confluencias||[]).includes('ifvg'))],
      ['Máximo 3 trades por día', t => true, 'dia'],
      ['Solo el primer trade del día', t => true, 'primero'],
      ['Solo 4/4 reglas', t => Motor.adherencia(t).limpio]
    ];
    return F.map(([nombre, fn, modo]) => {
      let sub;
      if(modo === 'dia'){ sub = []; Motor.porDia(trades).forEach(d => sub.push(...d.trades.slice().sort((a,b) => (a.hora||'') < (b.hora||'') ? -1 : 1).slice(0, Store.ajustes.maxTradesDia))); }
      else if(modo === 'primero'){ sub = Motor.porDia(trades).map(d => d.trades.slice().sort((a,b) => (a.hora||'') < (b.hora||'') ? -1 : 1)[0]); }
      else sub = trades.filter(fn);
      const m = Stats.metricas(sub);
      return {nombre, n: sub.length, m, delta: m.pnl - base.pnl, dWin: m.winRate - base.winRate};
    });
  }

  /* -------------------------------------------------------- gráficas */
  function abanico(ab, o){
    o = Object.assign({w:640, h:220, pad:8}, o||{});
    const ys = ab.flatMap(b => [b.p5, b.p95]).concat([o.objetivo||0, o.piso||0].filter(Boolean));
    const min = Math.min(...ys), max = Math.max(...ys), span = (max-min)||1;
    const X = i => o.pad + i*(o.w-2*o.pad)/(ab.length-1), Y = v => o.h - o.pad - (v-min)/span*(o.h-2*o.pad);
    const path = k1 => ab.map((b,i) => (i?'L':'M') + X(i).toFixed(1) + ' ' + Y(b[k1]).toFixed(1)).join(' ');
    const area = (k1, k2) => path(k1) + ' ' + ab.slice().reverse().map((b,i) => 'L' + X(ab.length-1-i).toFixed(1) + ' ' + Y(b[k2]).toFixed(1)).join(' ') + ' Z';
    const linea = (v, cls, txt) => v ? `<line x1="${o.pad}" x2="${o.w-o.pad}" y1="${Y(v)}" y2="${Y(v)}" class="${cls}" stroke-dasharray="4 4"/><text x="${o.w-o.pad}" y="${Y(v)-4}" text-anchor="end" class="rl">${txt}</text>` : '';
    return `<svg viewBox="0 0 ${o.w} ${o.h}" preserveAspectRatio="none" class="g">
      <path d="${area('p5','p95')}" fill="var(--acc)" opacity=".10"/>
      <path d="${area('p25','p75')}" fill="var(--acc)" opacity=".22"/>
      <path d="${path('p50')}" fill="none" stroke="var(--acc)" stroke-width="2"/>
      ${linea(o.objetivo, 'lObj', 'objetivo')}${linea(o.piso, 'lPiso', 'piso')}</svg>`;
  }
  function histograma(vals, o){
    o = Object.assign({w:640, h:140, bins:18}, o||{});
    if(vals.length < 3) return Stats.vacio(o.w, o.h, 'Sin datos');
    const min = Math.min(...vals), max = Math.max(...vals), span = (max-min)||1;
    const b = new Array(o.bins).fill(0);
    vals.forEach(v => b[Math.min(o.bins-1, Math.floor((v-min)/span*o.bins))]++);
    const mx = Math.max(...b), bw = o.w/o.bins;
    return `<svg viewBox="0 0 ${o.w} ${o.h}" preserveAspectRatio="none" class="g">${b.map((n,i) => {
      const x0 = min + i*span/o.bins; const hgt = n/mx*(o.h-18);
      return `<rect x="${(i*bw+1).toFixed(1)}" y="${(o.h-18-hgt).toFixed(1)}" width="${(bw-2).toFixed(1)}" height="${hgt.toFixed(1)}" fill="${x0 >= 0 ? 'var(--up)' : 'var(--down)'}" opacity=".8"/>`;
    }).join('')}<text x="2" y="${o.h-4}" class="rl">${fmt(min)}</text><text x="${o.w-2}" y="${o.h-4}" text-anchor="end" class="rl">${fmt(max)}</text></svg>`;
  }
  function lineaDoble(serie, o){
    o = Object.assign({w:640, h:150, pad:6}, o||{});
    if(serie.length < 2) return Stats.vacio(o.w, o.h, 'Faltan trades para la ventana móvil');
    const X = i => o.pad + i*(o.w-2*o.pad)/(serie.length-1);
    const Yw = v => o.h - o.pad - v*(o.h-2*o.pad);
    const es = serie.map(s => s.exp), mn = Math.min(0, ...es), mxE = Math.max(...es, 1);
    const Ye = v => o.h - o.pad - (v-mn)/((mxE-mn)||1)*(o.h-2*o.pad);
    return `<svg viewBox="0 0 ${o.w} ${o.h}" preserveAspectRatio="none" class="g">
      <line x1="${o.pad}" x2="${o.w-o.pad}" y1="${Yw(.5)}" y2="${Yw(.5)}" stroke="var(--linea2)" stroke-dasharray="3 4"/>
      <path d="${serie.map((s,i) => (i?'L':'M') + X(i).toFixed(1) + ' ' + Ye(s.exp).toFixed(1)).join(' ')}" fill="none" stroke="var(--dim)" stroke-width="1.2"/>
      <path d="${serie.map((s,i) => (i?'L':'M') + X(i).toFixed(1) + ' ' + Yw(s.win).toFixed(1)).join(' ')}" fill="none" stroke="var(--acc)" stroke-width="2"/></svg>`;
  }

  /* ------------------------------------------------------------ vista */
  let cfg = {fuente:'cuenta', escala:1, sims:2000};
  Vistas.lab = function(){
    const S = Store.estado, cta = Store.cuentaActiva();
    let t = cfg.fuente === 'cuenta' ? Store.tradesSel() : cfg.fuente === 'todas' ? S.trades.filter(x => x.modo === 'real') : S.trades.filter(x => x.modo === 'backtest');
    const m = Stats.metricas(t);
    const cab = `<div class="fila" style="margin-bottom:14px">
      <div><h2>Lab</h2></div>
      <div class="crece"></div>
      <div class="seg" data-seg="labFuente">${[['cuenta','Cuentas seleccionadas'],['todas','Todas las cuentas'],['backtest','Backtest']].map(([v,tx]) => `<button data-v="${v}" class="${cfg.fuente===v?'on':''}">${tx}</button>`).join('')}</div>
    </div>`;
    if(t.length < 8) return cab + vacio('Con menos de 8 trades no hay nada que simular. Registra o importa más.');
    if(!cta) return cab + vacio('Crea una cuenta: el Monte Carlo corre contra sus reglas.');

    const mc = monteCarlo(t, cta, {escala: cfg.escala, sims: cfg.sims});
    const k = kelly(m);
    const rachas = [20, 50, 100].map(n => ({n, r: rachaEsperada(1 - m.winRate, n)}));
    const mv = movil(t, Math.min(20, Math.max(5, Math.floor(t.length/3))));
    const cal = calor(t);
    const cf = contrafactuales(t);
    const riesgoActual = (Motor.planDelDia(Motor.estadoCuenta(cta)) || {}).riesgoTrade || 0;
    const colchon = Motor.estadoCuenta(cta).colchon;

    return cab + `
    <div class="hero-lab">
      <div class="hl-num">${pct(mc.pPasa, 0)}</div>
      <div class="hl-txt"><div class="eti">probabilidad de ${cta.reglas.target ? 'pasar' : 'seguir viva'} en 60 días · desde ${fmt(mc.desde)}</div>
        <div class="hl-sub">${mc.n.toLocaleString()} simulaciones re-muestreando tus ${t.length} trades contra las reglas de <b>${h(cta.alias||cta.firma)}</b>.
        Truena en <b class="down">${pct(mc.pTruena,0)}</b>. ${mc.diasMediana ? 'Mediana para pasar: <b>' + Math.round(mc.diasMediana) + ' días</b> (90%: ' + Math.round(mc.diasP90) + ').' : ''}</div>
        <div class="fila" style="margin-top:12px;gap:8px"><span class="eti">tamaño ×</span>
          <div class="seg" data-seg="labEscala">${[0.5,1,1.5,2].map(v => `<button data-v="${v}" class="${cfg.escala===v?'on':''}">${v}×</button>`).join('')}</div>
          </div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns:1.5fr 1fr;gap:12px;margin-bottom:12px">
      <div class="card"><h3>Abanico de futuros</h3>
        <div style="margin-top:10px">${abanico(mc.abanico, {objetivo: mc.objetivo, piso: mc.piso0})}</div>
        <div class="fila mini tenue mono" style="margin-top:8px"><span>día 60 · p5 ${fmt(mc.finalP5)}</span><span>· mediana ${fmt(mc.finalP50)}</span><span>· p95 ${fmt(mc.finalP95)}</span></div></div>
      <div class="card"><h3>Kelly</h3>
        ${k ? `<div class="grid g2" style="gap:8px;margin-top:10px">
          ${kpi('Kelly completo', pct(Math.max(0,k.f),1), 'del colchón · ' + fmt(Math.max(0,k.f)*colchon), 'mini')}
          ${kpi('Medio Kelly', pct(Math.max(0,k.medio),1), fmt(Math.max(0,k.medio)*colchon) + ' por trade', 'mini')}
          ${kpi('Tu riesgo hoy', fmt(riesgoActual), colchon ? pct(riesgoActual/colchon,1) + ' del colchón' : '', 'mini')}
          ${kpi('Payoff', k.b.toFixed(2) + '×', 'gana/pierde promedio', 'mini')}
        </div>
        <div class="mini dim" style="margin-top:10px">${k.f <= 0 ? 'Kelly negativo: con esta muestra no hay edge que apalancar.' : riesgoActual > k.medio*colchon ? 'Estás arriesgando <b>más que medio Kelly</b>. Eso maximiza la varianza, no la ganancia.' : 'Estás por debajo de medio Kelly: la zona donde se sobrevive.'}</div>` : vacio('Sin pérdidas en la muestra no hay Kelly.')}
      </div>
    </div>

    <div class="grid g3" style="margin-bottom:12px">
      <div class="card"><h3>Rachas que DEBES esperar</h3><div class="sub">Con win ${pct(m.winRate,0)}, pérdidas seguidas esperadas</div>
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">${rachas.map(r => `<div class="fila"><span class="mono dim" style="min-width:90px">en ${r.n} trades</span><div class="barra crece"><i style="width:${Math.min(100, r.r/8*100).toFixed(0)}%"></i></div><b class="mono">${r.r.toFixed(1)}</b></div>`).join('')}</div>
        <div class="mini tenue" style="margin-top:9px">Tu peor racha real: <b class="down">${m.rachaP}</b>. Si tu plan no aguanta ${Math.ceil(rachas[2].r)} seguidas, no es un plan.</div></div>
      <div class="card"><h3>Distribución de P&L</h3><div class="sub">Cada trade · ${fmt(m.peor)} a ${fmt(m.mejor)}</div>
        <div style="margin-top:10px">${histograma(t.map(neto))}</div>
        <div class="mini tenue mono" style="margin-top:6px">expectativa ${fmt(m.expectativa)} · mediana ${fmt(q(t.map(neto),.5))}</div></div>
      <div class="card"><h3>Edge móvil</h3><div class="sub">Win rate (acento) y expectativa (gris) en ventana de ${Math.min(20, Math.max(5, Math.floor(t.length/3)))}</div>
        <div style="margin-top:10px">${lineaDoble(mv)}</div>
        <div class="mini tenue" style="margin-top:6px">${mv.length > 2 && mv[mv.length-1].win < mv[0].win - .1 ? '<span class="down">Tu edge reciente está por debajo del inicial.</span>' : 'La línea punteada es 50%.'}</div></div>
    </div>

    <div class="grid g2" style="margin-bottom:12px">
      <div class="card"><h3>Mapa de calor</h3>
        <div class="calor" style="margin-top:10px;grid-template-columns:44px repeat(${cal.horas.length},1fr)">
          <div></div>${cal.horas.map(hh => `<div class="ch">${hh}h</div>`).join('')}
          ${cal.dias.map(d => `<div class="ch">${d}</div>` + cal.horas.map(hh => { const v = cal.celdas[d+'|'+hh]; if(!v) return '<div class="cc"></div>';
            const e = v.reduce((a,b) => a+b,0)/v.length; const mx = Math.max(...Object.values(cal.celdas).map(x => Math.abs(x.reduce((a,b)=>a+b,0)/x.length)))||1;
            return `<div class="cc" style="background:${e>=0?'rgba(198,255,61,'+(0.15+0.75*Math.abs(e)/mx).toFixed(2)+')':'rgba(255,77,90,'+(0.15+0.75*Math.abs(e)/mx).toFixed(2)+')'}" title="${d} ${hh}h · ${v.length} trades · ${fmt(e)}"><span>${v.length}</span></div>`; }).join('')).join('')}
        </div></div>
      <div class="card"><h3>Contrafactuales</h3>
        <table style="margin-top:8px"><thead><tr><th>Si hubieras…</th><th class="num">n</th><th class="num">win</th><th class="num">P&L</th><th class="num">Δ vs real</th></tr></thead><tbody>
        ${cf.map(x => `<tr><td>${h(x.nombre)}</td><td class="num tenue">${x.n}</td><td class="num">${pct(x.m.winRate,0)} <span class="${signo(x.dWin)} mini">(${x.dWin>=0?'+':''}${(x.dWin*100).toFixed(0)})</span></td>
          <td class="num ${signo(x.m.pnl)}">${masMenos(x.m.pnl)}</td><td class="num ${signo(x.delta)}"><b>${masMenos(x.delta)}</b></td></tr>`).join('')}</tbody></table>
        </div>
    </div>
    ${aviso('Bootstrap asume que tus trades futuros se parecen a los pasados y son independientes. Con ' + t.length + ' trades' + (t.length < 50 ? ' <b>la muestra es chica</b>: las probabilidades son orientativas, no promesas.' : ' la estimación empieza a ser decente.'), 'acc')}`;
  };
  Vistas._lab = cfg;
  window.Lab = { monteCarlo, kelly, rachaEsperada, movil, calor, contrafactuales };
})();
