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
    const j = await fetchJSON('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=5m&range=1d');
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
    <div class="card"><div class="fila"><h3>Calendario económico</h3><div class="crece"></div><span class="ffi alto"></span><span class="mini dim">alto</span><span class="ffi medio" style="margin-left:8px"></span><span class="mini dim">medio</span></div>
      <div class="sub">Forex Factory · hora de Morelia · datos USD que mueven ES · NQ · BTC · clic en una noticia para ver cómo pega</div>
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
      const prox = proximaAlta(lista);
      if(prox){ const min = Math.round((prox.t.getTime() - ahora)/60000);
        A.style.display = ''; A.innerHTML = `<h3 class="${min <= 30 && min >= -30 ? 'down' : ''}">Próxima noticia fuerte USD: ${h(prox.titulo)}</h3><div class="sub">${diaLocal(prox.t)} ${horaLocal(prox.t)} · ${min > 0 ? 'en ' + (min >= 60 ? Math.floor(min/60) + 'h ' + (min%60) + 'm' : min + ' min') : 'hace ' + Math.abs(min) + ' min'}</div>
          <div class="mini dim" style="margin-top:6px">${min <= 30 && min >= -30 ? '<b class="down">Ventana de noticia: no entres 15 min antes ni 15 después.</b>' : 'Planea el día alrededor: la condición se escribe antes, la ejecución no cruza la noticia.'}</div>`; }
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
  window.Mercado = { noticias, precios, proximaAlta, cargar, cache, info, noticiasDe, escenario, horaLocal };
})();
