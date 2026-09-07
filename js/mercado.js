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
  /* En la web (GitHub Pages) el calendario llega por la API propia: data/ff_calendar_thisweek.json, que un workflow
     de GitHub baja de Forex Factory cada hora (sin CORS porque es el mismo origen). En la app nativa se lee directo. */
  async function noticias(){
    if(cache.ff && Date.now() - cache.ffT < 15*60000) return cache.ff;
    let j = null;
    /* 1) la API propia (GitHub Pages manda Access-Control-Allow-Origin: *, así que sirve en web Y en la app nativa) */
    const propia = ['data/ff_calendar_thisweek.json', 'https://studioamr.github.io/northpoint-journal/data/ff_calendar_thisweek.json'];
    for(const u of propia){ try{ const r = await fetch(u + '?t=' + Math.floor(Date.now()/600000), {cache:'no-store'}); if(r.ok){ const t = await r.text(); if(t.trim().startsWith('[')){ j = JSON.parse(t); break; } } }catch(e){} }
    /* 2) Forex Factory directo (nativo / proxy); si regresa HTML (bloqueo), se ignora */
    if(!j){ try{ const x = await fetchJSON(FF); if(Array.isArray(x)) j = x; }catch(e){ if(!j) throw e; } }
    if(!j) throw new Error('sin calendario por ahora');
    cache.ff = (j||[]).map(x => ({titulo:x.title, pais:x.country, t:new Date(x.date), impacto:x.impact, prev:x.previous, fc:x.forecast, actual:x.actual}));
    cache.ffT = Date.now(); return cache.ff;
  }
  /* Futuros (Yahoo Finance, sin CORS → app nativa o proxy local): NQ, ES, BTC del CME. Spot BTC de CoinGecko como respaldo. */
  /* el contrato que él opera (MNQU2026 = Micro Nasdaq septiembre 2026). Si no lo fija en Ajustes, se calcula el trimestral vigente
     (H mar · M jun · U sep · Z dic; rueda el 3er viernes del mes de vencimiento). En Yahoo el símbolo es MNQU26.CME. */
  function contratoAuto(){ const d = new Date(); let y = d.getFullYear(), q = Math.floor(d.getMonth() / 3); const mes = [2, 5, 8, 11][q];
    const tercerViernes = (yy, mm) => { const f = new Date(yy, mm, 1); const off = (5 - f.getDay() + 7) % 7; return new Date(yy, mm, 1 + off + 14); };
    if(d.getMonth() > mes || (d.getMonth() === mes && d >= tercerViernes(y, mes))){ q++; if(q > 3){ q = 0; y++; } }
    return 'MNQ' + 'HMUZ'[q] + String(y).slice(2); }
  const contrato = () => (Store.ajustes.contrato || contratoAuto()).toUpperCase().replace('.CME', '');
  const SYM_NQ = () => contrato() + '.CME';
  const nombreContrato = () => { const c = contrato(); const m2 = c.match(/^([A-Z]+)([HMUZ])(\d\d)$/); return m2 ? m2[1] + m2[2] + '20' + m2[3] : c; };
  const FUT = [{k:'NQ', get y(){ return SYM_NQ(); }, n:'Micro Nasdaq'}, {k:'ES', y:'ES=F', n:'S&P 500 · futuro'}, {k:'BTC', y:'BTC=F', n:'Bitcoin · futuro CME'}];
  /* Yahoo mete el precio de LIQUIDACIÓN (settlement) al cierre del viernes: una vela sintética a las 16:59:59 con volumen 0 y,
     en la vela real de las 16:55, un high/close falsos (p. ej. 29,565.25 cuando el último trade fue 29,524.75, como en TradingView).
     Aquí se quita la sintética y se le devuelve a la de 16:55 su cierre real. */
  function limpiaSettlement(r){
    const ts = r.timestamp || [], q = ((r.indicators||{}).quote||[{}])[0]; if(!ts.length || !q.close) return;
    const n = ts.length - 1;
    if(ts[n] % 300 !== 0 || (q.volume && q.volume[n] === 0 && q.open[n] === q.close[n] && q.high[n] === q.low[n])){
      const liq = q.close[n];
      ts.pop(); ['open','high','low','close','volume'].forEach(k => q[k] && q[k].pop());
      const m2 = ts.length - 1;
      if(m2 >= 1 && q.close[m2] === liq && Math.abs(liq - q.open[m2]) > q.open[m2] * 0.0006){   // la vela previa también quedó contaminada
        q.close[m2] = q.open[m2]; q.high[m2] = Math.max(q.open[m2], q.close[m2-1], q.low[m2]); }
      r.meta = Object.assign({}, r.meta, {settlement: liq});
    }
  }
  /* precio: el de Yahoo solo si es de hace menos de 15 min (mercado abierto); si no, el cierre de la última vela real */
  function precioReal(r){
    const me = r.meta || {}; const q = ((r.indicators||{}).quote||[{}])[0]; const cl = (q.close || []).filter(x => x != null);
    const fresco = me.regularMarketTime && (Date.now()/1000 - me.regularMarketTime) < 15*60;
    return fresco && me.regularMarketPrice != null ? me.regularMarketPrice : (cl.length ? cl[cl.length-1] : me.regularMarketPrice);
  }
  async function yahoo(sym){
    const j = await fetchJSON('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=5m&range=5d&_=' + Date.now());   // 5 días: para que Asia siempre esté · &_= rompe cualquier caché
    cache['velas_' + sym] = j;
    const r = j && j.chart && j.chart.result && j.chart.result[0]; if(!r) throw new Error('sin datos');
    limpiaSettlement(r);
    const me = r.meta || {};
    const precio = precioReal(r), prev = me.chartPreviousClose || me.previousClose;
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
  /* killzones tal cual las tiene en TradingView (UTC-4 = hora NY): ASIA 20:00–00:00 · LNDN 02:00–05:00 · NYAM 09:30–16:00 */
  const SESIONES = [{k:'asia', n:'Asia', d:-1, ini:20*60, fin:24*60}, {k:'lon', n:'Londres', d:0, ini:2*60, fin:5*60}, {k:'ny', n:'NY', d:0, ini:9*60+30, fin:16*60}];
  const fmtNY = new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'});
  function ny(ts){ const p = {}; fmtNY.formatToParts(new Date(ts)).forEach(x => p[x.type] = x.value); return {ymd: p.year + '-' + p.month + '-' + p.day, min: (+p.hour)*60 + (+p.minute)}; }
  const diaMas = (ymd, d) => { const x = new Date(ymd + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0,10); };
  function noche(sym){
    const j = cache['velas_' + sym]; const r = j && j.chart && j.chart.result && j.chart.result[0]; if(!r) return null;
    const ts = r.timestamp || [], q = ((r.indicators||{}).quote||[{}])[0], hi = q.high || [], lo = q.low || [], cl = q.close || [];
    const ahora = ny(Date.now());
    const velas = ts.map((t, i) => ({t: t*1000, hi: hi[i], lo: lo[i], cl: cl[i]})).filter(v => v.hi != null && v.lo != null).map(v => Object.assign(v, ny(v.t)));
    let D = ahora.min >= 18*60 ? diaMas(ahora.ymd, 1) : ahora.ymd;            // día de trading: el de la apertura de NY que sigue (o la de hoy)
    const enSesionDe = (v, s, dd) => { const dia = diaMas(dd, s.d); if(s.fin > 24*60) return (v.ymd === dia && v.min >= s.ini) || (v.ymd === dd && v.min < s.fin - 24*60); return v.ymd === dia && v.min >= s.ini && v.min < Math.min(s.fin, 1440); };
    let pasada = false;
    if(!velas.some(v => SESIONES.some(s => enSesionDe(v, s, D))) && velas.length){       // fin de semana / feriado: enseña la última noche que sí hubo
      const u = velas[velas.length-1]; D = u.min >= 18*60 ? diaMas(u.ymd, 1) : u.ymd; pasada = true; }
    const enSesion = (v, s) => enSesionDe(v, s, D);
    const precio = precioReal(r) || (velas.length ? velas[velas.length-1].cl : null);
    const out = { sym, precio, D, pasada, abrioNY: !pasada && ahora.ymd === D && ahora.min >= 9*60+30, minParaNY: !pasada && ahora.ymd === D ? (9*60+30) - ahora.min : null, sesiones: [] };
    const iniAsia = velas.findIndex(v => SESIONES.some(s => enSesionDe(v, s, D))); out.serie = iniAsia >= 0 ? velas.slice(iniAsia) : velas.slice(-120);
    out.serie.forEach(v => { v.min2 = v.ymd === D ? v.min : v.min - 24*60; });     // minutos relativos a la medianoche NY del día D
    SESIONES.forEach(s => { const vs = velas.filter(v => enSesion(v, s)); if(!vs.length){ out.sesiones.push({k:s.k, n:s.n, vacia:true}); return; }
      const high = Math.max(...vs.map(v => v.hi)), low = Math.min(...vs.map(v => v.lo)); const fin = vs[vs.length-1].t;
      const vHigh = vs.find(v => v.hi === high), vLow = vs.find(v => v.lo === low);   // la vela que hizo el high / el low: de ahí arranca su línea
      const despues = velas.filter(v => v.t > fin);
      const vh = despues.find(v => v.hi > high), vl = despues.find(v => v.lo < low);
      out.sesiones.push({k:s.k, n:s.n, high, low, rango: high - low, highTomado: !!vh, lowTomado: !!vl, highEn: vh ? vh.min2 : null, lowEn: vl ? vl.min2 : null, velas: vs.length, t0: vs[0].min2, t1: vs[vs.length-1].min2 + 5, tHigh: vHigh.min2, tLow: vLow.min2}); });
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
    const tono = {asia:'#FF4D5A', lon:'#4F8CFF', ny:'#39FF14'};   // Asia rojo · Londres azul · NY verde (como él lo pinta en el chart)
    const cajas = ses.map(s => `<rect x="${X(s.t0)}" y="${Y(s.high)}" width="${Math.max(2, X(s.t1) - X(s.t0))}" height="${Math.max(2, Y(s.low) - Y(s.high))}" rx="3" fill="${tono[s.k]}" fill-opacity=".14" stroke="${tono[s.k]}" stroke-opacity=".7"/>
      <text class="ses" x="${X(s.t0) + 4}" y="${Hg - B + 14}" fill="${tono[s.k]}">${s.n.toUpperCase()}</text>
      <line x1="${X(s.tHigh != null ? s.tHigh + 2.5 : s.t1)}" x2="${s.highTomado ? X(s.highEn + 2.5) : Wg - R + 4}" y1="${Y(s.high)}" y2="${Y(s.high)}" stroke="${tono[s.k]}" stroke-opacity=".95"/>${s.highTomado ? `<circle cx="${X(s.highEn + 2.5)}" cy="${Y(s.high)}" r="2.5" fill="${tono[s.k]}"/>` : ''}
      <line x1="${X(s.tLow != null ? s.tLow + 2.5 : s.t1)}" x2="${s.lowTomado ? X(s.lowEn + 2.5) : Wg - R + 4}" y1="${Y(s.low)}" y2="${Y(s.low)}" stroke="${tono[s.k]}" stroke-opacity=".95"/>${s.lowTomado ? `<circle cx="${X(s.lowEn + 2.5)}" cy="${Y(s.low)}" r="2.5" fill="${tono[s.k]}"/>` : ''}`).join('');
    // etiquetas de niveles a la derecha, sin encimarse
    const niveles = []; ses.forEach(s => { if(!s.highTomado) niveles.push({p:s.high, txt:s.n.slice(0,3).toUpperCase() + ' H ' + num(s.high), col: tono[s.k]}); if(!s.lowTomado) niveles.push({p:s.low, txt:s.n.slice(0,3).toUpperCase() + ' L ' + num(s.low), col: tono[s.k]}); });
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
  /* ---------------------------------------------------- PO3 de la vela de 4H
     Open → Manipulación → Distribución. Las velas de 4H del CME arrancan a las
     18:00 NY (18 · 22 · 02 · 06 · 10 · 14). Se arma con las velas de 5 min. */
  function po3(sym){
    const j = cache['velas_' + sym]; const r = j && j.chart && j.chart.result && j.chart.result[0]; if(!r) return null;
    const ts = r.timestamp || [], q = ((r.indicators||{}).quote||[{}])[0], hi = q.high || [], lo = q.low || [], op = q.open || [], cl = q.close || [];
    const velas = ts.map((t, i) => ({t: t*1000, hi: hi[i], lo: lo[i], op: op[i], cl: cl[i]})).filter(v => v.hi != null && v.lo != null).map(v => Object.assign(v, ny(v.t)));
    if(!velas.length) return null;
    const bloque = v => { const b = Math.floor(((v.min - 18*60) + 1440) % 1440 / 240); return v.ymd + '#' + b; };   // 0 = 18:00, 1 = 22:00, 2 = 02:00, 3 = 06:00, 4 = 10:00, 5 = 14:00
    const claves = []; velas.forEach(v => { const k = bloque(v); if(claves[claves.length-1] !== k) claves.push(k); });
    const arma = k => { const vs = velas.filter(v => bloque(v) === k); if(!vs.length) return null; const b = +k.split('#')[1];
      return {k, ini: (18*60 + b*240) % 1440, vs, open: vs[0].op != null ? vs[0].op : vs[0].cl, high: Math.max(...vs.map(v => v.hi)), low: Math.min(...vs.map(v => v.lo)), close: vs[vs.length-1].cl, n: vs.length}; };
    const cur = arma(claves[claves.length-1]), prev = claves.length > 1 ? arma(claves[claves.length-2]) : null;
    const precio = precioReal(r) || cur.close;
    const ahora = ny(Date.now()); const enCurso = bloque({ymd: ahora.ymd, min: ahora.min}) === cur.k;
    const restan = enCurso ? 240 - (((ahora.min - cur.ini) + 1440) % 1440) : 0;
    // lectura PO3: dónde está el precio contra el open y si ya hubo la manipulación (barrida del lado contrario)
    const arriba = precio > cur.open; const manipAbajo = cur.low < cur.open - (cur.open * 0.0004), manipArriba = cur.high > cur.open + (cur.open * 0.0004);
    let fase, lectura;
    if(arriba && manipAbajo){ fase = 'DISTRIBUCIÓN ▲'; lectura = 'Ya barrió abajo del open (manipulación) y ahora expande arriba: PO3 alcista en curso · busca largos en el retroceso al equilibrio.'; }
    else if(!arriba && manipArriba){ fase = 'DISTRIBUCIÓN ▼'; lectura = 'Ya barrió arriba del open (manipulación) y ahora expande abajo: PO3 bajista en curso · busca cortos en el retroceso al equilibrio.'; }
    else if(arriba){ fase = 'MANIPULACIÓN ▲ ?'; lectura = 'Arriba del open sin haber barrido abajo: puede ser la manipulación de un PO3 bajista. Espera que rompa o que regrese al open.'; }
    else { fase = 'MANIPULACIÓN ▼ ?'; lectura = 'Abajo del open sin haber barrido arriba: puede ser la manipulación de un PO3 alcista. Espera que rompa o que regrese al open.'; }
    if(cur.n < 4) { fase = 'OPEN'; lectura = 'La vela apenas abre: acumulación alrededor del open. Todavía no hay manipulación que leer.'; }
    /* en distribución: ¿ya rompió el break (high/low de la vela previa) y hay un FVG de 5m en la expansión que el precio respete? */
    let bos = null, fvg = null;
    if(fase.startsWith('DISTRIBUCIÓN')){
      const vs = cur.vs; const iExt = arriba ? vs.findIndex(v => v.lo === cur.low) : vs.findIndex(v => v.hi === cur.high);   // dónde fue la manipulación
      if(prev) bos = arriba ? (precio > prev.high ? 'rompió el high de la vela previa (' + prev.high.toFixed(2) + ')' : 'aún no rompe el high previo ' + prev.high.toFixed(2)) : (precio < prev.low ? 'rompió el low de la vela previa (' + prev.low.toFixed(2) + ')' : 'aún no rompe el low previo ' + prev.low.toFixed(2));
      for(let i = vs.length - 1; i >= Math.max(2, iExt + 2); i--){   // el FVG más reciente de la expansión
        if(arriba && vs[i].lo > vs[i-2].hi){ fvg = {a: vs[i-2].hi, b: vs[i].lo, i}; break; }
        if(!arriba && vs[i].hi < vs[i-2].lo){ fvg = {a: vs[i].hi, b: vs[i-2].lo, i}; break; }
      }
      if(fvg){ const despues = vs.slice(fvg.i + 1);
        const probado = despues.some(v => arriba ? v.lo <= fvg.b : v.hi >= fvg.a);
        const roto = despues.some(v => arriba ? v.cl < fvg.a : v.cl > fvg.b);
        fvg.estado = roto ? 'roto' : probado ? 'respetado' : 'sin probar'; }
    }
    /* killzones del día (Asia · Londres · Pre-NY · NY AM): sus highs y lows son lo que la vela de 4H manipula */
    const N = noche(sym); const niveles = [];
    const D = N ? N.D : null; const rel = v => v.ymd === D ? v.min : v.min - 1440;
    const sesiones = (N ? N.sesiones.filter(s => !s.vacia).map(s => ({k:s.k, n:{asia:'ASIA', lon:'LNDN', ny:'NY'}[s.k], high:s.high, low:s.low, t0:s.t0, t1:s.t1, tHigh:s.tHigh, tLow:s.tLow})) : []);
    const ayer = D ? diaMas(D, -1) : null; const velasD = velas.filter(v => !ayer || v.ymd >= ayer);   // solo la víspera y el día D: con 5 días de velas, los días viejos no deben contar
    const tomaEn = (desde, lado, v) => { const k = velasD.find(x => rel(x) >= desde && (lado === 'high' ? x.hi > v : x.lo < v)); return k ? rel(k) : null; };
    sesiones.forEach(s => {
      niveles.push({n: s.n + ' High', v: s.high, lado:'high', t: s.tHigh != null ? s.tHigh : s.t1, tFin: tomaEn((s.tHigh != null ? s.tHigh : s.t1) + 5, 'high', s.high)});
      niveles.push({n: s.n + ' Low', v: s.low, lado:'low', t: s.tLow != null ? s.tLow : s.t1, tFin: tomaEn((s.tLow != null ? s.tLow : s.t1) + 5, 'low', s.low)}); });
    if(prev){ const tp = rel(prev.vs[prev.vs.length-1]) + 5; niveles.push({n:'4H previa High', v: prev.high, lado:'high', t: tp, tFin: tomaEn(tp, 'high', prev.high)}); niveles.push({n:'4H previa Low', v: prev.low, lado:'low', t: tp, tFin: tomaEn(tp, 'low', prev.low)}); }
    niveles.forEach(nv => nv.tomado = nv.tFin != null);
    for(let i = niveles.length - 1; i >= 0; i--){ const a = niveles[i]; if(!a.n.startsWith('4H')) continue; if(niveles.some(b => b !== a && !b.n.startsWith('4H') && b.lado === a.lado && Math.abs(b.v - a.v) <= Math.max(2, a.v * 0.0001))) niveles.splice(i, 1); }
    // qué manipuló esta vela: los niveles del lado contrario que barrió antes de expandir
    const t0cur = rel(cur.vs[0]);
    const barridos = niveles.filter(nv => nv.t <= t0cur + 5 && (nv.tFin == null || nv.tFin >= t0cur) && (arriba ? (nv.lado === 'low' && cur.low < nv.v && nv.v <= cur.open) : (nv.lado === 'high' && cur.high > nv.v && nv.v >= cur.open)));
    const manipula = barridos.length ? barridos.sort((a, b) => arriba ? a.v - b.v : b.v - a.v)[0] : null;
    if(manipula) lectura = lectura.replace('(manipulación)', '(manipuló ' + manipula.n + ' ' + manipula.v.toFixed(2) + ')');
    /* CONDICIÓN (la del video): el FVG de 5m que el precio va a probar. Si lo respeta → va por la liquidez de ese lado;
       si lo invierte → va por la del otro. Eso dicta la dirección, no un sesgo diario. */
    const cerca = dir => niveles.filter(nv => !nv.tomado && (dir ? (nv.lado === 'high' && nv.v > precio) : (nv.lado === 'low' && nv.v < precio))).sort((a, b) => dir ? a.v - b.v : b.v - a.v)[0] || null;
    /* el FVG de la condición es el que deja la apertura de NY: se cierra en la vela de 9:35, 9:40 o 9:45; queda marcado todo el día */
    const ventana = velasD.filter(v => v.ymd === D); const cands = [];
    for(let i = 2; i < ventana.length; i++){
      if(ventana[i].min < 9*60+35 || ventana[i].min > 9*60+45) continue;   // el FVG que cierra en la vela de 9:35, 9:40 o 9:45
      const alc = ventana[i].lo > ventana[i-2].hi, baj = ventana[i].hi < ventana[i-2].lo; if(!alc && !baj) continue;
      const f = {i, alc, a: alc ? ventana[i-2].hi : ventana[i].hi, b: alc ? ventana[i].lo : ventana[i-2].lo, t: rel(ventana[i])};   // a = piso · b = techo
      const alto = f.b - f.a; if(alto < precio * 0.00015) continue;
      const desp = ventana.slice(i + 1);
      const iT = desp.findIndex(v => v.lo <= f.b && v.hi >= f.a), iI = desp.findIndex(v => alc ? v.cl < f.a : v.cl > f.b);
      f.estado = iI >= 0 ? 'invertido' : iT >= 0 ? (desp.slice(iT + 1).some(v => alc ? v.cl > f.b + alto : v.cl < f.a - alto) ? 'respetado' : 'probando') : 'sin probar';
      f.tRes = iI >= 0 ? rel(desp[iI]) : iT >= 0 ? rel(desp[iT]) : null;
      f.dist = precio > f.b ? precio - f.b : precio < f.a ? f.a - precio : 0;
      cands.push(f);
    }
    const ahoraRel = ahora.ymd === D ? ahora.min : ahora.min - 1440;
    // de los de la apertura, el más cercano al precio de las 9:45 (el que el mercado va a probar primero)
    const v945 = ventana.find(v => v.min >= 9*60+45) || ventana[ventana.length-1]; const p945 = v945 ? v945.cl : precio;
    cands.forEach(f => { f.dist945 = p945 > f.b ? p945 - f.b : p945 < f.a ? f.a - p945 : 0; });
    let condicion = cands.sort((x, y) => x.dist945 - y.dist945)[0] || null;
    let dirCond = null;
    if(condicion){ const c0 = condicion; c0.siRespeta = c0.alc ? cerca(true) : cerca(false); c0.siInvierte = c0.alc ? cerca(false) : cerca(true);
      if(c0.estado === 'respetado') dirCond = c0.alc; else if(c0.estado === 'invertido') dirCond = !c0.alc; }
    /* objetivo: si la condición ya se resolvió, ella manda la dirección; si no, la fase PO3 */
    const dirPo3 = fase.startsWith('DISTRIBUCIÓN') ? arriba : (fase === 'OPEN' ? arriba : !arriba);
    const dirObj = dirPo3;   // el objetivo de la vela de 4H es el de la vela; la condición dice lo suyo en su texto
    const objetivo = cerca(dirObj);
    const numC = x => x.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const hC = mm => { mm = ((mm % 1440) + 1440) % 1440; return String(Math.floor(mm/60)).padStart(2,'0') + ':' + String(mm%60).padStart(2,'0'); };
    if(condicion){ const c0 = condicion;
      if(dirCond != null){ lectura = lectura.replace(/ · busca (largos|cortos) en el retroceso al equilibrio\./, '.'); }
      lectura = `<b>Condición:</b> FVG 5m ${c0.alc ? 'alcista' : 'bajista'} ${numC(c0.a)}–${numC(c0.b)} (${hC(c0.t)}). Si lo <b>respeta</b> → ${c0.alc ? 'sube' : 'baja'} por ${c0.siRespeta ? c0.siRespeta.n + ' ' + numC(c0.siRespeta.v) : 'la liquidez ' + (c0.alc ? 'de arriba' : 'de abajo')}. Si lo <b>invierte</b> → ${c0.alc ? 'baja' : 'sube'} por ${c0.siInvierte ? c0.siInvierte.n + ' ' + numC(c0.siInvierte.v) : 'la liquidez ' + (c0.alc ? 'de abajo' : 'de arriba')}. `
        + (c0.estado === 'respetado' ? `<b class="up">Respetado a las ${hC(c0.tRes)}</b> → dirección ${c0.alc ? 'alcista' : 'bajista'}: solo ${c0.alc ? 'largos' : 'cortos'}, continuación.` : c0.estado === 'invertido' ? `<b class="down">Invertido a las ${hC(c0.tRes)}</b> → dirección ${c0.alc ? 'bajista' : 'alcista'}: solo ${c0.alc ? 'cortos' : 'largos'}, continuación.` : c0.estado === 'probando' ? 'Lo está probando ahora: espera el cierre.' : 'Todavía no lo prueba.') + ' ' + lectura; }
    if(!condicion && ventana.some(v => v.min >= 9*60+45)) lectura = '<b>Condición:</b> la apertura de 9:30–9:45 no dejó FVG de 5m. ' + lectura;
    if(objetivo) lectura += ' Objetivo: ' + objetivo.n + ' ' + objetivo.v.toFixed(2) + ' (' + (dirObj ? '+' : '') + (objetivo.v - precio).toFixed(2) + ' pts).';
    /* fibo del último impulso válido: en distribución, de la manipulación (extremo contrario) al extremo alcanzado desde entonces;
       si aún no hay distribución, el impulso de la 4H previa. Niveles 0 · EQ 0.5 · 0.705 · 0.79 · 1 */
    let fibo = null;
    const legDe = (vsArr, alc) => { if(!vsArr.length) return null; const iA = alc ? vsArr.findIndex(v => v.lo === Math.min(...vsArr.map(x => x.lo))) : vsArr.findIndex(v => v.hi === Math.max(...vsArr.map(x => x.hi)));
      const desp = vsArr.slice(iA); const A = alc ? vsArr[iA].lo : vsArr[iA].hi; const B = alc ? Math.max(...desp.map(x => x.hi)) : Math.min(...desp.map(x => x.lo)); const iB = iA + desp.findIndex(v => (alc ? v.hi : v.lo) === B);
      if(Math.abs(B - A) < A * 0.0005) return null; return {A, B, alc, tA: rel(vsArr[iA]), tB: rel(vsArr[iB])}; };
    fibo = legDe(cur.vs, dirPo3) || (prev ? legDe(prev.vs.concat(cur.vs), dirPo3) : null);   // el fibo sigue al impulso de la 4H (como estaba), no a la condición
    if(fibo){ const r2 = Math.abs(fibo.B - fibo.A); fibo.nivel = k => fibo.alc ? fibo.B - k * r2 : fibo.B + k * r2; fibo.rango = r2;
      fibo.entrada = fibo.nivel(0.705); fibo.stop = fibo.nivel(1) + (fibo.alc ? -1 : 1) * Math.max(2, r2 * 0.05);
      if(objetivo){ const riesgo = Math.abs(fibo.entrada - fibo.stop), premio = Math.abs(objetivo.v - fibo.entrada); fibo.rr = riesgo > 0 ? premio / riesgo : null; } }
    return {sym, precio, cur, prev, enCurso, restan, fase, lectura, arriba, manipAbajo, manipArriba, bos, fvg, niveles, manipula, objetivo, dirObj, D, rel, velasTodas: velasD, sesiones, fibo, condicion, dirCond};
  }
  /* gráfica: velas de 5 min de las últimas horas, las killzones como líneas con su etiqueta, el rango de la 4H actual
     punteado con su open, y la vela de 4H dibujada en grande a la derecha (como en el chart de TradingView) */
  function graficaPo3(d){
    const Wg = 1000, Hg = 400, L = 8, R = 200, T = 26, B = 34, VW = 40, GAP = 22;   // R: hueco para la vela grande + columna de etiquetas
    const c = d.cur, p = d.prev; const todas = d.velasTodas;
    const iFin = todas.length - 1;
    const iIni = Math.max(0, iFin - 143);            // últimas 12 h
    const vs = todas.slice(iIni); const iCur = Math.max(0, todas.indexOf(c.vs[0]) - iIni);
    const nivelesVis = d.niveles;
    const pMin = Math.min(...vs.map(v => v.lo), ...nivelesVis.map(n => n.v)), pMax = Math.max(...vs.map(v => v.hi), ...nivelesVis.map(n => n.v)); const pad = (pMax - pMin) * 0.14 || 1;   // aire arriba y abajo: nada se corta
    const lo0 = pMin - pad, hi0 = pMax + pad;
    const n = vs.length, plotR = Wg - R, paso = (plotR - L) / n, cw = Math.max(1.5, paso * 0.6);
    const X = i => L + i * paso + paso / 2, Y = v => T + (1 - (v - lo0) / (hi0 - lo0)) * (Hg - T - B);
    const clampY = y => Math.max(T + 9, Math.min(Hg - B - 3, y));
    const xv = plotR + GAP + VW/2, xLbl = plotR + GAP + VW + 14;                     // vela grande · columna de etiquetas
    const num = v => v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const hora = mm => { mm = ((mm % 1440) + 1440) % 1440; return String(Math.floor(mm/60)).padStart(2,'0') + ':' + String(mm%60).padStart(2,'0'); };
    const cada = n > 200 ? 120 : 60;
    const APERTURAS = {1080:['ASIA','#FF4D5A'], 120:['LNDN','#4F8CFF'], 570:['NY','#39FF14']};   // 18:00 · 02:00 · 09:30
    let ejeT = ''; vs.forEach((v, i) => { if(v.min % cada === 0) ejeT += `<text x="${X(i)}" y="${Hg - 9}" text-anchor="middle">${hora(v.min)}</text>`;
      const ap = APERTURAS[v.min]; if(ap) ejeT += `<line x1="${X(i) - paso/2}" x2="${X(i) - paso/2}" y1="${T}" y2="${Hg - B}" stroke="${ap[1]}" stroke-opacity=".55" stroke-dasharray="3 3"/><text class="ses" x="${X(i) + 3}" y="${T + 9}" fill="${ap[1]}">${ap[0]}</text>`; });
    const xDe = t => { const idx = vs.findIndex(v => d.rel(v) >= t); return idx < 0 ? plotR - 4 : X(idx); };
    // etiquetas a la derecha sin encimarse (niveles vivos + open + ahora + objetivo)
    const etiq = [];
    nivelesVis.forEach(nv => { if(!nv.tomado) etiq.push({y: Y(nv.v), txt: nv.n.toUpperCase() + ' ' + num(nv.v), col: nv.n.startsWith('ASIA') ? '#FF4D5A' : nv.n.startsWith('LNDN') ? '#4F8CFF' : nv.n.startsWith('NY') ? '#39FF14' : 'var(--dim)', peso: 400}); });
    etiq.push({y: Y(d.precio), txt: 'AHORA ' + num(d.precio), col: d.arriba ? 'var(--up)' : 'var(--down)', peso: 700});
    const FIB = [[0.705, '0.705'], [0.79, '0.79']];   // solo estas dos, en rojo, sin números
    etiq.sort((a, b) => a.y - b.y); let last = -99; etiq.forEach(e => { e.ty = e.y - last < 12 ? last + 12 : e.y; last = e.ty; });
    const etiquetas = etiq.map(e => `<text class="ses" x="${xLbl}" y="${e.ty + 3}" fill="${e.col}" font-weight="${e.peso}">${e.txt}</text>`).join('');
    // líneas de killzone: hasta donde se tomaron (puntito) o hasta la vela grande si siguen vivas
    const kz = nivelesVis.map(nv => { const col = nv.n.startsWith('ASIA') ? '#FF4D5A' : nv.n.startsWith('LNDN') ? '#4F8CFF' : nv.n.startsWith('NY') ? '#39FF14' : 'var(--dim)'; const y = Y(nv.v);
      const esManip = d.manipula && d.manipula.n === nv.n;
      const xFin = nv.tomado ? xDe(nv.tFin) : xLbl - 6;   // la línea acaba en su PRIMERA barrida
      return `<line x1="${xDe(nv.t)}" x2="${xFin}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="${esManip ? 2.2 : 1.4}" stroke-opacity="1"/>${nv.tomado ? `<circle cx="${xFin}" cy="${y}" r="2.5" fill="${col}"/>` : ''}`; }).join('');
    // rango de la 4H actual (caja punteada) + open hasta la vela grande
    const x0 = X(iCur) - paso/2;
    const caja = '';
    // fibo: líneas desde el extremo B hasta la columna; zona 0.5–0.79 sombreada
    let fibG = '';
    if(d.fibo){ const xB = xDe(d.fibo.tB); const y1 = Y(d.fibo.nivel(0.705)), y2 = Y(d.fibo.nivel(0.79));   // zona de entrada 0.705–0.79 como fondo rojo
      const colZ = d.fibo.alc ? '#39FF14' : '#FF2E63';   // alcista verde · bajista rojo
      fibG += `<rect x="${xB}" y="${Math.min(y1, y2)}" width="${Math.max(2, xLbl - 6 - xB)}" height="${Math.max(2, Math.abs(y2 - y1))}" fill="${colZ}" fill-opacity=".22" stroke="${colZ}" stroke-opacity=".5"/>`; }
    const velas = vs.map((v, i) => { const o = v.op != null ? v.op : v.cl; const up = v.cl >= o; const col = up ? 'var(--up)' : 'var(--down)';
      return `<line x1="${X(i)}" x2="${X(i)}" y1="${Y(v.hi)}" y2="${Y(v.lo)}" stroke="${col}"/><rect x="${X(i) - cw/2}" y="${Y(Math.max(o, v.cl))}" width="${cw}" height="${Math.max(1, Math.abs(Y(o) - Y(v.cl)))}" fill="${col}"/>`; }).join('');
    // la vela de 4H en grande (sin texto encima: el precio va en la columna)
    const up4 = d.precio >= c.open, col4 = up4 ? 'var(--up)' : 'var(--down)';
    const vela4 = `<line x1="${xv}" x2="${xv}" y1="${Y(c.high)}" y2="${Y(c.low)}" stroke="${col4}" stroke-width="2"/><rect x="${xv - VW/2}" y="${Y(Math.max(c.open, d.precio))}" width="${VW}" height="${Math.max(2, Math.abs(Y(c.open) - Y(d.precio)))}" fill="${col4}" fill-opacity=".9" stroke="${col4}"/>
      <text class="ses" x="${xv}" y="${Hg - 9}" text-anchor="middle" fill="var(--txt)">4H ${hora(c.ini)}</text>`;
    const marca = '';
    let condG = '';
    if(d.condicion){ const c0 = d.condicion; const col = (c0.estado === 'invertido' ? !c0.alc : c0.alc) ? '#39FF14' : '#FF2E63'; const xC = xDe(c0.t);   // invertido → cambia de color
      condG = `<rect x="${xC}" y="${Y(c0.b)}" width="${Math.max(2, xLbl - 6 - xC)}" height="${Math.max(2, Y(c0.a) - Y(c0.b))}" fill="${col}" fill-opacity=".14" stroke="${col}" stroke-opacity=".8" stroke-dasharray="${c0.estado === 'invertido' ? '3 3' : ''}"/><text class="ses" x="${xC + 4}" y="${clampY(Y(c0.b) - 4)}" fill="${col}">CONDICIÓN · ${c0.estado.toUpperCase()}</text>`; }
    const fvg = fibG + condG;
    // objetivo: el círculo se sienta SOBRE su nivel, al final de la línea, junto a la vela grande
    let obj = '';
    if(d.objetivo){ const yo = Y(d.objetivo.v), xo = xLbl - 6; const col = d.dirObj ? '#39FF14' : '#FF2E63';
      obj = `<circle cx="${xo}" cy="${yo}" r="9" fill="${col}" fill-opacity=".18" stroke="${col}" stroke-opacity=".9"><animate attributeName="r" values="7;12;7" dur="1.8s" repeatCount="indefinite"/><animate attributeName="fill-opacity" values=".3;.05;.3" dur="1.8s" repeatCount="indefinite"/></circle><circle cx="${xo}" cy="${yo}" r="3.5" fill="${col}" style="filter:drop-shadow(0 0 6px ${col})"/>`;
      const e = etiq.find(x => Math.abs(x.y - yo) < 0.5); if(e) e.obj = true; }
    const etiquetas2 = etiq.map(e => e.obj ? `<text class="ses" x="${xLbl}" y="${e.ty + 3}" fill="${d.dirObj ? '#39FF14' : '#FF2E63'}" font-weight="700" style="filter:drop-shadow(0 0 4px ${d.dirObj ? '#39FF14' : '#FF2E63'})">OBJETIVO · ${e.txt}</text>` : `<text class="ses" x="${xLbl}" y="${e.ty + 3}" fill="${e.col}" font-weight="${e.peso}" ${e.chico ? 'font-size="8"' : ''}>${e.txt}</text>`).join('');
    return `<svg class="noche-g" viewBox="0 0 ${Wg} ${Hg}" style="aspect-ratio:${Wg}/${Hg}">${ejeT}${kz}${caja}${fvg}${velas}${vela4}${marca}${obj}${etiquetas2}</svg>`;
  }
  function po3Html(){
    const datos = [SYM_NQ()].map(po3).filter(Boolean); if(!datos.length) return '';
    const num = v => v == null ? '—' : v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    return datos.map(d => { const dif = d.precio - d.cur.open; return `<div class="po3">
        <div class="fila" style="margin-bottom:6px;gap:12px"><b style="font-size:16px">${nombreContrato()}</b><span class="pill ${d.fase.startsWith('DISTRIBUCIÓN') ? (d.arriba ? 'ok' : 'mal') : 'acc'}">${d.fase}</span><span class="mono ${dif >= 0 ? 'up' : 'down'}">${dif >= 0 ? '+' : ''}${num(dif)} vs open</span>${d.condicion ? `<span class="pill ${d.condicion.estado === 'respetado' ? 'ok' : d.condicion.estado === 'invertido' ? 'mal' : ''}">CONDICIÓN · ${d.condicion.estado.toUpperCase()}${d.dirCond != null ? (d.dirCond ? ' ▲' : ' ▼') : ''}</span>` : ''}<span class="mono dim">${d.manipula ? 'manipula <b class="oro">' + d.manipula.n + ' ' + num(d.manipula.v) + '</b>' : (d.manipAbajo || d.manipArriba) ? 'manipulación sin nivel de killzone' : 'sin manipulación todavía'}${d.objetivo ? ' · objetivo <b class="' + (d.dirObj ? 'up' : 'down') + '">' + d.objetivo.n + ' ' + num(d.objetivo.v) + '</b>' : ''}</span><div class="crece"></div></div>
        ${graficaPo3(d)}
        <div class="mini dim" style="margin-top:6px">${d.lectura}${d.bos ? ' <b>Break:</b> ' + d.bos + '.' : ''}</div></div>`; }).join('');
  }
  function pintaPo3(P){
    const html = po3Html(); if(!html){ P.style.display = 'none'; return; }
    const ult = (() => { const j = cache['velas_' + SYM_NQ()]; const r = j && j.chart && j.chart.result && j.chart.result[0]; if(!r || !r.timestamp || !r.timestamp.length) return ''; const q = ((r.indicators||{}).quote||[{}])[0]; let k = r.timestamp.length - 1; while(k >= 0 && (q.close[k] == null)) k--; if(k < 0) return ''; const t = new Date(r.timestamp[k]*1000); const min = Math.round((Date.now() - t.getTime())/60000); return 'última vela ' + t.toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'}) + (min > 20 ? ' · <b class="down">Yahoo va ' + (min < 120 ? min + ' min' : min < 2880 ? Math.round(min/60) + ' h' : (min/1440).toFixed(1).replace('.0','') + ' días') + ' atrás</b>' : ''); })();
    P.style.display = ''; P.innerHTML = `<div class="fila"><h3>Vela de 4H · Open → Manipulación → Distribución</h3><div class="crece"></div><span class="mono mini dim">${ult} · se mueve solo · ${new Date().toLocaleTimeString('es-MX')}</span></div><div style="display:grid;gap:18px;margin-top:10px">${html}</div>`;
  }
  /* para el Dashboard: baja precios si hace falta y devuelve el HTML */
  async function po3Dashboard(){ try{ await precios(); }catch(e){} return po3Html(); }
  function pintaNoche(A){
    const datos = [SYM_NQ()].map(noche).filter(Boolean); if(!datos.length){ A.style.display = 'none'; return; }
    const num = v => v == null ? '—' : v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const d0 = datos[0];
    const fechaD = new Date(d0.D + 'T12:00:00').toLocaleDateString('es-MX', {weekday:'short', day:'numeric', month:'short'});
    const estadoNY = d0.pasada ? 'Mercado cerrado · última noche: ' + fechaD : d0.abrioNY ? 'NY ya abrió · los niveles vivos son los imanes del día' : d0.minParaNY != null && d0.minParaNY > 0 ? 'NY abre en ' + Math.floor(d0.minParaNY/60) + 'h ' + (d0.minParaNY%60) + 'm' : 'Noche en curso';
    A.style.display = ''; A.innerHTML = `<div class="fila"><div><h3>La noche</h3><div class="sub">${estadoNY}</div></div><div class="crece"></div></div>
      <div style="margin-top:10px">${datos.map(d => `<div><div class="fila" style="margin-bottom:4px"><b>${nombreContrato()}</b><div class="crece"></div>${d.sesiones.filter(s => !s.vacia).map(s => `<span class="mini dim">${s.n} <b class="mono">${num(s.rango)}</b></span>`).join('')}</div>${graficaNoche(d)}</div>`).join('')}</div>`;
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
      <div></div>
      <div class="crece"></div><button class="btn chico" data-acc="mercadoRecarga">↻ actualizar</button>
    </div>
    <div class="grid g4" style="margin-bottom:12px" id="mkPrecios">${kpi(nombreContrato() + ' · Micro Nasdaq','…','contrato')}${kpi('ES · S&P 500','…','futuro')}${kpi('BTC','…','futuro CME')}${kpi('USD / MXN','…','tipo de cambio')}</div>
    <div class="card"><div class="fila"><h3>Calendario económico</h3><div class="crece"></div><span class="ffi alto"></span><span class="ffi medio" style="margin-left:8px"></span></div>
      
      <div id="mkTabla" style="margin-top:10px">${vacio('Cargando Forex Factory…')}</div></div>`;
  };

  /* precios + vela de 4H + noche: se refrescan solos cada minuto mientras Mercado esté a la vista */
  async function cargarPrecios(){
    const P = document.getElementById('mkPrecios'), A = document.getElementById('mkAviso'); if(!P) return;
    try{
      const px = await precios();
      const num = (v, d) => v == null ? '—' : v.toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});
      const fila = (q, dec) => !q ? 'sin datos · usa la app de escritorio' : (q.chg != null ? `<span class="${q.chg >= 0 ? 'up' : 'down'}">${q.chg >= 0 ? '+' : ''}${q.chg.toFixed(2)}%${q.pts != null ? ' · ' + (q.pts >= 0 ? '+' : '') + num(q.pts, dec) + ' pts' : ''}</span>` : '') + (q.hi != null ? ` · hoy ${num(q.lo, dec)}–${num(q.hi, dec)}` : '') + (q.spot ? ' · spot' : '');
      /* el precio vive en un span con su signo (verde si el día va positivo, rojo si negativo) y late; al cambiar, rueda del valor viejo al nuevo */
      const val = (q, dec, id) => q ? `<span id="${id}" class="px ${q.chg != null ? (q.chg >= 0 ? 'up' : 'down') : ''}" data-v="${q.precio}" data-dec="${dec}">${num(q.precio, dec)}</span>` : '—';
      const previos = {}; ['pxNQ','pxES','pxBTC'].forEach(id => { const el = document.getElementById(id); if(el) previos[id] = +el.dataset.v; });
      if(document.getElementById('mkPrecios')) P.innerHTML =
        kpi(nombreContrato() + ' · Micro Nasdaq', val(px.fut.NQ, 2, 'pxNQ'), fila(px.fut.NQ, 2)) +
        kpi('ES · S&P 500', val(px.fut.ES, 2, 'pxES'), fila(px.fut.ES, 2)) +
        kpi('BTC', val(px.fut.BTC, 0, 'pxBTC'), fila(px.fut.BTC, 0)) +
        kpi('USD / MXN', px.mxn ? px.mxn.toFixed(2) : '—', px.mxn ? 'tu meta de ' + (Store.ajustes.metaMXN||100000).toLocaleString('es-MX') + ' MXN = ' + fmt((Store.ajustes.metaMXN||100000)/px.mxn) : '');
      if(px.mxn && Store.ajustes.tcAuto !== false){ Store.ajustes.tc = Math.round(px.mxn*100)/100; }
    }catch(e){}
  }
  setInterval(() => { if(document.getElementById('mkPrecios') && !document.hidden) cargarPrecios(); }, 60000);
  async function cargar(){
    const T = document.getElementById('mkTabla'); if(!T) return;
    await cargarPrecios();
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
  window.Mercado = { noticias, precios, proximaAlta, cargar, cache, info, noticiasDe, escenario, horaLocal, noche, po3, po3Html, po3Dashboard, fetchJSON };
})();
