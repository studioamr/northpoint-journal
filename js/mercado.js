/* ============================================================================
   NORTHPOINT JOURNAL — MERCADO · noticias (Forex Factory) y precios
   Forex Factory publica su calendario semanal en JSON (sin CORS: en la app
   nativa se lee directo; en navegador pasa por un proxy público de solo lectura).
   Precios: CoinGecko (BTC/ETH) y tipo de cambio USD/MXN (er-api). Todo público.
   ========================================================================= */
(function(){
  const {h, fmt, kpi, vacio, aviso} = UI;
  const cache = { ff:null, ffT:0, px:null, pxT:0, error:'' };
  const FF = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

  const pendientes = {};
  window.__npFetch = (id, b64, err) => { const p = pendientes[id]; if(!p) return; delete pendientes[id];
    if(err) return p.rej(new Error(err));
    try{ p.res(JSON.parse(decodeURIComponent(escape(atob(b64))))); }catch(e){ p.rej(e); } };
  function fetchNativo(u){ return new Promise((res, rej) => { const id = Store.id(); pendientes[id] = {res, rej};
    try{ window.webkit.messageHandlers.np.postMessage({cmd:'fetch', url:u, id}); }catch(e){ rej(e); }
    setTimeout(() => { if(pendientes[id]){ delete pendientes[id]; rej(new Error('sin respuesta')); } }, 15000); }); }
  async function fetchJSON(u){
    if(window.__npNativo) return fetchNativo(u);                                   // app de escritorio: sin CORS
    if(location.hostname === 'localhost' || location.hostname === '127.0.0.1'){    // desarrollo: proxy local (tools/proxy.py)
      try{ const r = await fetch('http://localhost:4357/?url=' + encodeURIComponent(u), {cache:'no-store'}); if(r.ok) return await r.json(); }catch(e){}
    }
    const r = await fetch(u, {cache:'no-store'});                                  // por si algún día abren CORS
    if(!r.ok) throw new Error('sin CORS: usa la app de escritorio');
    return r.json();
  }
  async function noticias(){
    if(cache.ff && Date.now() - cache.ffT < 15*60000) return cache.ff;
    const j = await fetchJSON(FF);
    cache.ff = (j||[]).map(x => ({titulo:x.title, pais:x.country, t:new Date(x.date), impacto:x.impact, prev:x.previous, fc:x.forecast, actual:x.actual}));
    cache.ffT = Date.now(); return cache.ff;
  }
  /* Futuros (Yahoo Finance, sin CORS → app nativa o proxy local): NQ, ES, BTC del CME. Spot BTC de CoinGecko como respaldo. */
  const FUT = [{k:'NQ', y:'NQ=F', n:'Nasdaq 100 · futuro'}, {k:'ES', y:'ES=F', n:'S&P 500 · futuro'}, {k:'BTC', y:'BTC=F', n:'Bitcoin · futuro CME'}];
  async function yahoo(sym){
    const j = await fetchJSON('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=5m&range=2d');
    cache['velas_' + sym] = j;
    const r = j && j.chart && j.chart.result && j.chart.result[0]; if(!r) throw new Error('sin datos');
    const me = r.meta || {};
    const precio = me.regularMarketPrice, prev = me.chartPreviousClose || me.previousClose;
    const cierres = ((r.indicators||{}).quote||[{}])[0].close || [];
    const validos = cierres.filter(x => x != null);
    return { precio, prev, chg: prev ? (precio - prev) / prev * 100 : null, pts: prev ? precio - prev : null,
      hi: validos.length ? Math.max(...validos) : null, lo: validos.length ? Math.min(...validos) : null, t: me.regularMarketTime ? new Date(me.regularMarketTime*1000) : null };
  }
  async function precios(){
    if(cache.px && Date.now() - cache.pxT < 60000) return cache.px;
    const out = { fut:{} };
    await Promise.all(FUT.map(async f => { try{ out.fut[f.k] = await yahoo(f.y); }catch(e){ out.fut[f.k] = null; } }));
    if(!out.fut.BTC){ try{ const cg = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true').then(r => r.json());
      if(cg && cg.bitcoin) out.fut.BTC = {precio: cg.bitcoin.usd, chg: cg.bitcoin.usd_24h_change, spot:true}; }catch(e){} }
    try{ const fx = await fetch('https://open.er-api.com/v6/latest/USD').then(r => r.json()); out.mxn = fx && fx.rates && fx.rates.MXN; }catch(e){}
    cache.px = out; cache.pxT = Date.now(); return out;
  }

  /* ---------------------------------------------------- qué hace cada dato
     Para cada tipo de noticia: qué mide, cómo pega en ES/NQ/BTC, qué esperar si
     sale mejor o peor que el pronóstico, y cómo buscar largos o cortos con
     la estrategia (condición sobre el FVG que deja la vela de la noticia). */
  const INFO = [
    {k:/fomc|federal funds|fed interest|rate decision|monetary policy statement/i, n:'Decisión de tasas de la Fed (FOMC)', mide:'La tasa de interés de EE.UU. y el tono del comunicado.',
      pega:'Es el evento más grande del mes. NQ es el más sensible (tecnología = tasas), ES lo sigue, BTC se mueve como activo de riesgo.',
      mejor:'Tasa más ALTA o tono duro (hawkish) → dólar sube, NQ/ES/BTC caen. Buscar CORTOS.',
      peor:'Tasa más BAJA o tono suave (dovish) → NQ/ES/BTC suben. Buscar LARGOS.',
      como:'14:00 ET la decisión, 14:30 ET Powell habla: el primer movimiento suele voltearse durante la conferencia. No operes la primera vela. Espera el FVG que deje la segunda ola y escribe la condición sobre él.'},
    {k:/powell|fed chair|yellen/i, n:'Habla Powell (presidente de la Fed)', mide:'El tono: si insinúa subir, mantener o bajar tasas.',
      pega:'Mueve NQ y ES por titulares; BTC reacciona al mismo tono de riesgo.',
      mejor:'Tono duro (inflación preocupa, tasas altas más tiempo) → CORTOS en NQ/ES/BTC.',
      peor:'Tono suave (recortes cerca) → LARGOS.',
      como:'Es discurso, no dato: el mercado se mueve a saltos con cada frase. Solo continuaciones a favor del tramo que forme después de los primeros 15 min.'},
    {k:/\bcpi\b|consumer price/i, n:'CPI · inflación al consumidor', mide:'Cuánto subieron los precios en el mes (headline y core, sin comida ni energía).',
      pega:'El dato que más mueve NQ después del FOMC. Inflación alta = Fed dura = tasas = tecnología cae. BTC suele seguir a NQ.',
      mejor:'CPI MÁS ALTO que el pronóstico → NQ/ES/BTC caen. Buscar CORTOS.',
      peor:'CPI MÁS BAJO que el pronóstico → NQ/ES/BTC suben. Buscar LARGOS.',
      como:'8:30 ET, una hora antes de la apertura. La vela de 5m de la noticia deja un FVG casi siempre: esa es tu condición del día. Si el precio lo respeta, continúa en la dirección del dato; si lo invierte, la lectura se voltea.'},
    {k:/\bppi\b|producer price/i, n:'PPI · inflación al productor', mide:'Precios que pagan las empresas; anticipa el CPI.',
      pega:'Menos que el CPI, pero mueve NQ/ES si sorprende mucho.',
      mejor:'PPI más alto → CORTOS (presión inflacionaria).', peor:'PPI más bajo → LARGOS.',
      como:'Mismo manejo que CPI, con menos fuerza: si el movimiento es chico, ignóralo y opera tu plan normal.'},
    {k:/non-farm|nonfarm|nfp|employment change/i, n:'NFP · nóminas no agrícolas', mide:'Empleos creados en el mes. Sale con la tasa de desempleo y los salarios.',
      pega:'Mueve todo: ES, NQ, BTC y el dólar. Alta volatilidad los primeros 15 minutos.',
      mejor:'MÁS empleos que el pronóstico → economía fuerte → Fed dura → suele CORTOS en NQ (pero ES puede aguantar). Si además suben los salarios, cortos claros.',
      peor:'MENOS empleos → recortes de tasas más cerca → LARGOS… salvo que sea tan malo que huela a recesión: entonces cortos.',
      como:'Primer viernes del mes, 8:30 ET. Es el dato con más falsas rupturas: espera dos velas de 5m, marca el rango y opera solo el retroceso al equilibrio del tramo que gane.'},
    {k:/unemployment rate/i, n:'Tasa de desempleo', mide:'Porcentaje de gente sin trabajo.',
      pega:'Sale junto con el NFP; refuerza o contradice el dato de empleos.',
      mejor:'Desempleo MÁS BAJO → Fed dura → sesgo CORTOS en NQ.', peor:'Desempleo MÁS ALTO → recortes cerca → sesgo LARGOS (si no es pánico).',
      como:'No lo operes solo: léelo junto con el NFP.'},
    {k:/unemployment claims|jobless claims/i, n:'Peticiones de desempleo semanales', mide:'Cuánta gente pidió subsidio esta semana.',
      pega:'Impacto medio en ES/NQ; pesa más cuando el mercado está pendiente del empleo.',
      mejor:'MENOS peticiones → empleo fuerte → ligero sesgo CORTOS en NQ.', peor:'MÁS peticiones → economía se enfría → ligero sesgo LARGOS.',
      como:'Jueves 8:30 ET. Normalmente no cambia el día: úsalo como contexto, no como señal.'},
    {k:/\bpce\b|core pce/i, n:'PCE · el indicador de inflación favorito de la Fed', mide:'Inflación medida como la mide la Fed.',
      pega:'Como un CPI chico: NQ es el más sensible.',
      mejor:'PCE más alto → CORTOS.', peor:'PCE más bajo → LARGOS.',
      como:'8:30 ET. Mismo manejo que CPI.'},
    {k:/\bgdp\b|gross domestic/i, n:'PIB', mide:'Crecimiento de la economía en el trimestre.',
      pega:'Mueve ES más que NQ; BTC poco salvo sorpresa grande.',
      mejor:'PIB MÁS ALTO → ES sube (empresas venden más). Buscar LARGOS en ES.', peor:'PIB MÁS BAJO → ES cae; si es muy malo, todo cae.',
      como:'8:30 ET. Reacción moderada; opera tu plan normal con la vela de la noticia como referencia.'},
    {k:/retail sales/i, n:'Ventas minoristas', mide:'Cuánto gastó el consumidor en el mes.',
      pega:'ES y NQ suben si el consumo aguanta; consumo fuerte también puede leerse como inflación.',
      mejor:'Ventas MÁS ALTAS → sesgo LARGOS (economía fuerte).', peor:'Ventas MÁS BAJAS → sesgo CORTOS.',
      como:'8:30 ET. Impacto medio: si la vela es chica, no cambia la condición del día.'},
    {k:/ism .*pmi|manufacturing pmi|services pmi|non-manufacturing/i, n:'ISM / PMI', mide:'Encuesta a empresas: expansión (>50) o contracción (<50).',
      pega:'ES/NQ suben con expansión; el de servicios pesa más que el de manufactura.',
      mejor:'PMI MÁS ALTO → LARGOS.', peor:'PMI MÁS BAJO (o <50) → CORTOS.',
      como:'10:00 ET, ya con el mercado abierto y en tu ventana: es el dato que más te cruza la ejecución. No entres 15 min antes ni después.'},
    {k:/consumer confidence|consumer sentiment|uom/i, n:'Confianza del consumidor', mide:'Ánimo de la gente para gastar.',
      pega:'Impacto medio en ES; poco en NQ y BTC.',
      mejor:'MÁS confianza → ligero LARGOS.', peor:'MENOS confianza → ligero CORTOS.',
      como:'10:00 ET. Contexto, no señal.'},
    {k:/jolts/i, n:'JOLTS · vacantes de empleo', mide:'Cuántas plazas abiertas hay.',
      pega:'Medio: más vacantes = mercado laboral apretado = Fed dura.',
      mejor:'MÁS vacantes → sesgo CORTOS en NQ.', peor:'MENOS vacantes → sesgo LARGOS.', como:'10:00 ET. Contexto.'},
    {k:/\badp\b/i, n:'ADP · empleo privado', mide:'Empleos creados según nóminas privadas; adelanto del NFP.',
      pega:'Medio; el mercado lo usa para apostar al NFP del viernes.',
      mejor:'MÁS empleos → sesgo CORTOS en NQ.', peor:'MENOS empleos → sesgo LARGOS.', como:'8:15 ET. Contexto para el viernes.'},
    {k:/durable goods|core durable/i, n:'Pedidos de bienes duraderos', mide:'Inversión de las empresas.',
      pega:'Bajo-medio en ES.', mejor:'Más pedidos → ligero LARGOS.', peor:'Menos → ligero CORTOS.', como:'Contexto.'},
    {k:/fomc.*minutes|meeting minutes/i, n:'Minutas de la Fed', mide:'Lo que discutieron en la última reunión.',
      pega:'Titulares a las 14:00 ET; NQ se mueve a saltos.', mejor:'Tono duro → CORTOS.', peor:'Tono suave → LARGOS.', como:'Fuera de tu ventana. Solo afecta el cierre.'},
    {k:/crude|oil inventories/i, n:'Inventarios de crudo', mide:'Petróleo.', pega:'Casi nada en NQ/BTC; algo en ES por energía.', mejor:'—', peor:'—', como:'Ignóralo para tu plan.'},
    {k:/treasury|bond auction|10-y|30-y/i, n:'Subasta de bonos', mide:'Demanda de deuda de EE.UU.', pega:'Si la demanda es mala, suben las tasas y NQ cae.', mejor:'Subasta fuerte → LARGOS suaves.', peor:'Subasta débil → CORTOS en NQ.', como:'13:00 ET, fuera de tu ventana.'}
  ];
  function info(n){
    const t = n.titulo || '';
    const x = INFO.find(i => i.k.test(t));
    if(x) return x;
    return {n: t, mide:'Dato macro de EE.UU. de impacto ' + (n.impacto === 'High' ? 'alto' : 'medio') + '.',
      pega:'Puede mover ES/NQ los primeros minutos; BTC sigue al riesgo.',
      mejor:'Mejor que el pronóstico → economía fuerte: LARGOS en ES, pero si huele a inflación, CORTOS en NQ.',
      peor:'Peor que el pronóstico → CORTOS en ES/NQ, salvo que acerque recortes de tasas.',
      como:'No entres 15 min antes ni después. Deja que la vela de la noticia forme su FVG y escribe la condición sobre él.'};
  }

  /* ---------------------------------------------------- resumen de la noche
     Asia (18:00–02:00 NY), Londres (02:00–08:30 NY) y pre-apertura (08:30–09:30 NY):
     high y low de cada sesión, si ya se tomaron, y dónde está el precio antes
     de que abra Nueva York a las 9:30. Sale de las velas de 5 min de Yahoo. */
  const SESIONES = [{k:'asia', n:'Asia', d:-1, ini:18*60, fin:24*60+2*60}, {k:'lon', n:'Londres', d:0, ini:2*60, fin:8*60+30}, {k:'pre', n:'Pre-NY', d:0, ini:8*60+30, fin:9*60+30}];
  const fmtNY = new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'});
  function ny(ts){ const p = {}; fmtNY.formatToParts(new Date(ts)).forEach(x => p[x.type] = x.value); return {ymd: p.year + '-' + p.month + '-' + p.day, min: (+p.hour)*60 + (+p.minute)}; }
  const diaMas = (ymd, d) => { const x = new Date(ymd + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0,10); };
  function noche(sym){
    const j = cache['velas_' + sym]; const r = j && j.chart && j.chart.result && j.chart.result[0]; if(!r) return null;
    const ts = r.timestamp || [], q = ((r.indicators||{}).quote||[{}])[0], hi = q.high || [], lo = q.low || [], cl = q.close || [];
    const ahora = ny(Date.now());
    const velas = ts.map((t, i) => ({t: t*1000, hi: hi[i], lo: lo[i], cl: cl[i]})).filter(v => v.hi != null && v.lo != null).map(v => Object.assign(v, ny(v.t)));
    let D = ahora.min >= 18*60 ? diaMas(ahora.ymd, 1) : ahora.ymd;            // día de trading: el de la apertura de NY que sigue (o la de hoy)
    const enSesionDe = (v, s, dd) => { const dia = diaMas(dd, s.d); if(s.fin > 24*60) return (v.ymd === dia && v.min >= s.ini) || (v.ymd === dd && v.min < s.fin - 24*60); return v.ymd === dia && v.min >= s.ini && v.min < s.fin; };
    let pasada = false;
    if(!velas.some(v => SESIONES.some(s => enSesionDe(v, s, D))) && velas.length){       // fin de semana / feriado: enseña la última noche que sí hubo
      const u = velas[velas.length-1]; D = u.min >= 18*60 ? diaMas(u.ymd, 1) : u.ymd; pasada = true; }
    const enSesion = (v, s) => enSesionDe(v, s, D);
    const precio = (r.meta||{}).regularMarketPrice || (velas.length ? velas[velas.length-1].cl : null);
    const out = { sym, precio, D, pasada, abrioNY: !pasada && ahora.ymd === D && ahora.min >= 9*60+30, minParaNY: !pasada && ahora.ymd === D ? (9*60+30) - ahora.min : null, sesiones: [] };
    const iniAsia = velas.findIndex(v => enSesionDe(v, SESIONES[0], D)); out.serie = iniAsia >= 0 ? velas.slice(iniAsia) : velas.slice(-120);
    out.serie.forEach(v => { v.min2 = v.ymd === D ? v.min : v.min - 24*60; });     // minutos relativos a la medianoche NY del día D
    SESIONES.forEach(s => { const vs = velas.filter(v => enSesion(v, s)); if(!vs.length){ out.sesiones.push({k:s.k, n:s.n, vacia:true}); return; }
      const high = Math.max(...vs.map(v => v.hi)), low = Math.min(...vs.map(v => v.lo)); const fin = vs[vs.length-1].t;
      const despues = velas.filter(v => v.t > fin);
      out.sesiones.push({k:s.k, n:s.n, high, low, rango: high - low, highTomado: despues.some(v => v.hi > high), lowTomado: despues.some(v => v.lo < low), velas: vs.length, t0: vs[0].min2, t1: vs[vs.length-1].min2 + 5}); });
    return out;
  }
  /* la noche dibujada: cajas por sesión (Asia · Londres · Pre-NY) del low al high, línea del precio y niveles vivos/tomados */
  function graficaNoche(d){
    const Wg = 640, Hg = 250, L = 8, R = 92, T = 16, B = 26;
    const serie = d.serie || []; if(serie.length < 3) return '<div class="tenue mini">sin velas</div>';
    const ses = d.sesiones.filter(s => !s.vacia);
    const tMin = Math.min(serie[0].min2, ...ses.map(s => s.t0)), tMax = Math.max(serie[serie.length-1].min2 + 5, 9*60+30);
    const pMin = Math.min(...serie.map(v => v.lo)), pMax = Math.max(...serie.map(v => v.hi)); const pad = (pMax - pMin) * 0.08 || 1;
    const X = t => L + (t - tMin) / (tMax - tMin) * (Wg - L - R), Y = p => T + (1 - (p - (pMin - pad)) / ((pMax + pad) - (pMin - pad))) * (Hg - T - B);
    const num = v => v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const hora = t => { const mm = ((t % 1440) + 1440) % 1440; return String(Math.floor(mm/60)).padStart(2,'0') + ':' + String(mm%60).padStart(2,'0'); };
    const tono = {asia:'#FF4D5A', lon:'#4F8CFF', pre:'#39FF14'};   // Asia rojo · Londres azul · NY verde (como él lo pinta en el chart)
    const cajas = ses.map(s => `<rect x="${X(s.t0)}" y="${Y(s.high)}" width="${Math.max(2, X(s.t1) - X(s.t0))}" height="${Math.max(2, Y(s.low) - Y(s.high))}" rx="3" fill="${tono[s.k]}" fill-opacity=".14" stroke="${tono[s.k]}" stroke-opacity=".7"/>
      <text class="ses" x="${X(s.t0) + 4}" y="${Hg - B + 14}" fill="${tono[s.k]}">${s.n.toUpperCase()}</text>
      <line x1="${X(s.t1)}" x2="${Wg - R + 4}" y1="${Y(s.high)}" y2="${Y(s.high)}" stroke="${s.highTomado ? 'var(--tenue)' : 'var(--up)'}" stroke-dasharray="${s.highTomado ? '2 4' : '5 4'}" stroke-opacity=".8"/>
      <line x1="${X(s.t1)}" x2="${Wg - R + 4}" y1="${Y(s.low)}" y2="${Y(s.low)}" stroke="${s.lowTomado ? 'var(--tenue)' : 'var(--down)'}" stroke-dasharray="${s.lowTomado ? '2 4' : '5 4'}" stroke-opacity=".8"/>`).join('');
    // etiquetas de niveles a la derecha, sin encimarse
    const niveles = []; ses.forEach(s => { niveles.push({p:s.high, txt:s.n.slice(0,3).toUpperCase() + ' H ' + num(s.high), col: s.highTomado ? 'var(--tenue)' : 'var(--up)', tomado:s.highTomado}); niveles.push({p:s.low, txt:s.n.slice(0,3).toUpperCase() + ' L ' + num(s.low), col: s.lowTomado ? 'var(--tenue)' : 'var(--down)', tomado:s.lowTomado}); });
    if(d.precio != null) niveles.push({p:d.precio, txt:'AHORA ' + num(d.precio), col:'var(--txt)', ahora:true});
    niveles.sort((a,b) => b.p - a.p); let last = -99; niveles.forEach(n => { let y = Y(n.p); if(y - last < 11) y = last + 11; n.y = y; last = y; });
    const etiquetas = niveles.map(n => `<text class="lbl" x="${Wg - R + 8}" y="${n.y + 3.5}" fill="${n.col}" ${n.tomado ? 'text-decoration="line-through"' : ''} ${n.ahora ? 'font-weight="700"' : ''}>${n.txt}</text>`).join('');
    const linea = serie.map((v, i) => (i ? 'L' : 'M') + X(v.min2 + 2.5).toFixed(1) + ' ' + Y(v.cl != null ? v.cl : (v.hi + v.lo)/2).toFixed(1)).join(' ');
    const ultimo = serie[serie.length-1];
    const ny = X(9*60+30);
    return `<svg class="noche-g" viewBox="0 0 ${Wg} ${Hg}" preserveAspectRatio="none" style="aspect-ratio:${Wg}/${Hg}">
      ${cajas}
      <line x1="${ny}" x2="${ny}" y1="${T}" y2="${Hg - B}" stroke="#39FF14" stroke-opacity=".6" stroke-dasharray="3 3"/><text class="ses" x="${ny + 4}" y="${T + 10}" fill="#39FF14">NY 9:30</text>
      <path d="${linea}" fill="none" stroke="var(--txt)" stroke-width="1.6" stroke-linejoin="round"/>
      <circle cx="${X(ultimo.min2 + 2.5)}" cy="${Y(ultimo.cl != null ? ultimo.cl : (ultimo.hi+ultimo.lo)/2)}" r="3.5" fill="var(--txt)"/>
      ${etiquetas}
      <text x="${L}" y="${Hg - 4}">${hora(tMin)} NY</text><text x="${Wg - R - 2}" y="${Hg - 4}" text-anchor="end">${hora(ultimo.min2 + 5)}</text>
    </svg>`;
  }
  function pintaNoche(A){
    const datos = ['NQ=F','ES=F'].map(noche).filter(Boolean); if(!datos.length){ A.style.display = 'none'; return; }
    const num = v => v == null ? '—' : v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const d0 = datos[0];
    const fechaD = new Date(d0.D + 'T12:00:00').toLocaleDateString('es-MX', {weekday:'short', day:'numeric', month:'short'});
    const estadoNY = d0.pasada ? 'Mercado cerrado · última noche: ' + fechaD : d0.abrioNY ? 'NY ya abrió · los niveles vivos son los imanes del día' : d0.minParaNY != null && d0.minParaNY > 0 ? 'NY abre en ' + Math.floor(d0.minParaNY/60) + 'h ' + (d0.minParaNY%60) + 'm' : 'Noche en curso';
    A.style.display = ''; A.innerHTML = `<div class="fila"><div><h3>La noche</h3><div class="sub">${estadoNY}</div></div><div class="crece"></div></div>
      <div class="grid g2" style="margin-top:10px;gap:12px">${datos.map(d => `<div><div class="fila" style="margin-bottom:4px"><b>${d.sym.replace('=F','')}</b><div class="crece"></div>${d.sesiones.filter(s => !s.vacia).map(s => `<span class="mini dim">${s.n} <b class="mono">${num(s.rango)}</b></span>`).join('')}</div>${graficaNoche(d)}</div>`).join('')}</div>`;
  }

  /* Próxima noticia USD de alto impacto: para el semáforo y el Panel */
  function proximaAlta(lista){
    const ahora = Date.now();
    return (lista||[]).filter(n => n.pais === 'USD' && n.impacto === 'High' && n.t.getTime() > ahora - 30*60000).sort((a,b) => a.t - b.t)[0] || null;
  }
  const horaLocal = d => d.toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'});
  const diaLocal = d => d.toLocaleDateString('es-MX', {weekday:'short', day:'2-digit', month:'short'});

  Vistas.mercado = function(){
    setTimeout(cargar, 0);
    return `
    <div class="fila" style="margin-bottom:12px">
      <div><div class="eti">Mercado</div><h2>Noticias y precios</h2></div>
      <div class="crece"></div><button class="btn chico" data-acc="mercadoRecarga">↻ actualizar</button>
    </div>
    <div class="grid g4" style="margin-bottom:12px" id="mkPrecios">${kpi('NQ · Nasdaq','…','futuro')}${kpi('ES · S&P 500','…','futuro')}${kpi('BTC','…','futuro CME')}${kpi('USD / MXN','…','tipo de cambio')}</div>
    <div class="card" id="mkAviso" style="margin-bottom:12px;display:none"></div>
    <div class="card"><div class="fila"><h3>Calendario económico</h3><div class="crece"></div><span class="ffi alto"></span><span class="ffi medio" style="margin-left:8px"></span></div>
      
      <div id="mkTabla" style="margin-top:10px">${vacio('Cargando Forex Factory…')}</div></div>`;
  };

  async function cargar(){
    const P = document.getElementById('mkPrecios'), T = document.getElementById('mkTabla'), A = document.getElementById('mkAviso');
    if(!P) return;
    try{
      const px = await precios();
      const num = (v, d) => v == null ? '—' : v.toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});
      const fila = (q, dec) => !q ? 'sin datos · usa la app de escritorio' : (q.chg != null ? `<span class="${q.chg >= 0 ? 'up' : 'down'}">${q.chg >= 0 ? '+' : ''}${q.chg.toFixed(2)}%${q.pts != null ? ' · ' + (q.pts >= 0 ? '+' : '') + num(q.pts, dec) + ' pts' : ''}</span>` : '') + (q.hi != null ? ` · hoy ${num(q.lo, dec)}–${num(q.hi, dec)}` : '') + (q.spot ? ' · spot' : '');
      const val = (q, dec) => q ? num(q.precio, dec) : '—';
      if(document.getElementById('mkPrecios')) P.innerHTML =
        kpi('NQ · Nasdaq', val(px.fut.NQ, 2), fila(px.fut.NQ, 2)) +
        kpi('ES · S&P 500', val(px.fut.ES, 2), fila(px.fut.ES, 2)) +
        kpi('BTC', val(px.fut.BTC, 0), fila(px.fut.BTC, 0)) +
        kpi('USD / MXN', px.mxn ? px.mxn.toFixed(2) : '—', px.mxn ? 'tu meta de ' + (Store.ajustes.metaMXN||100000).toLocaleString('es-MX') + ' MXN = ' + fmt((Store.ajustes.metaMXN||100000)/px.mxn) : '');
      if(px.mxn && Store.ajustes.tcAuto !== false){ Store.ajustes.tc = Math.round(px.mxn*100)/100; }
      if(A) pintaNoche(A);
    }catch(e){}
    try{
      const lista = await noticias();
      // solo lo que mueve ES/NQ/BTC: datos de EE.UU. de impacto alto o medio (FOMC, CPI, NFP, PCE, PIB, ISM, claims, Powell…)
      const vis = lista.filter(n => n.pais === 'USD' && (n.impacto === 'High' || n.impacto === 'Medium'));
      const ahora = Date.now(); const hoy = new Date().toDateString();
      if(!document.getElementById('mkTabla')) return;
      // tabla estilo Forex Factory: día agrupado · hora · divisa · impacto · evento · real · pronóstico · previo
      let ultimoDia = '';
      T.innerHTML = vis.length ? `<table class="ff"><thead><tr><th>Día</th><th>Hora</th><th>Divisa</th><th>Impacto</th><th>Evento</th><th class="num">Real</th><th class="num">Pronóstico</th><th class="num">Previo</th></tr></thead><tbody>
        ${vis.map(n => { const esHoy = n.t.toDateString() === hoy, pasado = n.t.getTime() < ahora, I = info(n);
          const dia = n.t.toDateString(); const nuevoDia = dia !== ultimoDia; ultimoDia = dia;
          const diaTxt = nuevoDia ? `<b>${n.t.toLocaleDateString('es-MX',{weekday:'short'})}</b><br>${n.t.toLocaleDateString('es-MX',{month:'short', day:'numeric'})}` : '';
          return `<tr class="ffr ${nuevoDia ? 'nuevo' : ''} ${esHoy ? 'hoy' : ''} ${pasado ? 'pasada' : ''}" data-ff="${n.t.getTime()}">
            <td class="ffd">${diaTxt}${esHoy && nuevoDia ? ' <span class="pill acc">HOY</span>' : ''}</td>
            <td class="mono">${horaLocal(n.t)}</td><td class="mono">${h(n.pais)}</td>
            <td><span class="ffi ${n.impacto === 'High' ? 'alto' : 'medio'}" title="${n.impacto === 'High' ? 'Alto impacto' : 'Impacto medio'}"></span></td>
            <td class="ffn">${h(n.titulo)} <span class="tenue mini">info ▾</span></td>
            <td class="num">${n.actual ? '<b>' + h(n.actual) + '</b>' : ''}</td><td class="num">${h(n.fc||'')}</td><td class="num tenue">${h(n.prev||'')}</td></tr>
          <tr class="ffinfo" hidden><td></td><td colspan="7"><div class="ninfo">
              <div><div class="eti">Qué es</div><b>${h(I.n)}</b> · ${h(I.mide)}</div>
              <div><div class="eti">Cómo pega en ES · NQ · BTC</div>${h(I.pega)}</div>
              <div class="grid g2" style="gap:8px"><div class="nbox down"><div class="eti">Si sale más alto / mejor</div>${h(I.mejor)}</div><div class="nbox up"><div class="eti">Si sale más bajo / peor</div>${h(I.peor)}</div></div>
              <div><div class="eti">Cómo buscar largos o cortos con tu estrategia</div>${h(I.como)}</div></div></td></tr>`; }).join('')}</tbody></table>` : vacio('Esta semana no hay datos USD de impacto alto o medio.');
      T.querySelectorAll('tr.ffr').forEach(tr => tr.addEventListener('click', () => { const inf = tr.nextElementSibling; inf.hidden = !inf.hidden; tr.classList.toggle('abierta', !inf.hidden); }));
    }catch(e){ if(document.getElementById('mkTabla')) T.innerHTML = vacio('No se pudo leer Forex Factory (' + e.message + '). En la app de escritorio se lee directo.'); }
  }

  /* noticias USD alto/medio de un día (ISO local) */
  async function noticiasDe(iso){
    const lista = await noticias();
    return lista.filter(n => n.pais === 'USD' && (n.impacto === 'High' || n.impacto === 'Medium') && n.t.toLocaleDateString('en-CA') === iso).sort((a,b) => a.t - b.t);
  }
  /* escenario corto para pintar en una celda: qué dato y hacia dónde mirar */
  function escenario(n){
    const I = info(n);
    const corto = /CORTOS/.test(I.mejor) && /LARGOS/.test(I.peor) ? 'alto → cortos · bajo → largos' : /LARGOS/.test(I.mejor) && /CORTOS/.test(I.peor) ? 'fuerte → largos · débil → cortos' : 'ver ficha';
    return {nombre: I.n, corto, I};
  }
  window.Mercado = { noticias, precios, proximaAlta, cargar, cache, info, noticiasDe, escenario, horaLocal, noche };
})();
