/* ============================================================================
   MESA — métricas y gráficas (SVG a mano, sin librerías)
   ========================================================================= */
(function(){
  const neto = Motor.neto;

  function metricas(trades){
    const n = trades.length;
    const g = trades.filter(t => neto(t) > 0), p = trades.filter(t => neto(t) < 0), be = trades.filter(t => neto(t) === 0);
    const bruto = g.reduce((a,t) => a + neto(t), 0);
    const perd  = Math.abs(p.reduce((a,t) => a + neto(t), 0));
    const pnl = trades.reduce((a,t) => a + neto(t), 0);
    const rValidos = trades.filter(t => t.r !== null && t.r !== '' && !isNaN(+t.r)).map(t => +t.r);
    const dias = Motor.porDia(trades);
    const diasG = dias.filter(d => d.pnl > 0).length;

    let rachaG = 0, rachaP = 0, cg = 0, cp = 0;
    trades.slice().sort((a,b) => (a.fecha+a.hora) < (b.fecha+b.hora) ? -1 : 1).forEach(t => {
      const v = neto(t);
      if(v > 0){ cg++; cp = 0; } else if(v < 0){ cp++; cg = 0; }
      rachaG = Math.max(rachaG, cg); rachaP = Math.max(rachaP, cp);
    });

    const adh = n ? trades.reduce((a,t) => a + Motor.adherencia(t).puntos, 0) / n : 0;

    return {
      n, ganadas:g.length, perdidas:p.length, be:be.length,
      winRate: n ? g.length / (g.length + p.length || 1) : 0,
      pnl, bruto, perd,
      pf: perd > 0 ? bruto / perd : (bruto > 0 ? Infinity : 0),
      avgWin: g.length ? bruto / g.length : 0,
      avgLoss: p.length ? perd / p.length : 0,
      ratio: (p.length && g.length) ? (bruto/g.length) / (perd/p.length) : 0,
      expectativa: n ? pnl / n : 0,
      mejor: n ? Math.max(...trades.map(neto)) : 0,
      peor:  n ? Math.min(...trades.map(neto)) : 0,
      rProm: rValidos.length ? rValidos.reduce((a,b) => a+b, 0) / rValidos.length : null,
      rTotal: rValidos.reduce((a,b) => a+b, 0),
      dias: dias.length, diasG, diaWinRate: dias.length ? diasG/dias.length : 0,
      mejorDia: dias.length ? Math.max(...dias.map(d => d.pnl)) : 0,
      peorDia: dias.length ? Math.min(...dias.map(d => d.pnl)) : 0,
      rachaG, rachaP, adherencia: adh, serieDias: dias
    };
  }

  /* Puntaje NP: qué tan sano está tu trading, no cuánto ganaste. */
  function puntaje(trades){
    const m = metricas(trades);
    const cap = (x, max) => Math.max(0, Math.min(1, x / max));
    const ejes = [
      {k:'Win %',      v: cap(m.winRate, 0.75)},
      {k:'P. factor',  v: cap(m.pf === Infinity ? 3 : m.pf, 3)},
      {k:'Disciplina', v: m.adherencia / 100},
      {k:'Días +',     v: cap(m.diaWinRate, 0.80)},
      {k:'Riesgo',     v: cap(m.avgLoss ? Math.min(1.6, m.avgWin/m.avgLoss) : 0, 1.5)},
      {k:'Racha',      v: m.rachaP ? cap(m.rachaG / Math.max(1,m.rachaP), 4) : (m.n ? 0.6 : 0)}
    ];
    const total = Math.round(ejes.reduce((a,e) => a + e.v, 0) / ejes.length * 100);
    return {total, ejes, m};
  }

  /* Agrupa por lo que quieras y devuelve métricas por grupo. */
  function desglose(trades, fn){
    const m = new Map();
    trades.forEach(t => {
      const claves = fn(t);
      (Array.isArray(claves) ? claves : [claves]).forEach(k => {
        if(k === null || k === undefined || k === '') return;
        if(!m.has(k)) m.set(k, []);
        m.get(k).push(t);
      });
    });
    return [...m.entries()].map(([k, ts]) => Object.assign({clave:k}, metricas(ts)))
      .sort((a,b) => b.n - a.n);
  }

  function curva(trades, inicial){
    const dias = Motor.porDia(trades);
    let b = inicial || 0, pico = b, out = [{fecha:'', bal:b, dd:0}];
    dias.forEach(d => { b += d.pnl; pico = Math.max(pico, b); out.push({fecha:d.fecha, bal:b, dd:b-pico}); });
    return out;
  }

  /* ------------------------------------------------------------- gráficas */
  const esc = s => String(s).replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));

  function linea(pts, o){
    o = Object.assign({w:640, h:180, pad:6, color:'var(--acc)', area:true, base:null}, o||{});
    if(pts.length < 2) return vacio(o.w, o.h, 'Sin datos todavía');
    const ys = pts.map(p => p.bal), min = Math.min(...ys), max = Math.max(...ys);
    const span = (max - min) || 1;
    const X = i => o.pad + i * (o.w - o.pad*2) / (pts.length - 1);
    const Y = v => o.h - o.pad - ((v - min) / span) * (o.h - o.pad*2);
    const d = pts.map((p,i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.bal).toFixed(1)).join(' ');
    const base = o.base != null ? o.base : min;
    const yBase = Y(Math.max(min, Math.min(max, base)));
    return `<svg viewBox="0 0 ${o.w} ${o.h}" preserveAspectRatio="none" class="g">
      ${o.area ? `<path d="${d} L ${X(pts.length-1).toFixed(1)} ${o.h-o.pad} L ${o.pad} ${o.h-o.pad} Z" fill="url(#gAcc)" opacity=".18"/>` : ''}
      <line x1="${o.pad}" x2="${o.w-o.pad}" y1="${yBase}" y2="${yBase}" stroke="var(--linea2)" stroke-dasharray="3 4"/>
      <path d="${d}" fill="none" stroke="${o.color}" stroke-width="1.6" stroke-linejoin="round"/>
      <defs><linearGradient id="gAcc" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${o.color}"/><stop offset="1" stop-color="${o.color}" stop-opacity="0"/>
      </linearGradient></defs></svg>`;
  }

  function barras(vals, o){
    o = Object.assign({w:640, h:150, gap:2}, o||{});
    if(!vals.length) return vacio(o.w, o.h, 'Sin datos todavía');
    const max = Math.max(...vals.map(v => Math.abs(v.v))) || 1;
    const bw = (o.w) / vals.length;
    const mid = o.h/2;
    return `<svg viewBox="0 0 ${o.w} ${o.h}" preserveAspectRatio="none" class="g">
      <line x1="0" x2="${o.w}" y1="${mid}" y2="${mid}" stroke="var(--linea2)"/>
      ${vals.map((v,i) => {
        const h = Math.abs(v.v)/max * (mid - 4);
        const y = v.v >= 0 ? mid - h : mid;
        return `<rect x="${(i*bw + o.gap/2).toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(1,bw-o.gap).toFixed(1)}" height="${Math.max(1,h).toFixed(1)}" fill="${v.v>=0?'var(--up)':'var(--down)'}" opacity=".85"><title>${esc(v.k)}: ${Motor.fmt(v.v)}</title></rect>`;
      }).join('')}</svg>`;
  }

  function radar(ejes, o){
    o = Object.assign({s:220}, o||{});
    const c = o.s/2, R = c - 46, N = ejes.length;
    const pt = (i, r) => {
      const a = -Math.PI/2 + i * 2*Math.PI/N;
      return [c + Math.cos(a)*r*R, c + Math.sin(a)*r*R];
    };
    const anillos = [0.25,0.5,0.75,1].map(r =>
      `<polygon points="${ejes.map((_,i) => pt(i,r).map(n => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="var(--linea)"/>`).join('');
    const poly = ejes.map((e,i) => pt(i, Math.max(0.04, e.v)).map(n => n.toFixed(1)).join(',')).join(' ');
    const labels = ejes.map((e,i) => {
      let [x,y] = pt(i, 1.22);
      x = Math.min(Math.max(x, 26), o.s - 26);
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" class="rl">${esc(e.k)}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${o.s} ${o.s}" class="radar">${anillos}
      <polygon points="${poly}" fill="var(--acc)" fill-opacity=".16" stroke="var(--acc)" stroke-width="1.4"/>
      ${ejes.map((e,i) => { const [x,y] = pt(i, Math.max(0.04,e.v)); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4" fill="var(--acc)"/>`; }).join('')}
      ${labels}</svg>`;
  }

  function vacio(w, h, txt){
    return `<svg viewBox="0 0 ${w} ${h}" class="g"><text x="${w/2}" y="${h/2}" text-anchor="middle" dominant-baseline="middle" class="rl" opacity=".45">${esc(txt)}</text></svg>`;
  }

  window.Stats = { metricas, puntaje, desglose, curva, linea, barras, radar, vacio };
})();
