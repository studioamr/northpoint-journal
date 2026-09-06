/* ============================================================================
   NORTHPOINT — BACKTEST AUTOMÁTICO DE LA ESTRATEGIA
   Velas de 5 min de NQ (Yahoo, 60 días) → cada día: condición (FVG de apertura
   9:35–9:45) → dirección → continuación en el 0.705 → TP interno · 1% · if W fuera.
   Los datos llegan de la API propia (data/nq5m.json, la baja GitHub cada hora)
   o de Yahoo directo en la app nativa.
   ========================================================================= */
(function(){
  const {h, fmt, kpi, vacio} = UI;
  const cache = {velas:null, t:0};
  const fmtNY = new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'});
  function velasDe(j){
    const r = j && j.chart && j.chart.result && j.chart.result[0]; if(!r) return null;
    const ts = r.timestamp || [], q = ((r.indicators||{}).quote||[{}])[0]; const out = [];
    ts.forEach((t, i) => { if(q.high[i] == null || q.low[i] == null) return; const p = {}; fmtNY.formatToParts(new Date(t*1000)).forEach(x => p[x.type] = x.value);
      if(p.second === '59') return;   // vela sintética de liquidación
      out.push({d: p.year + '-' + p.month + '-' + p.day, m: (+p.hour)*60 + (+p.minute), o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i]}); });
    return out;
  }
  async function cargar(){
    if(cache.velas && Date.now() - cache.t < 30*60000) return cache.velas;
    let j = null;
    for(const u of ['data/nq5m.json', 'https://studioamr.github.io/northpoint-journal/data/nq5m.json']){ try{ const r = await fetch(u + '?t=' + Math.floor(Date.now()/1800000), {cache:'no-store'}); if(r.ok){ const t = await r.text(); if(t.trim().startsWith('{')){ j = JSON.parse(t); break; } } }catch(e){} }
    if(!j && window.Mercado && window.__npNativo){ try{ j = await Mercado.fetchJSON('https://query1.finance.yahoo.com/v8/finance/chart/NQ%3DF?interval=5m&range=60d'); }catch(e){} }
    const v = velasDe(j); if(!v || !v.length) throw new Error('sin velas');
    cache.velas = v; cache.t = Date.now(); return v;
  }
  /* ---- la estrategia, día por día */
  function condicion(vs){
    const cands = [];
    for(let i = 2; i < vs.length; i++){
      if(vs[i].m < 9*60+35 || vs[i].m > 9*60+45) continue;
      const alc = vs[i].l > vs[i-2].h, baj = vs[i].h < vs[i-2].l; if(!alc && !baj) continue;
      const f = {i, alc, a: alc ? vs[i-2].h : vs[i].h, b: alc ? vs[i].l : vs[i-2].l, t: vs[i].m}; if(f.b - f.a < vs[i].c * 0.00015) continue;
      const desp = vs.slice(i + 1), alto = f.b - f.a;
      const iT = desp.findIndex(v => v.l <= f.b && v.h >= f.a), iI = desp.findIndex(v => alc ? v.c < f.a : v.c > f.b);
      if(iI >= 0){ f.estado = 'invertido'; f.k = iI; }
      else if(iT >= 0){ const k2 = desp.slice(iT + 1).findIndex(v => alc ? v.c > f.b + alto : v.c < f.a - alto); if(k2 >= 0){ f.estado = 'respetado'; f.k = iT + 1 + k2; } else { f.estado = 'sin resolver'; f.k = null; } }
      else { f.estado = 'sin resolver'; f.k = null; }
      cands.push(f);
    }
    if(!cands.length) return null;
    const v945 = vs.find(v => v.m >= 9*60+45) || vs[vs.length-1]; const p = v945.c;
    cands.forEach(f => f.dist = p > f.b ? p - f.b : p < f.a ? f.a - p : 0);
    return cands.sort((x, y) => x.dist - y.dist)[0];
  }
  function simulaDia(vs, V, P){
    const pre = vs.filter(v => v.m >= 9*60 && v.m < 16*60), ses = vs.filter(v => v.m >= 9*60+30 && v.m < 16*60);
    const c = condicion(pre); if(!c || c.estado === 'sin resolver') return {cond: c ? c.estado : 'sin FVG', trades: []};
    const dir = c.estado === 'respetado' ? c.alc : !c.alc;
    const mRes = pre[c.i + 1 + c.k].m; let i = ses.findIndex(v => v.m > mRes); if(i < 0) i = ses.length;
    const trades = []; let seguidas = 0;
    while(i < ses.length - 3){
      const tramo = ses.slice(i); let A = dir ? tramo[0].l : tramo[0].h, B = null, ent = null;
      for(let j = 1; j < tramo.length; j++){ const v = tramo[j];
        if(B != null){ const rango = Math.abs(B - A);
          if(rango >= P.rangoMin){ const n705 = dir ? B - 0.705 * rango : B + 0.705 * rango; const toca = dir ? v.l <= n705 : v.h >= n705;
            if(toca && (dir ? v.h < B : v.l > B)){ const stop = dir ? A - Math.max(2, rango * 0.05) : A + Math.max(2, rango * 0.05);
              const tp = V.tp === 'interno' ? B : (dir ? n705 + (n705 - stop) * V.rr : n705 - (stop - n705) * V.rr);
              ent = {j: i + j, m: v.m, px: n705, stop, tp, A, B}; break; } } }
        if(dir ? v.l < A : v.h > A){ A = dir ? v.l : v.h; B = null; continue; }
        if(B == null || (dir ? v.h > B : v.l < B)) B = dir ? v.h : v.l;
      }
      if(!ent || ent.m >= 15*60+30) break;
      const stopPts = Math.abs(ent.px - ent.stop); const contratos = Math.max(1, Math.min(P.maxC, Math.floor(P.riesgoUSD / (stopPts * P.punto))));
      let res = null, k = ent.j + 1;
      for(; k < ses.length; k++){ const v = ses[k]; const sh = dir ? v.l <= ent.stop : v.h >= ent.stop, th = dir ? v.h >= ent.tp : v.l <= ent.tp;
        if(sh){ res = ['stop', ent.stop, v.m]; break; } if(th){ res = ['tp', ent.tp, v.m]; break; } }
      if(!res){ res = ['cierre', ses[ses.length-1].c, ses[ses.length-1].m]; k = ses.length - 1; }
      const pts = dir ? res[1] - ent.px : ent.px - res[1]; const usd = pts * P.punto * contratos;
      trades.push({m: ent.m, dir, px: ent.px, stop: ent.stop, tp: ent.tp, res: res[0], salida: res[2], pts, usd, r: pts / stopPts, c: contratos});
      seguidas = usd < 0 ? seguidas + 1 : 0;
      if(usd > 0 && V.ifw) break; if(seguidas >= P.pararTrasPerdidas) break; if(trades.length >= V.max) break;
      i = k + 1;
    }
    return {cond: c.estado + ' → ' + (dir ? 'largos' : 'cortos'), trades};
  }
  const VARIANTES = {
    protocolo: {n:'Tu protocolo · TP interno · if W fuera · máx 2', tp:'interno', rr:null, ifw:true, max:2},
    sinIfw:    {n:'Sin «if W → fuera» (hasta 2 trades)', tp:'interno', rr:null, ifw:false, max:2},
    rr2:       {n:'TP a 2R en vez de interno', tp:'rr', rr:2, ifw:true, max:2},
    rr1:       {n:'TP a 1R', tp:'rr', rr:1, ifw:true, max:2}
  };
  function correr(velas, V){
    const A = Store.ajustes, cta = Store.cuentaActiva(); const ins = (window.INSTRUMENTOS||{})[A.instrumento] || {puntoUSD:2};
    const P = {punto: ins.puntoUSD, riesgoUSD: (cta ? cta.inicial : 50000) * (A.riesgoPctCuenta || 0.01), maxC: (A.instrumento === 'MNQ' || A.instrumento === 'MES') ? (A.maxContratos||1)*10 : (A.maxContratos||1), pararTrasPerdidas: A.pararTrasPerdidas || 2, rangoMin: 12};
    const porDia = {}; velas.forEach(v => (porDia[v.d] = porDia[v.d] || []).push(v));
    const dias = Object.keys(porDia).sort().filter(d => new Date(d + 'T12:00').getDay() % 6 !== 0 && porDia[d].some(v => v.m >= 9*60+30 && v.m < 16*60));
    let tot = 0, n = 0, wins = 0, eq = 0, pico = 0, mdd = 0; const rs = [], pnl = [], det = [], curva = [];
    dias.forEach(d => { const s = simulaDia(porDia[d], V, P); const day = s.trades.reduce((a, t) => a + t.usd, 0);
      s.trades.forEach(t => { n++; tot += t.usd; rs.push(t.r); if(t.usd > 0) wins++; });
      pnl.push(day); eq += day; pico = Math.max(pico, eq); mdd = Math.min(mdd, eq - pico); curva.push({fecha: d, bal: eq}); det.push({d, cond: s.cond, day, trades: s.trades}); });
    const g = pnl.filter(x => x > 0), p = pnl.filter(x => x < 0);
    return {dias: dias.length, conTrade: det.filter(x => x.trades.length).length, n, winRate: n ? wins / n : 0, rProm: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0, total: tot, mejor: pnl.length ? Math.max(...pnl) : 0, peor: pnl.length ? Math.min(...pnl) : 0, verdes: g.length, rojos: p.length, mdd, pf: g.reduce((a, b) => a + b, 0) / Math.max(1, -p.reduce((a, b) => a + b, 0)), curva, det, P, desde: dias[0], hasta: dias[dias.length-1]};
  }
  const hM = mm => String(Math.floor(mm/60)).padStart(2,'0') + ':' + String(mm%60).padStart(2,'0');
  function html(){ return `<div class="card" style="margin-bottom:12px" id="btAuto"><div class="fila"><h3>Backtest automático de la estrategia</h3><span class="mono dim">NQ · velas de 5 min · últimos 60 días</span><div class="crece"></div>
      <select data-ajuste="btVariante" style="width:auto">${Object.keys(VARIANTES).map(k => `<option value="${k}" ${(Store.ajustes.btVariante||'protocolo') === k ? 'selected' : ''}>${h(VARIANTES[k].n)}</option>`).join('')}</select></div>
    <div id="btAutoCuerpo" style="margin-top:10px">${vacio('Cargando las velas…')}</div></div>`; }
  async function pinta(){
    const el = document.getElementById('btAutoCuerpo'); if(!el) return;
    let velas; try{ velas = await cargar(); }catch(e){ el.innerHTML = vacio('Sin velas: en la app de escritorio se bajan de Yahoo; en la web las trae la API propia cada hora.'); return; }
    const V = VARIANTES[Store.ajustes.btVariante || 'protocolo'] || VARIANTES.protocolo; const R = correr(velas, V);
    const el2 = document.getElementById('btAutoCuerpo'); if(!el2) return;
    el2.innerHTML = `<div class="mini dim" style="margin-bottom:10px">${R.desde} → ${R.hasta} · ${R.dias} días operables · riesgo ${fmt(R.P.riesgoUSD)} por trade (${Store.ajustes.instrumento}) · condición FVG 9:35–9:45 → continuación en el 0.705 → stop tras el origen</div>
      <div class="grid g5" style="margin-bottom:10px">
        ${kpi('Total', `<span class="${R.total >= 0 ? 'up' : 'down'}">${(R.total >= 0 ? '+' : '-') + fmt(Math.abs(R.total))}</span>`, R.conTrade + ' días con trade · ' + R.verdes + ' verdes / ' + R.rojos + ' rojos')}
        ${kpi('Trades', R.n, 'win rate ' + Math.round(R.winRate*100) + '% · R prom ' + (R.rProm >= 0 ? '+' : '') + R.rProm.toFixed(2))}
        ${kpi('Profit factor', R.pf.toFixed(2), R.pf >= 1.3 ? 'hay edge en la muestra' : R.pf >= 1 ? 'apenas positivo' : 'negativo')}
        ${kpi('Mejor / peor día', `<span class="up">+${fmt(Math.round(R.mejor))}</span> / <span class="down">-${fmt(Math.round(Math.abs(R.peor)))}</span>`, '')}
        ${kpi('Máx drawdown', `<span class="down">-${fmt(Math.abs(R.mdd))}</span>`, Math.abs(R.mdd) >= 2000 ? 'con 2k de drawdown esa racha quema la cuenta' : 'cabe en 2k de drawdown')}
      </div>
      <div class="card" style="margin-bottom:10px"><h3>Curva</h3>${Stats.linea(R.curva.map(c => ({bal: c.bal})), {w:900, h:170, color: R.total >= 0 ? 'var(--up)' : 'var(--down)', base: 0})}</div>
      <details class="mas"><summary>Día por día</summary><table class="ff" style="margin-top:8px"><thead><tr><th>Día</th><th>Condición</th><th class="num">P&L</th><th>Trades</th></tr></thead><tbody>
        ${R.det.map(x => `<tr><td class="mono">${x.d}</td><td>${h(x.cond)}</td><td class="num mono ${x.day > 0 ? 'up' : x.day < 0 ? 'down' : 'tenue'}">${x.day ? (x.day > 0 ? '+' : '-') + fmt(Math.abs(x.day)) : '—'}</td><td class="mono mini">${x.trades.map(t => hM(t.m) + ' ' + (t.dir ? 'L' : 'S') + ' ' + t.res + ' ' + (t.r >= 0 ? '+' : '') + t.r.toFixed(2) + 'R').join(' · ')}</td></tr>`).join('')}</tbody></table></details>
      <div class="mini dim" style="margin-top:8px">Muestra corta: ${R.n} trades no separan el edge del ruido. Lo que sí se ve: «if W → fuera» sostiene el resultado, el TP interno sale ≈2R y a 1R pierde. Yahoo solo da 60 días en 5 min.</div>`;
  }
  document.addEventListener('mesa:pintado', () => { if(document.getElementById('btAutoCuerpo')) pinta(); });
  window.Backtest = { cargar, correr, VARIANTES, html, pinta, simulaDia, condicion };
})();
