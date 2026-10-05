/* ============================================================================
   NORTHPOINT JOURNAL — COFFEE MORNING · NQ y ES antes de la campana de NY
   Lee data/cafe.json (lo escribe tools/cafe.py desde el workflow cafe.yml cada mañana):
   overnight en velas de 5m, liquidez tomada y viva, lectura, escenario alcista y bajista,
   noticias rojas de Forex Factory y el Mirador (cinta, squawk, Google News, Polymarket).
   La gráfica se dibuja aquí en un canvas con los colores del tema.
   ========================================================================= */
(function(){
  const {h, vacio} = UI;
  const FUENTES = ['data/cafe.json', 'https://studioamr.github.io/northpoint-journal/data/cafe.json'];
  const cache = { d:null, t:0 };
  let mer = 'NQ';

  const num = (v, d = 2) => v == null ? '—' : Number(v).toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d});
  const sig = (v, d = 2) => v == null ? '—' : (v >= 0 ? '+' : '') + num(v, d);
  const horaMX = t => new Date(t).toLocaleTimeString('es-MX', {timeZone:'America/Mexico_City', hour:'2-digit', minute:'2-digit', hourCycle:'h23'});
  const diaMX = t => new Date(t).toLocaleDateString('es-MX', {timeZone:'America/Mexico_City', weekday:'short', day:'numeric'});
  const fechaMX = t => new Date(t).toLocaleDateString('es-MX', {timeZone:'America/Mexico_City'});

  async function datos(forzar){
    if(!forzar && cache.d && Date.now() - cache.t < 5*60000) return cache.d;
    for(const u of FUENTES){
      try{ const r = await fetch(u + '?t=' + Math.floor(Date.now()/60000), {cache:'no-store'}); if(r.ok){ cache.d = await r.json(); cache.t = Date.now(); return cache.d; } }catch(e){}
    }
    throw new Error('todavía no hay Coffee Morning publicado');
  }

  Vistas.cafe = function(){
    setTimeout(() => cargar(false), 0);
    return `<div id="cafe">${vacio('Sirviendo el café…')}</div>`;
  };

  async function cargar(forzar){
    const R = document.getElementById('cafe'); if(!R) return;
    let D;
    try{ D = await datos(forzar); }catch(e){ R.innerHTML = vacio(e.message + '. Se genera cada día hábil antes de la campana.'); return; }
    if(!document.getElementById('cafe')) return;
    const campana = new Date(D.campana), finVentana = new Date(campana.getTime() + 90*60000);
    const vieja = new Date(D.generado).getTime() < Date.now() - 20*3600000;
    const rojasHoy = (D.forexfactory || []).filter(n => fechaMX(n.t) === fechaMX(D.campana));
    const resto = (D.forexfactory || []).filter(n => new Date(n.t) > new Date(D.campana) && fechaMX(n.t) !== fechaMX(D.campana));
    const enVentana = n => { const t = new Date(n.t).getTime(); return t >= campana.getTime() - 60*60000 && t <= finVentana.getTime(); };
    const A = (D.mercados || {})[mer];

    R.innerHTML = `
    <div class="fila cf-top">
      <div><div class="eti">Overnight hasta ${horaMX(D.generado)} CDMX · ${h(diaMX(D.generado))}</div>
        <div class="cf-dia">${h(new Date(D.campana).toLocaleDateString('es-MX', {timeZone:'America/Mexico_City', weekday:'long', day:'numeric', month:'long'}))} · campana ${horaMX(D.campana)}</div></div>
      <div class="crece"></div>
      <div class="seg" id="cfMer">${['NQ','ES'].map(m => `<button data-m="${m}" class="${m === mer ? 'on' : ''}">${m}</button>`).join('')}</div>
      <button class="btn chico" id="cfRec">↻ actualizar</button>
    </div>
    ${vieja ? `<div class="cf-aviso">Estos datos son de ${h(diaMX(D.generado))} ${horaMX(D.generado)}. El de hoy se publica antes de la campana.</div>` : ''}
    <div class="cf-cinta">${(D.cinta || []).map(c => `<div><span class="eti">${h(c.n)}</span><b class="mono">${num(c.p, c.p > 1000 ? 0 : 2)}</b><span class="mono ${c.ch == null ? '' : c.ch >= 0 ? 'up' : 'down'}">${c.ch == null ? '—' : sig(c.ch) + '%'}</span></div>`).join('')}</div>

    <div class="card cf-card"><div class="fila"><h3>Noticias rojas de hoy</h3><div class="crece"></div><span class="ffi alto"></span><span class="tenue mini" style="margin-left:6px">Forex Factory · hora CDMX</span></div>
      ${rojasHoy.length ? `<table class="ff cf-ff"><tbody>${rojasHoy.map(n => `<tr class="${enVentana(n) ? 'cf-peligro' : ''}"><td class="mono">${horaMX(n.t)}</td><td class="mono">${h(n.pais)}</td><td>${h(n.titulo)}${enVentana(n) ? ' <span class="pill cf-pill">en tu sesión</span>' : ''}</td><td class="num">${h(n.pronostico)}</td><td class="num tenue">${h(n.previo)}</td></tr>`).join('')}</tbody></table>`
        : `<p class="tenue" style="margin:10px 0 0">Hoy no hay noticias rojas.</p>`}
      ${rojasHoy.some(enVentana) ? `<p class="cf-regla">Con noticia roja en tu ventana: nada abierto 2 min antes ni 2 min después del dato.</p>` : ''}
      ${resto.length ? `<details class="cf-det"><summary>Lo rojo que falta esta semana (${resto.length})</summary><ul class="cf-lista">${resto.map(n => `<li><span class="mono tenue">${h(diaMX(n.t))} ${horaMX(n.t)}</span> ${h(n.pais)} · ${h(n.titulo)}</li>`).join('')}</ul></details>` : ''}
    </div>

    ${A ? `
    <div class="grid g4 cf-kpis">
      <div class="kpi"><div class="k">${mer} · último</div><div class="v">${num(A.ultimo)}</div><div class="n">cierre de ayer ${num(A.pdc)}</div></div>
      <div class="kpi"><div class="k">Gap</div><div class="v ${A.gap >= 0 ? 'up' : 'down'}">${sig(A.gap)}</div><div class="n">${sig(A.gap / A.pdc * 100)}%</div></div>
      <div class="kpi"><div class="k">Rango overnight</div><div class="v">${num(A.on_rango)}</div><div class="n">${A.on_prom ? (A.on_rango / A.on_prom).toFixed(1) + '× el promedio de 15 días' : ''}</div></div>
      <div class="kpi"><div class="k">0.5 del overnight</div><div class="v">${num(A.mid)}</div><div class="n">${A.ultimo > A.mid ? 'precio en premium' : 'precio en descuento'}</div></div>
    </div>
    <div class="card cf-card cf-graf"><div class="fila"><h3>Overnight ${mer} · 5 min</h3><div class="crece"></div>
      <span class="cf-ley"><i class="ar"></i>liquidez arriba <i class="ab"></i>liquidez abajo <i class="tm"></i>ya tomada</span></div>
      <canvas id="cfCanvas"></canvas></div>
    <div class="card cf-card"><h3>Lectura</h3><ul class="cf-lect">${A.lectura.map(x => `<li>${h(x)}</li>`).join('')}</ul></div>
    <div class="grid g2 cf-escs">${esc(A.alcista, 'alc', 'Escenario alcista')}${esc(A.bajista, 'baj', 'Escenario bajista')}</div>
    <div class="card cf-card"><details class="cf-det" open><summary>Todos los niveles (${A.niveles.length})</summary>
      <table class="ff cf-niv"><thead><tr><th>Nivel</th><th class="num">Precio</th><th class="num">Distancia</th><th>Estado</th></tr></thead><tbody>
      ${A.niveles.map(n => `<tr class="${n.tomado ? 'tm' : n.lado}"><td>${h(n.n)}</td><td class="num">${num(n.p)}</td><td class="num">${sig(n.dist)}</td><td>${n.tomado ? 'tomado ' + h(n.tomado) : 'vivo'}</td></tr>`).join('')}
      </tbody></table></details></div>
    <div class="card cf-card cf-plan"><div><div class="eti">Tu setup</div>ORB de 5 min A+: sesgo + línea de 15m + FVG a favor. El único de tus modelos con ventaja medida (+0.42R en 338 trades, 2013–2026).</div>
      <div><div class="eti">Ventana</div><b class="mono">${horaMX(D.campana)}–${horaMX(finVentana)}</b> CDMX. Si no hubo A+, no hay trade.</div>
      <div><div class="eti">Riesgo</div>Fondeada −$500 máximo al día. Forzar un trade diario bajó la esperanza a −0.41R en el backtest.</div></div>`
    : `<div class="card cf-card">${vacio('No llegaron los datos de ' + mer + ' esta vez.')}</div>`}

    <div class="grid g2 cf-mirador">
      <div class="card cf-card"><div class="fila"><h3>Squawk</h3><div class="crece"></div><span class="tenue mini">FinancialJuice · lo que publican en X</span></div>
        <ul class="cf-sq">${(D.squawk || []).map(s => `<li class="${s.clave ? 'clave' : ''}"><span class="mono tenue">${horaMX(s.t)}</span><a href="${h(s.link || '#')}" target="_blank" rel="noopener">${h(s.titulo)}</a></li>`).join('') || '<li class="tenue">Sin titulares por ahora.</li>'}</ul></div>
      <div class="cf-col">
        <div class="card cf-card"><h3>Google News · futuros</h3><ol class="cf-gn">${(D.google || []).map(g => `<li><a href="${h(g.link)}" target="_blank" rel="noopener">${h(g.titulo)}</a> <span class="tenue mini">${h(g.fuente)}</span></li>`).join('')}</ol></div>
        <div class="card cf-card"><h3>Lo que apuesta el mercado</h3><ul class="cf-pm">${(D.polymarket || []).map(p => `<li><a href="https://polymarket.com/event/${h(p.slug || '')}" target="_blank" rel="noopener">${h(p.t)}</a>
          ${p.m.map(m => `<div class="cf-bar"><i style="width:${(m.p*100).toFixed(0)}%"></i><span>${h(m.n)}</span><b class="mono">${(m.p*100).toFixed(0)}%</b></div>`).join('')}</li>`).join('')}</ul></div>
      </div>
    </div>
    <p class="tenue mini cf-pie">Futuros CME (Yahoo, velas de 5 min, pueden traer ~10 min de retraso). Asia = 18:00–22:00 y Londres = 00:00–03:00 hora CDMX en horario de verano de NY. Los escenarios son condiciones que vigilar en la apertura. No son señales ni recomendación de inversión.</p>`;

    R.querySelectorAll('#cfMer button').forEach(b => b.onclick = () => { mer = b.dataset.m; cargar(false); });
    document.getElementById('cfRec').onclick = () => cargar(true);
    if(A) dibuja(A);
  }

  function esc(s, cls, nom){
    const obj = s.objetivos.length ? s.objetivos.map(o => `<li><span>${h(o.n)}</span><b class="mono">${num(o.p)}</b><span class="mono tenue">${sig(o.dist)}</span></li>`).join('')
      : '<li class="tenue">Sin liquidez viva de este lado en 5 días.</li>';
    return `<div class="card cf-card cf-esc ${cls}"><div class="eti">${nom}</div><p><b>Gatillo:</b> ${h(s.gatillo)}.</p>
      <div class="eti">Objetivos de liquidez</div><ul class="cf-obj">${obj}</ul><p class="tenue"><b>Se invalida:</b> ${h(s.invalida)}.</p></div>`;
  }

  function dibuja(A){
    const cv = document.getElementById('cfCanvas'); if(!cv) return;
    const css = getComputedStyle(document.documentElement), v = k => css.getPropertyValue(k).trim();
    const C = {txt:v('--txt'), dim:v('--dim'), tenue:v('--tenue'), linea:v('--linea'), acc:v('--acc'), oro:v('--oro') || '#E8C577', up:v('--up') || '#6FCF97', down:v('--down') || '#F07C8A', zona:v('--panel3') || 'rgba(255,255,255,.08)'};
    const W = cv.parentElement.clientWidth - 2, H = Math.max(300, Math.min(460, W * .5)), dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const g = cv.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
    const V = A.velas; if(!V.length) return;
    const izq = 8, der = Math.min(220, W * .36), arriba = 16, abajo = 22, ancho = W - izq - der, alto = H - arriba - abajo;
    let lo = Math.min(...V.map(x => x[3])), hi = Math.max(...V.map(x => x[2]));
    const pad = (hi - lo) * .3;
    const vivos = A.niveles.filter(n => !n.tomado);
    const cerca = [...vivos.filter(n => n.p > A.ultimo).sort((a, b) => a.p - b.p).slice(0, 2), ...vivos.filter(n => n.p < A.ultimo).sort((a, b) => b.p - a.p).slice(0, 2)];
    const vis = A.niveles.filter(n => (n.p >= lo - pad && n.p <= hi + pad) || cerca.includes(n));
    lo = Math.min(lo, A.mid, ...vis.map(n => n.p)); hi = Math.max(hi, A.mid, ...vis.map(n => n.p));
    const m = (hi - lo) * .04; lo -= m; hi += m;
    const y = p => arriba + (hi - p) / (hi - lo) * alto, paso = ancho / V.length, x = i => izq + paso * (i + .5);
    const fuente = '11px ' + (v('--mono') || 'ui-monospace, Menlo, monospace');
    // Asia y Londres
    A.zonas.forEach(z => { const ii = V.map((c, i) => [c[0], i]).filter(([t]) => t >= z.a && t < z.b).map(([, i]) => i); if(!ii.length) return;
      g.fillStyle = C.zona; g.fillRect(x(ii[0]) - paso / 2, arriba, paso * ii.length, alto);
      g.fillStyle = C.tenue; g.font = fuente; g.textAlign = 'center'; g.fillText(z.n.toUpperCase(), x(ii[0]) + paso * ii.length / 2 - paso / 2, arriba + 11); });
    // rejilla
    g.strokeStyle = C.linea; g.lineWidth = 1; g.fillStyle = C.tenue; g.textAlign = 'left';
    // velas
    V.forEach((c, i) => { const col = c[4] >= c[1] ? C.up : C.down;
      g.strokeStyle = col; g.beginPath(); g.moveTo(x(i), y(c[2])); g.lineTo(x(i), y(c[3])); g.stroke();
      g.fillStyle = col; const a = y(Math.max(c[1], c[4])), b = y(Math.min(c[1], c[4])); g.fillRect(x(i) - Math.max(paso * .32, .6), a, Math.max(paso * .64, 1.2), Math.max(b - a, 1)); });
    // niveles con etiquetas sin encimarse
    const usadas = [];
    const linea = (p, col, guion, txt, grueso) => {
      g.strokeStyle = col; g.lineWidth = grueso ? 1.3 : .8; g.setLineDash(guion); g.beginPath(); g.moveTo(izq, y(p)); g.lineTo(izq + ancho + 6, y(p)); g.stroke(); g.setLineDash([]);
      let yy = y(p); while(usadas.some(u => Math.abs(u - yy) < 13)) yy += (p >= A.ultimo ? -13 : 13); usadas.push(yy);
      g.fillStyle = col; g.font = fuente; g.textAlign = 'left'; g.fillText(txt, izq + ancho + 10, yy + 4);
    };
    vis.forEach(n => linea(n.p, n.tomado ? C.tenue : n.lado === 'arriba' ? C.acc : C.oro, n.tomado ? [4, 4] : [], (n.n.split(' (')[0].split(' · ')[0]) + '  ' + num(n.p) + (n.tomado ? ' ✓' : ''), n.peso >= 2));
    linea(A.mid, C.dim, [2, 3], '0.5 ON  ' + num(A.mid), false);
    // último precio
    g.fillStyle = C.txt; g.beginPath(); g.arc(x(V.length - 1), y(A.ultimo), 3, 0, 7); g.fill();
    // horas
    g.fillStyle = C.tenue; g.font = fuente; g.textAlign = 'center';
    const cada = Math.max(1, Math.round(V.length / Math.max(3, Math.floor(ancho / 70))));
    V.forEach((c, i) => { if(i % cada === 0) g.fillText(horaMX(c[0] * 1000), x(i), H - 6); });
  }
  window.addEventListener('resize', () => { const D = cache.d; if(D && document.getElementById('cfCanvas')) dibuja(D.mercados[mer]); });
  document.addEventListener('tema:cambio', () => { const D = cache.d; if(D && document.getElementById('cfCanvas')) dibuja(D.mercados[mer]); });

  window.Cafe = { cargar, cache };
})();
