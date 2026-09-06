/* ============================================================================
   MESA — arranque, ruteo y formularios
   ========================================================================= */
(function(){
  const {h, fmt, pct, signo, masMenos, kpi, opciones, modal, cerrar, toast, vacio, aviso, fechaLarga} = UI;

  const MENU = [
    {g:'Operar'},
    {id:'mercado',    t:'Mercado',      i:'◉'},
    {id:'panel',      t:'Dashboard',    i:'▤'},
    {id:'diario',     t:'Trades',       i:'≡'},
    {id:'calendario', t:'Calendario',   i:'▦'},
    {g:'Analizar'},
    {id:'reportes',   t:'Reportes',     i:'◔'},
    {id:'backtest',   t:'Backtesting',  i:'⟲'},
    {g:'Cuenta'},
    {id:'cuentas',    t:'Cuentas',      i:'▣'},
    {id:'payouts',    t:'Payouts',      i:'$'},
    {id:'progreso',   t:'Progreso',     i:'▲'},
    {id:'riesgo',     t:'Riesgo',       i:'◈'}
  ];
  const OCULTAS = {sync:'Importar', ajustes:'Ajustes', plan:'Plan del día', playbook:'Playbook', lab:'Lab', historial:'Historial', trading:'Trading'};
  let vista = location.hash.replace('#','') || 'panel';
  if(!MENU.some(m => m.id === vista) && !OCULTAS[vista]) vista = 'panel';

  /* --------------------------------------------------------------- pintar */
  function pinta(){
    const A = Store.ajustes;
    document.getElementById('nav').innerHTML = MENU.map(m => m.g
      ? `<div class="sep">${m.g}</div>`
      : `<button data-ir="${m.id}" class="${vista === m.id ? 'on' : ''}" style="position:relative"><span class="i">${m.i}</span>${m.t}</button>`).join('');

    const cuentas = Store.estado.cuentas;
    const act = Store.cuentaActiva();
    const P = Tema.perfil();
    document.getElementById('perfil').innerHTML = `<div class="av">${P.foto ? `<img src="${P.foto}">` : h(P.iniciales)}</div><div><div class="pn">${h(P.nombre)}</div><div class="pf">${h(P.ciudad || P.frase)}</div></div>`;
    document.getElementById('perfil').onclick = () => { vista = 'ajustes'; location.hash = 'ajustes'; pinta(); };
    document.getElementById('top').innerHTML = `
      <h1>${h((MENU.find(m => m.id === vista)||{}).t || OCULTAS[vista] || '')}</h1>
      <div class="der">
        ${cuentas.length ? selectorCuentas() : ''}
        ${Vistas._latido()}
        <span class="reloj" id="reloj"></span>
        <button class="btn chico fantasma ${vista === 'ajustes' ? 'acc' : ''}" data-ir="ajustes" title="Ajustes">⚙</button>
      </div>`;

    document.getElementById('vista').innerHTML = (Vistas[vista] || Vistas.panel)();
    reloj();
    document.dispatchEvent(new CustomEvent('mesa:pintado'));
  }

  /* selector de cuentas: una, varias o todas */
  let selAbierto = false;
  function selectorCuentas(){
    const S = Store.estado, sel = Store.cuentasSel(), ids = new Set(sel.map(c => c.id));
    const todas = sel.length === S.cuentas.length && S.cuentas.length > 1;
    const resumen = todas ? 'Todas las cuentas' : sel.length === 1 ? (sel[0].alias || sel[0].firma) + ' · ' + (sel[0].tamano/1000) + 'k' : sel.length + ' cuentas';
    return `<div class="selcta">
      <button class="btn chico ${sel.length > 1 ? 'acc' : ''}" data-acc="selAbrir">▣ ${h(resumen)} ▾</button>
      <div class="selpanel" ${selAbierto ? '' : 'hidden'}>
        <label class="selfila ${todas ? 'on' : ''}"><input type="checkbox" data-selcta="*" ${todas ? 'checked' : ''}> <b>Todas a la vez</b></label>
        ${S.cuentas.map(c => { const e = Motor.estadoCuenta(c); return `<label class="selfila ${ids.has(c.id) ? 'on' : ''}"><input type="checkbox" data-selcta="${c.id}" ${ids.has(c.id) ? 'checked' : ''}>
          <span>${h(c.alias || c.firma)} <span class="tenue mono">${(c.tamano/1000)}k · ${h(Motor.FASES[Motor.faseReal(e)].nombre)}</span></span>
          <span class="mono ${e.ganancia >= 0 ? 'up' : 'down'}" style="margin-left:auto">${fmt(e.balance)}</span></label>`; }).join('')}
        <div class="mini tenue" style="padding:8px 10px 4px">Marca una para operar; varias para ver el conjunto.</div>
      </div></div>`;
  }

  function reloj(){
    const el = document.getElementById('reloj');
    if(!el) return;
    const abre = Motor.aperturaNY(), ahora = Motor.minAhora();
    const d = new Date();
    const hhmmss = [d.getHours(), d.getMinutes(), d.getSeconds()].map(x => String(x).padStart(2,'0')).join(':');
    const falta = abre - ahora;
    el.innerHTML = hhmmss + ' <span class="tenue">·</span> ' +
      (falta > 0 ? 'NY abre en ' + Math.floor(falta/60) + 'h ' + (falta%60) + 'm'
       : falta > -90 ? '<span class="acc">VENTANA VIVA · ' + Math.abs(Math.round(falta)) + ' min</span>'
       : 'ventana cerrada');
  }
  setInterval(reloj, 1000);

  document.addEventListener('mesa:cambio', pinta);
  document.addEventListener('mesa:sync', () => { if(!document.querySelector('.velo')) pinta(); });

  /* plataforma embebida (app nativa): Swift pone un WKWebView exactamente sobre #tvWrap */
  const np = m => { try{ window.webkit.messageHandlers.np.postMessage(m); }catch(e){} };
  function colocaPlataforma(){
    if(!window.__npNativo) return;
    const w = document.getElementById('tvWrap'); const url = w && w.dataset.url;
    if(!w || !url || document.querySelector('.velo') || document.getElementById('acceso') && !document.getElementById('acceso').hidden){ np({cmd:'plataformaOcultar'}); return; }
    const r = w.getBoundingClientRect();
    // se manda la distancia al borde INFERIOR: en AppKit el origen está abajo y así no importa si el alto del viewport y el de la vista difieren
    np({cmd:'plataforma', url, x:r.left, y:r.top, w:r.width, h:r.height, abajo: window.innerHeight - (r.top + r.height), ratio: window.devicePixelRatio || 1});
  }
  document.addEventListener('mesa:pintado', () => setTimeout(colocaPlataforma, 30));
  addEventListener('resize', colocaPlataforma); addEventListener('scroll', colocaPlataforma, true);
  new MutationObserver(() => { if(document.querySelector('.velo') || !document.getElementById('tvWrap')) np({cmd:'plataformaOcultar'}); else colocaPlataforma(); }).observe(document.body, {childList:true});
  window.addEventListener('hashchange', () => { const v = location.hash.replace('#',''); if(Vistas[v]){ vista = v; pinta(); } });

  /* -------------------------------------------------------------- eventos */
  document.addEventListener('click', e => {
    const ir = e.target.closest('[data-ir]');
    if(ir){ vista = ir.dataset.ir; location.hash = vista; pinta(); return; }

    const seg = e.target.closest('.seg [data-v]');
    if(seg && !e.target.closest('.velo')){
      const cual = seg.closest('.seg').dataset.seg, v = seg.dataset.v;
      if(cual === 'modo'){ Store.ajustes.modo = v; Store.guardar(); }
      else if(cual === 'fres'){ Vistas._filtro.res = v; pinta(); }
      else if(cual === 'fregla'){ Vistas._filtro.regla = v; pinta(); }
      else if(cual === 'activada'){ Store.guardaDia(Store.hoyISO(), {activada: v}); }
      else if(cual === 'labFuente'){ Vistas._lab.fuente = v; pinta(); }
      else if(cual === 'labEscala'){ Vistas._lab.escala = +v; pinta(); }
      else if(cual === 'mkFiltro'){ Store.ajustes.mkFiltro = v; Store.guardar(); }
      else if(cual === 'plataforma'){ Store.ajustes.plataforma = v; Store.guardar(); }
      else if(cual === 'tvSym'){ Store.ajustes.tvSymbol = v; Store.guardar(); }
      else if(cual === 'tvIv'){ Store.ajustes.tvIntervalo = v; Store.guardar(); }
      return;
    }

    const cr = e.target.closest('[data-cr]');
    if(cr){
      e.stopPropagation();
      const tid = cr.closest('[data-crid]').dataset.crid, t = Store.estado.trades.find(x => x.id === tid);
      if(!t) return;
      const r = cr.dataset.cr, on = !cr.classList.contains('on');
      if(r === 'listo'){ t.porCalificar = false; }
      else if(r === 'condicion'){ if(on && !t.condicion) t.condicion = Store.dia(t.fecha).condicion || 'Condición del día cumplida'; t.condicionCumplida = on; }
      else if(r === 'continuacion'){ t.tipo = on ? 'continuacion' : 'reversion'; }
      else if(r === 'equilibrio'){ t.confluencias = (t.confluencias||[]).filter(c => c !== 'equilibrio' && c !== 'fvg'); if(on) t.confluencias.push('equilibrio','fvg'); }
      else if(r === 'tpInterno'){ t.tpTipo = on ? 'interno' : 'externo'; }
      Store.guardar(); return;
    }
    const dia = e.target.closest('.cal .d[data-dia]');
    if(dia){ const iso = dia.dataset.dia; if(iso <= Store.hoyISO()) modalTrade(null, {fecha: iso}); else modalDia(iso); return; }

    if(!e.target.closest('.selcta') && selAbierto){ selAbierto = false; const p = document.querySelector('.selpanel'); if(p) p.hidden = true; }
    const b = e.target.closest('[data-acc]');
    if(!b){ const fila = e.target.closest('tr[data-trade]'); if(fila) modalTrade(Store.estado.trades.find(t => t.id === fila.dataset.trade)); return; }
    const acc = b.dataset.acc, id = b.dataset.id;
    const F = {
      nuevoTrade: () => modalCargador(),
      dispara: () => { cerrar(); modalTrade(null); },
      tradeBacktest: () => modalTrade(null, {modo:'backtest'}),
      tradeSesion: () => modalTrade(null, {modo:'backtest', sesionId:id}),
      editaTrade: () => modalTrade(Store.estado.trades.find(t => t.id === id)),
      editaTradeForm: () => { cerrar(); modalTrade(Store.estado.trades.find(t => t.id === id)); },
      fichaTrade: () => modalFichaTrade(id),
      pdfTrade: () => PDF.descargaTrade(id).then(() => toast('PDF listo')),
      fichaTradeDescarga: () => Ficha.descargaTrade(id).then(() => toast('Ficha guardada')),
      fichaTradeComparte: () => Ficha.comparteTrade(id).then(ok => { if(!ok){ Ficha.descargaTrade(id); toast('Sin compartir nativo: se descargó la ficha'); } }),
      nuevaCuenta: () => modalCuenta(null),
      editaCuenta: () => modalCuenta(Store.cuenta(id)),
      borraCuenta: () => { if(confirm('¿Borrar la cuenta y todos sus trades?')) Store.borraCuenta(id); },
      activar: () => { Store.ajustes.cuentaActiva = id; Store.guardar(); },
      promover: () => modalPromover(Store.cuenta(id)),
      nuevaSesion: () => modalSesion(),
      borraSesion: () => { if(confirm('¿Borrar la sesión y sus trades de backtest?')) Store.borraSesion(id); },
      nuevoPayout: () => modalPayout(),
      borraPayout: () => { if(confirm('¿Borrar este retiro?')) Store.borraPayout(id); },
      mes: () => { const v = +b.dataset.v;
        if(v === 0){ Vistas._cal.y = new Date().getFullYear(); Vistas._cal.m = new Date().getMonth(); }
        else { let m = Vistas._cal.m + v; Vistas._cal.y += Math.floor(m/12); Vistas._cal.m = ((m%12)+12)%12; }
        pinta(); },
      syncCarpeta: () => Sync.elegirCarpeta().then(() => toast('Vigilando ' + Sync.estado.carpeta)).catch(err => alert(err.message)),
      syncReanudar: () => Sync.reanudar().catch(err => alert(err.message)),
      syncDetener: () => Sync.detener(),
      syncEscanear: () => Sync.escanear().then(() => toast('Barrido hecho')),
      syncArchivo: () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.csv,.tsv,.txt'; i.multiple = true;
        i.onchange = () => [...i.files].forEach(f => f.text().then(tx => reporta(Sync.importarTexto(tx, {etiqueta:'📄 ' + f.name})))); i.click(); },
      syncPegar: () => { const ta = document.getElementById('pegado'); if(ta && ta.value.trim()) reporta(Sync.importarTexto(ta.value, {etiqueta:'📋 Pegado'})); },
      apiConectar: () => {
        const g = n => (document.querySelector(`[name="${n}"]`)||{}).value || '';
        const cfg = {entorno:g('tvEntorno'), usuario:g('tvUsuario'), password:g('tvPass'), cid:g('tvCid'), sec:g('tvSec')};
        Store.estado.sync.apiCfg = {entorno:cfg.entorno, usuario:cfg.usuario, cid:cfg.cid}; Store.guardar();
        Sync.apiLogin(cfg).then(c => toast('Conectado · ' + c.length + ' cuenta(s)')).catch(err => { Sync.API.error = err.message; pinta(); });
      },
      apiDesconectar: () => Sync.apiDetener(),
      tema: () => { Store.ajustes.tema = b.dataset.id; Tema.aplicar(b.dataset.id); Store.guardar(); },
      perfilFoto: () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = async () => { const f = i.files[0]; if(!f) return; const src = await Img.comprimir(f); Tema.guardaPerfil({foto: src}); }; i.click(); },
      perfilSinFoto: () => Tema.guardaPerfil({foto:null}),
      alertasConectar: () => { Alertas.conectar(); toast('Escuchando ' + Alertas.cfg().tema); },
      alertasDesconectar: () => { Alertas.desconectar(); Store.ajustes.alertas = Object.assign({}, Alertas.cfg(), {tema:''}); Store.guardar(); },
      alertasProbar: () => { Alertas.avisar('Prueba', 'Si esto llegó a tu teléfono, el puente funciona.'); toast('Aviso enviado'); },
      alertaTrade: () => { const al = (Store.estado.alertas||[]).find(x => x.id === id); if(!al || !al.datos) return; const d = al.datos;
        modalTrade(null, {direccion: (d.dir||'').toUpperCase() === 'SHORT' ? 'short' : 'long', entrada: d.entrada, sl: d.sl, tp: d.tp, contratos: d.contratos || 1,
          instrumento: Object.keys(INSTRUMENTOS).find(k => (d.sym||'').toUpperCase().startsWith(k)) || Store.ajustes.instrumento, condicion: d.condicion || '', condicionPDA: 'FVG 5m', estrategia: (Store.ajustes.estrategias||[])[0] || ''}); },
      fichaDescarga: () => Ficha.descarga(id).then(() => toast('Ficha guardada')),
      fichaComparte: () => Ficha.comparte(id).then(ok => { if(!ok){ Ficha.descarga(id); toast('Sin compartir nativo: se descargó la ficha'); } }),
      abreDia: () => { cerrar(); modalDia(id); },
      abrirPlataforma: () => window.open(id === 'tradovate' ? 'https://trader.tradovate.com/' : 'https://www.tradingview.com/chart/?symbol=CME_MINI%3AMNQ1!', '_blank'),
      tvOperar: () => { if(window.__npNativo){ try{ window.webkit.messageHandlers.np.postMessage({cmd:'trading'}); }catch(e){} } else window.open('https://www.tradingview.com/chart/?symbol=' + encodeURIComponent('CME_MINI:MNQ1!'), '_blank'); },
      exportarCompleto: () => Store.exportaCompleto().then(n => toast('Respaldo con ' + n + ' screenshots')),
      reporteDia: () => reporteDia(),
      mercadoRecarga: () => { Mercado.cache.ffT = 0; Mercado.cache.pxT = 0; Mercado.cargar(); },
      selAbrir: () => { selAbierto = !selAbierto; const p = document.querySelector('.selpanel'); if(p) p.hidden = !selAbierto; },
      plan5mas: () => { const P = Store.ajustes.plan5 || {}; Store.ajustes.plan5 = Object.assign({}, P, {cuentas: Math.min(50, (P.cuentas || 5) + 1)}); Store.guardar(); },
      plan5menos: () => { const P = Store.ajustes.plan5 || {}; Store.ajustes.plan5 = Object.assign({}, P, {cuentas: Math.max(1, (P.cuentas || 5) - 1)}); Store.guardar(); },
      nuevaEstrategia: () => { const n = prompt('Nombre de la estrategia nueva:'); if(n && n.trim()){ Store.ajustes.estrategias = (Store.ajustes.estrategias || []).concat([n.trim()]); Store.guardar(); toast('Estrategia añadida'); } },
      exportar: () => Store.exporta(),
      importar: () => importar(),
      exportarCsv: () => csv(),
      demo: () => { if(confirm('Cargo datos de ejemplo: una cuenta con 4 semanas de trades y una sesión de backtest. Se suman a lo que ya tengas.')) demo(); },
      borrarTodo: () => { if(confirm('Esto borra TODO: cuentas, trades, backtests y bitácora. ¿Seguro?')){ Store.borraTodo(); toast('Mesa limpia'); } }
    };
    if(F[acc]) F[acc]();
  });

  document.addEventListener('change', e => {
    const t = e.target;
    if(e.target.closest('.velo')) return;
    if(t.dataset.perfil){ Tema.guardaPerfil({[t.dataset.perfil]: t.value}); return; }
    if(t.dataset.alerta){ Store.ajustes.alertas = Object.assign({}, Alertas.cfg(), {[t.dataset.alerta]: t.dataset.alerta === 'telefono' ? t.value === '1' : t.value}); Store.guardar(); return; }
    if(t.dataset.ajuste === 'copiador'){ Store.ajustes.copiador = t.checked; Store.guardar(); return; }
    if(t.dataset.plan5){ Store.ajustes.plan5 = Object.assign({}, Store.ajustes.plan5 || {}, {[t.dataset.plan5]: +t.value}); Store.guardar(); return; }
    if(t.dataset.paso){ Store.ajustes.pasos = Object.assign({}, Store.ajustes.pasos || {}, {[t.dataset.paso]: t.checked}); Store.guardar(); return; }
    if(t.dataset.dia){ Store.guardaDia(Store.hoyISO(), {[t.dataset.dia]: t.value}); return; }
    if(t.dataset.rutina){ const d = Store.dia(); d.rutina[t.dataset.rutina] = t.checked; Store.guardar(); return; }
    if(t.dataset.ajuste){
      let v = t.type === 'number' ? +t.value : t.value;
      if(t.dataset.ajuste === 'evalFullPort') v = t.value === '1';
      if(t.dataset.ajuste === 'pararTrasGanada'){ Store.ajustes.pararTrasGanada = t.value === '1'; Store.guardar(); toast('Guardado'); return; }
      if(t.dataset.ajuste === 'riesgoPctCuentaPct'){ Store.ajustes.riesgoPctCuenta = (+t.value || 1) / 100; Store.guardar(); toast('Guardado'); return; }
      if(t.dataset.ajuste === 'estrategiasTxt'){ Store.ajustes.estrategias = t.value.split('\n').map(x => x.trim()).filter(Boolean); Store.guardar(); toast('Guardado'); return; }
      Store.ajustes[t.dataset.ajuste] = v; Store.guardar(); if(t.dataset.ajuste !== 'btEstrategia') toast('Guardado'); return;
    }
    if(t.dataset.acc === 'calCuenta'){ Store.ajustes.calCuenta = t.value; Store.guardar(); return; }
    if(t.dataset.fase){ const [f, k] = t.dataset.fase.split('.'); const F = Store.fases(); F[f][k] = +t.value; Store.ajustes.fases = F; Store.guardar(); toast('Guardado'); return; }
    if(t.dataset.selcta !== undefined){
      const S = Store.estado, id = t.dataset.selcta;
      let sel = Store.cuentasSel().map(c => c.id);
      if(id === '*') sel = t.checked ? S.cuentas.map(c => c.id) : [sel[0]].filter(Boolean);
      else if(t.checked){ if(!sel.includes(id)) sel.push(id); }
      else { sel = sel.filter(x => x !== id); if(!sel.length) sel = [id]; }
      Store.ajustes.seleccion = sel; Store.ajustes.cuentaActiva = sel[0]; selAbierto = true; Store.guardar(); return;
    }
  });
  document.addEventListener('input', e => {
    if(e.target.dataset.filtro){ Vistas._filtro.texto = e.target.value;
      clearTimeout(window._tf); window._tf = setTimeout(() => { pinta();
        const i = document.querySelector('[data-filtro]'); if(i){ i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 260); }
  });

  /* ================================================== MODAL · BATERÍA === */
  /* Diez celdas de energía. Cada trade real gasta una; las gastadas se ven
     verdes (ganada) o rojas (perdida) y arriba, en grande, el win rate de esas
     diez. Debajo del 40% (equilibrio a 1.5R) no se opera: se revisa. */
  function modalCargador(){
    const t = Store.tradesSel().slice().sort((a,b) => (a.fecha+(a.hora||'')) < (b.fecha+(b.hora||'')) ? -1 : 1);
    const ult = t.slice(-10);
    const usadas = t.length % 10;
    const g = ult.filter(x => Motor.neto(x) > 0).length, p = ult.filter(x => Motor.neto(x) < 0).length;
    const wr = (g + p) ? g / (g + p) : null;
    const minimo = 0.40;
    const bajo = wr !== null && ult.length >= 5 && wr < minimo;
    const A = Store.ajustes, hoyT = t.filter(x => x.fecha === Store.hoyISO());
    const gano = A.pararTrasGanada && hoyT.some(x => Motor.neto(x) > 0), tope = hoyT.length >= A.maxTradesDia;
    const celda = (x, i, usada) => `<div class="celda ${usada ? (x ? (Motor.neto(x) > 0 ? 'win' : Motor.neto(x) < 0 ? 'loss' : 'be') : '') : (i === usadas ? 'siguiente' : 'libre')}" style="animation-delay:${i*40}ms"
        ${!usada ? 'data-acc="dispara"' : (x ? 'data-acc="editaTrade" data-id="' + x.id + '"' : '')} title="${x ? (UI.fechaCorta(x.fecha) + ' ' + (x.hora||'') + ' · ' + masMenos(Motor.neto(x))) : 'celda ' + (i+1)}"><span>${i+1}</span></div>`;
    const cuerpo = `
      <div class="cargador">
        <div class="wr ${bajo ? 'down' : wr !== null && wr >= 0.7 ? 'up' : ''}">${wr === null ? '—' : pct(wr, 0)}<small>win rate · últimas ${ult.length || 10}</small></div>
        <div class="wr-min"><span class="eti">mínimo</span> <b>${pct(minimo,0)}</b> <span class="tenue mini">para no perder a 1.5R · ${g}G · ${p}P</span></div>
        <div class="bateria"><div class="celdas">${Array.from({length:10}, (_, i) => celda(i < usadas ? t[t.length - usadas + i] : null, i, i < usadas)).join('')}</div><div class="polo"></div></div>
        <div class="mini dim" style="text-align:center;margin-top:12px">${usadas ? `Batería ${Math.floor(t.length/10)+1} · ${usadas} de 10 celdas usadas · quedan ${10 - usadas}.` : 'Batería llena: 10 celdas.'} Toca la siguiente celda para registrar el trade.${bajo ? ' <b class="down">Estás debajo del 40%: antes de gastar otra, revisa qué regla estás rompiendo.</b>' : ''}</div>
        <div class="rm ${gano || tope ? 'down' : ''}"><span class="eti">risk management</span> ${A.maxTradesDia} trade${A.maxTradesDia > 1 ? 's' : ''}/día máx · if W get off the charts · ≤ ${((A.riesgoPctCuenta||0.01)*100).toFixed(0)}% por trade · máx ${A.maxContratos || 1} mini${gano ? ' — <b>hoy ya ganaste: fuera de las gráficas</b>' : tope ? ' — <b>hoy ya tomaste ' + hoyT.length + ': se acabó</b>' : ' — hoy llevas ' + hoyT.length}</div>
      </div>`;
    modal('Registrar trade', cuerpo, `<div class="crece"></div><button class="btn" data-cerrar>Cancelar</button><button class="btn acc" data-acc="dispara">Usar la celda ${usadas+1}</button>`, {ancho:720, sinFoco:true});
  }

  /* ==================================================== MODAL · TRADE === */
  /* Registro RÁPIDO: dirección, P&L, las 4 reglas como cuatro botones,
     screenshot (pegar / arrastrar / clic) y notas. Lo demás, plegado.   */
  function modalTrade(t, pre){
    const A = Store.ajustes;
    const nuevo = !t;
    const diaHoy = Store.dia();
    const d = Object.assign({
      modo: A.modo, cuentaId: (Store.cuentaActiva()||{}).id || null, sesionId: null,
      fecha: Store.hoyISO(), hora: new Date().toTimeString().slice(0,5), instrumento: A.instrumento,
      direccion:'long', contratos:1, entrada:'', sl:'', tp:'', salida:'', pnl:'', comision:0, r:null,
      condicion: diaHoy.condicion || '', condicionPDA: diaHoy.condicionPDA || '', condicionCumplida:true,
      tipo:'continuacion', confluencias:['equilibrio','fvg','killzone'], tpTipo:'interno', objetivo:'',
      resultado:'ganada', errores:[], notas:'', img:null
    }, t || {}, pre || {});
    let imgPendiente = null, imgQuitar = false;

    const R = [
      {id:'condicion',   n:'01', t:'Condición cumplida', s:'si esto → entonces aquello, escrita antes'},
      {id:'continuacion',n:'02', t:'Continuación',       s:'a favor de la sesión, no reversión'},
      {id:'equilibrio',  n:'03', t:'Equilibrio + FVG',   s:'dos confluencias, nunca una'},
      {id:'tpInterno',   n:'04', t:'TP interno',         s:'liquidez interna, tu pedazo'}
    ];
    const estadoRegla = {
      condicion: d.condicionCumplida !== false,
      continuacion: d.tipo === 'continuacion',
      equilibrio: (d.confluencias||[]).includes('equilibrio') && ((d.confluencias||[]).includes('fvg') || (d.confluencias||[]).includes('ifvg')),
      tpInterno: d.tpTipo === 'interno'
    };

    const cuerpo = `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="grid" style="grid-template-columns:1.2fr 1fr 1fr 1fr 1fr;gap:8px;align-items:end">
          <div class="dir2" data-campo="direccion">
            <button type="button" data-v="long" class="long ${d.direccion === 'long' ? 'on' : ''}">▲ LARGO</button>
            <button type="button" data-v="short" class="short ${d.direccion === 'short' ? 'on' : ''}">▼ CORTO</button></div>
          <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${h(d.fecha)}"></label>
          <label class="campo"><span>Hora</span><input type="time" name="hora" value="${h(d.hora)}"></label>
          <label class="campo"><span>Instrumento</span><select name="instrumento">${opciones(Object.keys(INSTRUMENTOS), d.instrumento)}</select></label>
          <label class="campo"><span>Contratos</span><input type="number" step="1" min="1" name="contratos" value="${d.contratos}"></label>
        </div>

        <div class="grid" style="grid-template-columns:1fr 1fr 1fr 1.2fr;gap:8px;align-items:end">
          <label class="campo"><span>Entrada</span><input type="number" step="any" name="entrada" value="${d.entrada ?? ''}" placeholder="opcional"></label>
          <label class="campo"><span>Salida</span><input type="number" step="any" name="salida" value="${d.salida ?? ''}" placeholder="opcional"></label>
          <label class="campo"><span>P&L ($) · o se calcula solo</span><input type="number" step="any" name="pnl" value="${d.pnl === null ? '' : d.pnl}" placeholder="+180"></label>
          <div><div class="eti">Resultado neto</div><div class="pnl-grande" id="pnlG">—</div></div>
        </div>

        <div class="fila" style="gap:8px">
          <label class="campo" style="flex:1"><span>Estrategia</span><select name="estrategia">${opciones([{v:'',t:'— sin estrategia —'}].concat((A.estrategias||[]).map(x => ({v:x,t:x}))), d.estrategia || (A.estrategias||[])[0] || '')}</select></label>
          <button type="button" class="btn chico" id="btnEstr" style="margin-top:14px">+ nueva</button>
        </div>
        <div>
          <div class="fila" style="margin-bottom:7px"><span class="eti">Las 4 reglas · toca las que cumpliste</span><div class="crece"></div><span class="mono" id="calif" style="font-size:12px"></span></div>
          <div class="reglas4">${R.map(r => `<div class="r4 ${estadoRegla[r.id] ? 'on' : ''}" data-regla="${r.id}"><div class="rn">${r.n}</div><div class="rt">${h(r.t)}</div><div class="rs">${h(r.s)}</div></div>`).join('')}</div>
        </div>

        <div class="grid" style="grid-template-columns:1.1fr 1fr;gap:10px">
          <div><div class="eti" style="margin-bottom:6px">Screenshot · pega con ⌘V, arrastra o haz clic</div>
            <div class="ss-zona" id="ssZona">${d.img ? 'cargando…' : 'Sin imagen todavía'}</div>
            <input type="file" accept="image/*" id="ssFile" style="display:none"></div>
          <label class="campo"><span>Notas</span><textarea name="notas" style="min-height:110px" placeholder="Qué viste, qué sentiste, qué harías igual">${h(d.notas)}</textarea></label>
        </div>

        <details class="mas"><summary>Más detalles · stop, R, condición escrita, confluencias, errores, cuenta</summary><div>
          <div class="grid g4" style="gap:8px">
            <label class="campo"><span>Stop</span><input type="number" step="any" name="sl" value="${d.sl ?? ''}"></label>
            <label class="campo"><span>Objetivo (precio)</span><input type="number" step="any" name="tp" value="${d.tp ?? ''}"></label>
            <label class="campo"><span>R múltiplo</span><input type="number" step="any" name="r" value="${d.r ?? ''}"></label>
            <label class="campo"><span>Comisiones ($)</span><input type="number" step="any" name="comision" value="${d.comision}"></label>
          </div>
          <div class="grid g2" style="gap:8px">
            <label class="campo"><span>PDA de la condición</span><select name="condicionPDA">${opciones(['', ...ESTRATEGIA.pdas], d.condicionPDA)}</select></label>
            <label class="campo"><span>Objetivo de liquidez</span><select name="objetivo">${opciones(['', ...ESTRATEGIA.liquidez], d.objetivo)}</select></label>
          </div>
          <label class="campo"><span>Condición escrita</span><textarea name="condicion" placeholder="Si rechaza el FVG de 5m en 20 145 → corto a mínimos de Asia">${h(d.condicion)}</textarea></label>
          <div><div class="eti" style="margin-bottom:6px">Confluencias</div><div class="fila" style="gap:6px">${ESTRATEGIA.confluencias.map(c =>
            `<label class="check ${d.confluencias.includes(c.id) ? 'on' : ''}"><input type="checkbox" name="conf" value="${c.id}" ${d.confluencias.includes(c.id) ? 'checked' : ''}>${h(c.txt)}</label>`).join('')}</div></div>
          <div><div class="eti" style="margin-bottom:6px">Errores</div><div class="fila" style="gap:6px">${ESTRATEGIA.errores.map(x =>
            `<label class="check ${d.errores.includes(x) ? 'on' : ''}" style="font-size:11.5px"><input type="checkbox" name="err" value="${h(x)}" ${d.errores.includes(x) ? 'checked' : ''}>${h(x)}</label>`).join('')}</div></div>
          <div class="fila">
            <div class="seg" data-campo="modo">
              <button type="button" data-v="real" class="${d.modo === 'real' ? 'on' : ''}">Real</button>
              <button type="button" data-v="backtest" class="${d.modo === 'backtest' ? 'on' : ''}">Backtest</button></div>
            <label class="campo" style="min-width:220px"><span>${d.modo === 'backtest' ? 'Sesión' : 'Cuenta'}</span>
              <select name="destino">${d.modo === 'backtest'
                ? opciones([{v:'', t:'— sin sesión —'}].concat(Store.estado.sesiones.map(s => ({v:s.id, t:s.nombre}))), d.sesionId || '')
                : opciones(Store.estado.cuentas.map(c => ({v:c.id, t:(c.alias||c.firma)})), d.cuentaId || '')}</select></label>
          </div>
        </div></details>
      </div>`;

    const pie = `${t ? '<button class="btn mal chico" id="btnBorra">Borrar</button><button class="btn chico" data-acc="pdfTrade" data-id="' + t.id + '">⤓ PDF</button>' : ''}
      <div class="crece"></div><button class="btn" data-cerrar>Cancelar</button>
      <button class="btn acc" id="btnGuarda">${nuevo ? 'Registrar' : 'Guardar'}</button>`;

    const v = modal(nuevo ? 'Registrar trade' : 'Trade del ' + fechaLarga(d.fecha), cuerpo, pie, {ancho:860, sinFoco:true});
    const q = s => v.querySelector(s);
    const form = v.querySelector('.mb');
    const zona = q('#ssZona');

    function lee(){
      const g = n => { const el = form.querySelector(`[name="${n}"]`); return el ? el.value : ''; };
      const conf = [...form.querySelectorAll('[name="conf"]:checked')].map(x => x.value);
      if(estadoRegla.equilibrio){ if(!conf.includes('equilibrio')) conf.push('equilibrio'); if(!conf.includes('fvg') && !conf.includes('ifvg')) conf.push('fvg'); }
      else { const i1 = conf.indexOf('equilibrio'); if(i1 >= 0) conf.splice(i1, 1); }
      let condicion = g('condicion');
      if(estadoRegla.condicion && !condicion.trim()) condicion = Store.dia(g('fecha')).condicion || 'Condición del día cumplida';
      return {
        modo: d.modo, sesionId: d.modo === 'backtest' ? (g('destino') || null) : null,
        cuentaId: d.modo === 'real' ? (g('destino') || null) : null,
        fecha: g('fecha'), hora: g('hora'), instrumento: g('instrumento'),
        direccion: d.direccion, contratos: +g('contratos') || 1,
        entrada: g('entrada') === '' ? null : +g('entrada'), sl: g('sl') === '' ? null : +g('sl'),
        tp: g('tp') === '' ? null : +g('tp'), salida: g('salida') === '' ? null : +g('salida'),
        pnl: +g('pnl') || 0, comision: +g('comision') || 0, r: g('r') === '' ? null : +g('r'),
        condicion, condicionPDA: g('condicionPDA'), condicionCumplida: estadoRegla.condicion,
        tipo: estadoRegla.continuacion ? 'continuacion' : 'reversion', tpTipo: estadoRegla.tpInterno ? 'interno' : 'externo',
        objetivo: g('objetivo'), confluencias: conf,
        errores: [...form.querySelectorAll('[name="err"]:checked')].map(x => x.value),
        notas: g('notas'), porCalificar: false, estrategia: g('estrategia')
      };
    }
    q('#btnEstr').addEventListener('click', () => {
      const n = prompt('Nombre de la estrategia nueva:'); if(!n || !n.trim()) return;
      A.estrategias = (A.estrategias || []).concat([n.trim()]); Store.guardar();
      const sel = form.querySelector('[name="estrategia"]'); sel.insertAdjacentHTML('beforeend', `<option value="${h(n.trim())}" selected>${h(n.trim())}</option>`);
    });
    function auto(){
      const x = lee();
      const inst = INSTRUMENTOS[x.instrumento] || INSTRUMENTOS.MNQ;
      const dir = x.direccion === 'long' ? 1 : -1;
      if(x.entrada != null && x.salida != null){
        const pts = (x.salida - x.entrada) * dir;
        form.querySelector('[name="pnl"]').value = Math.round(pts * inst.puntoUSD * x.contratos * 100) / 100;
        if(!x.comision) form.querySelector('[name="comision"]').value = (inst.comision * x.contratos).toFixed(2);
        if(x.sl != null && Math.abs(x.entrada - x.sl) > 0) form.querySelector('[name="r"]').value = (pts / Math.abs(x.entrada - x.sl)).toFixed(2);
      }
      const y = lee(); const n = y.pnl - y.comision; const a = Motor.adherencia(y);
      q('#pnlG').innerHTML = `<span class="${signo(n)}">${masMenos(n)}</span>${y.r != null ? ` <span class="tenue" style="font-size:13px">${(+y.r).toFixed(2)}R</span>` : ''}`;
      q('#calif').innerHTML = `<span class="${a.limpio ? 'up' : a.puntos >= 75 ? 'acc' : 'down'}">${a.puntos}</span><span class="tenue">/100</span>`;
    }
    form.addEventListener('input', auto);
    form.addEventListener('change', e => { if(e.target.type === 'checkbox') e.target.closest('.check').classList.toggle('on', e.target.checked); auto(); });
    form.querySelectorAll('.r4').forEach(el => el.addEventListener('click', () => { const id = el.dataset.regla; estadoRegla[id] = !estadoRegla[id]; el.classList.toggle('on', estadoRegla[id]); auto(); }));
    form.querySelectorAll('[data-campo]').forEach(s => s.addEventListener('click', e => {
      const b2 = e.target.closest('[data-v]'); if(!b2) return;
      s.querySelectorAll('button').forEach(x => x.classList.remove('on')); b2.classList.add('on');
      d[s.dataset.campo] = b2.dataset.v;
      if(s.dataset.campo === 'modo'){ const x = lee(); cerrar(); modalTrade(t, Object.assign(x, {modo: b2.dataset.v})); return; }
      auto();
    }));
    auto();

    /* ---- screenshot */
    function muestra(src){ zona.innerHTML = src ? `<img src="${src}"><button type="button" class="btn chico mal quitar" id="ssQuitar">quitar</button>` : 'Sin imagen todavía';
      const bq = q('#ssQuitar'); if(bq) bq.addEventListener('click', e => { e.stopPropagation(); imgPendiente = null; imgQuitar = true; muestra(null); }); }
    async function tomaArchivo(f){ if(!f || !f.type.startsWith('image/')) return; imgPendiente = await Img.comprimir(f); imgQuitar = false; muestra(imgPendiente); }
    if(d.img && t) Img.get(t.id).then(src => muestra(src));
    zona.addEventListener('click', e => { if(e.target.tagName === 'IMG'){ const f = document.createElement('div'); f.className = 'ss-full'; f.innerHTML = `<img src="${e.target.src}">`; f.addEventListener('click', () => f.remove()); document.body.appendChild(f); return; } if(!e.target.closest('.quitar')) q('#ssFile').click(); });
    q('#ssFile').addEventListener('change', e => tomaArchivo(e.target.files[0]));
    zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('sobre'); });
    zona.addEventListener('dragleave', () => zona.classList.remove('sobre'));
    zona.addEventListener('drop', e => { e.preventDefault(); zona.classList.remove('sobre'); tomaArchivo(e.dataTransfer.files[0]); });
    const onPaste = e => { const it = [...(e.clipboardData||{}).items||[]].find(x => x.type.startsWith('image/')); if(it){ e.preventDefault(); tomaArchivo(it.getAsFile()); } };
    document.addEventListener('paste', onPaste);
    v.addEventListener('DOMNodeRemoved', ev2 => { if(ev2.target === v) document.removeEventListener('paste', onPaste); });

    q('#btnGuarda').addEventListener('click', async () => {
      const x = lee();
      const n = x.pnl - x.comision;
      x.resultado = n > 0 ? 'ganada' : n < 0 ? 'perdida' : 'be';
      let guardado;
      if(t){ guardado = Store.editaTrade(t.id, x); } else { guardado = Store.nuevoTrade(x); }
      if(imgPendiente){ await Img.put(guardado.id, imgPendiente); Store.editaTrade(guardado.id, {img: true}); }
      else if(imgQuitar && t){ await Img.del(t.id); Store.editaTrade(t.id, {img: null}); }
      document.removeEventListener('paste', onPaste);
      cerrar(); toast(t ? 'Trade actualizado' : Tema.voz(n > 0 ? 'trade.win' : n < 0 ? 'trade.loss' : 'trade.be', 'Registrado · ' + masMenos(n), masMenos(n)));
    });
    if(t) q('#btnBorra').addEventListener('click', () => { if(confirm('¿Borrar este trade?')){ Img.del(t.id); Store.borraTrade(t.id); document.removeEventListener('paste', onPaste); cerrar(); } });
  }

  /* ============================================== MODAL · FICHA DE TRADE === */
  /* La ficha es lo principal: se genera sola con los datos del trade.
     Desde aquí se edita, se descarga o se comparte.                      */
  function modalFichaTrade(id){
    const t = Store.estado.trades.find(x => x.id === id); if(!t) return;
    const n = Motor.neto(t), a = Motor.adherencia(t);
    const cuerpo = `<div class="fichaWrap">
      <div class="fila" style="margin-bottom:10px">
        <span class="chip ${n > 0 ? 'up' : n < 0 ? 'down' : ''}"><b></b>${masMenos(n)}</span>
        <span class="chip"><b></b>${a.puntos}/100</span>
        ${t.estrategia ? `<span class="chip"><b></b>${h(t.estrategia)}</span>` : ''}
        <div class="crece"></div>
        <button class="btn chico acc" data-acc="editaTradeForm" data-id="${id}">✎ Editar</button>
        <button class="btn chico" data-acc="fichaTradeDescarga" data-id="${id}">⤓ PNG</button>
        <button class="btn chico" data-acc="fichaTradeComparte" data-id="${id}">Compartir</button></div>
      <div id="fichaPreview" class="fichaPreview">${vacio('Generando la ficha…')}</div></div>`;
    const v = modal('Trade · ' + fechaLarga(t.fecha) + (t.hora ? ' · ' + t.hora : ''), cuerpo, `<div class="crece"></div><button class="btn" data-cerrar>Cerrar</button>`, {ancho:820, sinFoco:true});
    Ficha.dibujaTrade(id).then(src => { const el = v.querySelector('#fichaPreview'); if(el && src) el.innerHTML = `<img src="${src}" alt="ficha del trade">`; });
  }

  /* =================================================== MODAL · CUENTA === */
  function modalCuenta(c){
    const firmas = Object.keys(FIRMAS);
    const f0 = c ? c.firma : firmas[0];
    const planes = Object.keys(FIRMAS[f0] ? FIRMAS[f0].planes : {});
    const p0 = c ? c.plan : planes[0];
    const tam = Object.keys((FIRMAS[f0] && FIRMAS[f0].planes[p0] ? FIRMAS[f0].planes[p0].tamanos : {50000:{}}));
    const t0 = c ? c.tamano : tam[0];
    const r = c ? c.reglas : {};

    const cuerpo = `
      <div class="grid g3" style="gap:9px">
        <label class="campo"><span>Firma</span><select name="firma">${opciones(firmas, f0)}</select></label>
        <label class="campo"><span>Plan</span><select name="plan">${opciones(planes, p0)}</select></label>
        <label class="campo"><span>Tamaño</span><select name="tamano">${opciones(tam.map(x => ({v:x, t:(x/1000)+'k'})), t0)}</select></label>
      </div>
      <div class="mini tenue" id="notaPlan" style="margin:9px 0"></div>
      <div class="grid g4" style="gap:9px">
        <label class="campo"><span>Alias</span><input name="alias" value="${h(c ? c.alias : '')}" placeholder="Rapid 50k #1"></label>
        <label class="campo"><span>Balance inicial</span><input type="number" name="inicial" value="${c ? c.inicial : t0}"></label>
        <label class="campo"><span>Comprada</span><input type="date" name="comprada" value="${h(c ? c.comprada : Store.hoyISO())}"></label>
        <label class="campo"><span>Costo ($)</span><input type="number" name="costo" value="${c ? c.costo : 0}"></label>
        <label class="campo"><span>Fase</span><select name="fase">${opciones([{v:'eval',t:'Evaluación'},{v:'fondeada',t:'Fondeada'}], c ? c.fase : 'eval')}</select></label>
        <label class="campo"><span>Estado</span><select name="estado">${opciones([{v:'viva',t:'Viva'},{v:'pasada',t:'Pasada'},{v:'quemada',t:'Quemada'},{v:'concluida',t:'Concluida'}], c ? c.estado : 'viva')}</select></label>
      </div>
      <hr class="l">
      <div class="eti" style="margin-bottom:8px">Reglas del contrato · lo que escribas aquí manda sobre el catálogo</div>
      <div class="grid g4" style="gap:9px">
        <label class="campo"><span>Objetivo ($)</span><input type="number" name="target" value="${r.target ?? 3000}"></label>
        <label class="campo"><span>Pérdida diaria ($)</span><input type="number" name="dll" value="${r.dll ?? 0}"></label>
        <label class="campo"><span>Drawdown máx ($)</span><input type="number" name="maxDD" value="${r.maxDD ?? 2000}"></label>
        <label class="campo"><span>Tipo de drawdown</span><select name="ddTipo">${opciones([{v:'eod',t:'Trailing cierre de día'},{v:'intradia',t:'Trailing intradía'},{v:'estatico',t:'Estático'}], r.ddTipo || 'eod')}</select></label>
        <label class="campo"><span>Congela en inicial + ($)</span><input type="number" name="congelaEn" value="${r.congelaEn ?? 100}" placeholder="vacío = nunca congela"></label>
        <label class="campo"><span>Consistencia (0–1)</span><input type="number" step="0.05" name="consistencia" value="${r.consistencia ?? 0}"></label>
        <label class="campo"><span>Días mínimos</span><input type="number" name="minDias" value="${r.minDias ?? 0}"></label>
        <label class="campo"><span>Día válido ≥ ($)</span><input type="number" name="diaValido" value="${r.diaValido ?? 150}"></label>
        <label class="campo"><span>Reparto (0–1)</span><input type="number" step="0.05" name="split" value="${r.split ?? 0.9}"></label>
        <label class="campo"><span>Tope por retiro ($)</span><input type="number" name="capPayout" value="${r.capPayout ?? ''}"></label>
        <label class="campo"><span>Máx. retiros</span><input type="number" name="maxPayouts" value="${r.maxPayouts ?? ''}"></label>
        <label class="campo"><span>Buffer sobre inicial ($)</span><input type="number" name="buffer" value="${r.buffer ?? ''}" placeholder="auto"></label>
      </div>`;

    const v = modal(c ? 'Reglas de la cuenta' : 'Nueva cuenta', cuerpo,
      `<div class="crece"></div><button class="btn" data-cerrar>Cancelar</button><button class="btn acc" id="ok">${c ? 'Guardar' : 'Crear cuenta'}</button>`, {ancho:880});
    const form = v.querySelector('.mb');
    const g = n => form.querySelector(`[name="${n}"]`);

    function refrescaPlanes(){
      const f = FIRMAS[g('firma').value];
      g('plan').innerHTML = opciones(Object.keys(f.planes), Object.keys(f.planes)[0]);
      refrescaTam();
    }
    function refrescaTam(){
      const p = FIRMAS[g('firma').value].planes[g('plan').value];
      if(!p) return;
      const keys = Object.keys(p.tamanos);
      g('tamano').innerHTML = opciones(keys.map(x => ({v:x, t:(x/1000)+'k'})), keys.includes(g('tamano').value) ? g('tamano').value : keys[0]);
      aplicaPlan();
    }
    function aplicaPlan(){
      const f = FIRMAS[g('firma').value], p = f.planes[g('plan').value];
      const s = p.tamanos[g('tamano').value] || {};
      form.querySelector('#notaPlan').innerHTML = `<b class="acc">${h(f.fuente)}</b>${f.verificado ? ' · verificado ' + h(f.verificado) : ' · sin verificar'} — ${h(p.nota)}`;
      g('inicial').value = g('tamano').value;
      g('target').value = s.target ?? 0;
      g('dll').value = s.dll ?? 0;
      g('maxDD').value = s.maxDD ?? 0;
      g('ddTipo').value = p.ddTipo;
      g('congelaEn').value = p.congelaEn ?? '';
      g('consistencia').value = p.consistencia ?? 0;
      g('minDias').value = p.minDias ?? 0;
      g('diaValido').value = s.diaValido ?? 0;
      g('split').value = p.split ?? 0.9;
      g('capPayout').value = p.capPayout ? (p.capPayout[g('tamano').value] ?? '') : '';
      g('maxPayouts').value = p.maxPayouts ?? '';
      g('buffer').value = s.buffer ?? '';
      g('fase').value = p.fase === 'fondeada' ? 'fondeada' : 'eval';
    }
    g('firma').addEventListener('change', refrescaPlanes);
    g('plan').addEventListener('change', refrescaTam);
    g('tamano').addEventListener('change', aplicaPlan);
    if(!c) aplicaPlan(); else {
      const f = FIRMAS[c.firma], p = f && f.planes[c.plan];
      form.querySelector('#notaPlan').innerHTML = p ? `<b class="acc">${h(f.fuente)}</b> — ${h(p.nota)}` : 'Reglas escritas a mano.';
    }

    v.querySelector('#ok').addEventListener('click', () => {
      const num = n => g(n).value === '' ? null : +g(n).value;
      const datos = {
        firma: g('firma').value, plan: g('plan').value, tamano: +g('tamano').value,
        alias: g('alias').value, inicial: +g('inicial').value, comprada: g('comprada').value,
        costo: +g('costo').value || 0, fase: g('fase').value, estado: g('estado').value,
        reglas: {
          target: +g('target').value || 0, dll: +g('dll').value || 0, maxDD: +g('maxDD').value || 0,
          ddTipo: g('ddTipo').value, congelaEn: num('congelaEn'), consistencia: +g('consistencia').value || 0,
          minDias: +g('minDias').value || 0, diaValido: +g('diaValido').value || 0,
          split: +g('split').value || 0.9, capPayout: num('capPayout'), maxPayouts: num('maxPayouts'),
          buffer: num('buffer'),
          congelaEnObjetivo: (FIRMAS[g('firma').value].planes[g('plan').value]||{}).congelaEnObjetivo || false
        }
      };
      if(c){ Object.assign(c, datos); Store.guardar(); } else { const n = Store.nuevaCuenta(datos); Store.ajustes.cuentaActiva = n.id; Store.guardar(); }
      cerrar(); toast('Cuenta guardada');
    });
  }

  /* ================================================ MODAL · PROMOVER === */
  /* Pasar de evaluación a fondeada: la fondeada es una cuenta NUEVA que
     arranca en su balance inicial. La evaluación se archiva como pasada. */
  function modalPromover(c){
    const firma = FIRMAS[c.firma];
    if(!firma) return alert('Esta cuenta tiene reglas escritas a mano: crea la fondeada con "+ Nueva cuenta".');
    const fondeadas = Object.keys(firma.planes).filter(k => firma.planes[k].fase === 'fondeada');
    if(!fondeadas.length) return alert('El catálogo no tiene plan fondeado para ' + c.firma + '. Créala a mano con "+ Nueva cuenta".');
    const familia = c.plan.split(' ')[0];
    const sugerido = fondeadas.find(k => k.startsWith(familia)) || fondeadas[0];
    const cuerpo = `<p class="dim" style="margin:0 0 11px;font-size:12.6px">Pasaste <b>${h(c.alias || c.firma)}</b>
      con ${fmt(Motor.estadoCuenta(c).balance)}. La fondeada es una cuenta <b>nueva</b>: arranca otra vez en
      ${fmt(c.tamano)} y con sus propias reglas. La evaluación se archiva como pasada y sus trades se quedan en su historial.</p>
      <label class="campo"><span>Plan de la cuenta fondeada</span><select name="plan">${opciones(fondeadas, sugerido)}</select></label>
      <div class="mini tenue" id="nota" style="margin-top:9px"></div>
      <label class="campo" style="margin-top:11px"><span>Alias</span><input name="alias" value="${h((c.alias || c.firma) + ' · fondeada')}"></label>`;
    const v = modal('Pasar a fondeada', cuerpo,
      `<div class="crece"></div><button class="btn" data-cerrar>Cancelar</button><button class="btn acc" id="ok">Crear la fondeada</button>`);
    const g = n => v.querySelector(`[name="${n}"]`);
    const nota = () => {
      const p = firma.planes[g('plan').value];
      v.querySelector('#nota').innerHTML = `<b class="acc">${h(firma.fuente)}</b> — ${h(p.nota)}`;
    };
    g('plan').addEventListener('change', nota); nota();
    v.querySelector('#ok').addEventListener('click', () => {
      const p = firma.planes[g('plan').value];
      const s = p.tamanos[c.tamano] || p.tamanos[Object.keys(p.tamanos)[0]] || {};
      const nueva = Store.nuevaCuenta({
        firma: c.firma, plan: g('plan').value, tamano: c.tamano, inicial: c.tamano,
        alias: g('alias').value, fase:'fondeada', estado:'viva', comprada: Store.hoyISO(), costo:0,
        reglas:{ target: s.target || 0, dll: s.dll || 0, maxDD: s.maxDD || 0, ddTipo: p.ddTipo,
                 congelaEn: p.congelaEn ?? null, consistencia: p.consistencia || 0, minDias: p.minDias || 0,
                 diaValido: s.diaValido || 0, split: p.split || 0.9,
                 capPayout: p.capPayout ? (p.capPayout[c.tamano] ?? null) : null,
                 maxPayouts: p.maxPayouts ?? null, buffer: s.buffer ?? null,
                 congelaEnObjetivo: p.congelaEnObjetivo || false }
      });
      c.estado = 'pasada';
      Store.ajustes.cuentaActiva = nueva.id; Store.ajustes.calCuenta = nueva.id;   // el calendario se va con la fondeada
      Store.guardar(); cerrar(); toast('Fondeada creada · a construir el buffer');
    });
  }

  /* ================================================== MODAL · SESIÓN === */
  function modalSesion(){
    const cuerpo = `<div class="grid g2" style="gap:9px">
      <label class="campo"><span>Nombre</span><input name="nombre" placeholder="MNQ · septiembre · TP interno"></label>
      <label class="campo"><span>Variante que pruebas</span><input name="variante" placeholder="TP a liquidez interna vs externa"></label>
      <label class="campo"><span>Instrumento</span><select name="instrumento">${opciones(Object.keys(INSTRUMENTOS), Store.ajustes.instrumento)}</select></label>
      <label class="campo"><span>Desde</span><input type="date" name="desde"></label>
      <label class="campo"><span>Hasta</span><input type="date" name="hasta"></label>
      </div><label class="campo" style="margin-top:9px"><span>Notas</span><textarea name="notas" placeholder="Qué quieres responder con esta sesión"></textarea></label>`;
    const v = modal('Nueva sesión de backtest', cuerpo, `<div class="crece"></div><button class="btn" data-cerrar>Cancelar</button><button class="btn acc" id="ok">Crear</button>`);
    v.querySelector('#ok').addEventListener('click', () => {
      const g = n => v.querySelector(`[name="${n}"]`).value;
      Store.nuevaSesion({nombre: g('nombre') || 'Sesión', variante: g('variante'), instrumento: g('instrumento'),
        desde: g('desde'), hasta: g('hasta'), notas: g('notas')});
      cerrar(); toast('Sesión creada');
    });
  }

  /* ================================================== MODAL · PAYOUT === */
  function modalPayout(){
    const c = Store.cuentaActiva();
    const e = Motor.estadoCuenta(c);
    const cuerpo = `${e.bloqueoRetiro.length ? aviso('Con las reglas de tu contrato hoy <b>no</b> deberías poder cobrar: ' + e.bloqueoRetiro.map(h).join(' · ') + '. Regístralo igual si la firma te lo aprobó.') : ''}
      <div class="grid g3" style="gap:9px;margin-top:${e.bloqueoRetiro.length ? '11px' : '0'}">
      <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${Store.hoyISO()}"></label>
      <label class="campo"><span>Monto solicitado ($)</span><input type="number" name="monto" value="${Math.max(0, Math.round(e.retirable))}"></label>
      <label class="campo"><span>Estado</span><select name="estado">${opciones([{v:'solicitado',t:'Solicitado'},{v:'pagado',t:'Pagado'}], 'solicitado')}</select></label>
      </div><label class="campo" style="margin-top:9px"><span>Nota</span><input name="nota" placeholder="ciclo 1 · a Wise"></label>`;
    const v = modal('Registrar retiro', cuerpo, `<div class="crece"></div><button class="btn" data-cerrar>Cancelar</button><button class="btn acc" id="ok">Guardar</button>`);
    v.querySelector('#ok').addEventListener('click', () => {
      const g = n => v.querySelector(`[name="${n}"]`).value;
      Store.nuevoPayout({fecha: g('fecha'), monto: +g('monto') || 0, estado: g('estado'), nota: g('nota')});
      cerrar(); toast('Retiro registrado');
    });
  }

  /* ===================================================== MODAL · DÍA === */
  function modalDia(iso){
    const ts = Store.tradesCal().filter(t => t.fecha === iso);
    const d = Store.dia(iso);
    const pnl = ts.reduce((a,t) => a + Motor.neto(t), 0);
    const cuerpo = `
      <div class="fila" style="margin-bottom:11px">
        <span class="mono ${signo(pnl)}" style="font-size:20px">${masMenos(pnl)}</span>
        <span class="mini tenue">${ts.length} trades</span></div>
      <label class="campo"><span>Condición del día</span><input name="condicion" value="${h(d.condicion)}"></label>
      <div class="grid g2" style="gap:9px;margin-top:9px">
        <label class="campo"><span>Rama A</span><input name="ramaA" value="${h(d.ramaA)}"></label>
        <label class="campo"><span>Rama B</span><input name="ramaB" value="${h(d.ramaB)}"></label></div>
      <label class="campo" style="margin-top:9px"><span>Notas del día</span><textarea name="notas">${h(d.notas)}</textarea></label>
      <div style="margin-top:12px">${ts.length ? Vistas._tablaTrades(ts, true) : vacio('Sin trades este día')}</div>`;
    const futuro = iso >= Store.hoyISO();
    const sig = (() => { const f = new Date(iso + 'T12:00'); do { f.setDate(f.getDate() + 1); } while(f.getDay() === 0 || f.getDay() === 6); return f.toLocaleDateString('en-CA'); })();
    const fichaHtml = !futuro ? `<div class="fichaWrap" style="margin-bottom:14px">
        <div class="fila" style="margin-bottom:8px"><div class="eti">Ficha oficial del día</div><div class="crece"></div>
          <button class="btn chico acc" data-acc="fichaDescarga" data-id="${iso}">⤓ Descargar PNG</button>
          <button class="btn chico" data-acc="fichaComparte" data-id="${iso}">Compartir</button>
          <button class="btn chico" data-acc="abreDia" data-id="${sig}">Targets del ${UI.fechaCorta(sig)} →</button></div>
        <div id="fichaPreview" class="fichaPreview">${vacio('Dibujando la ficha…')}</div></div>` : '';
    const v = modal(fechaLarga(iso), (futuro ? `<div id="escDia" style="margin-bottom:14px">${vacio('Buscando los datos del día…')}</div>` : fichaHtml) + cuerpo,
      `<div class="crece"></div>${!futuro ? `<button class="btn" data-acc="abreDia" data-id="${sig}">Marcar targets del día siguiente →</button>` : ''}<button class="btn acc" id="ok">Guardar</button>`, {ancho:900});
    if(!futuro && window.Ficha){ Ficha.dibuja(iso).then(src => { const el = v.querySelector('#fichaPreview'); if(el) el.innerHTML = `<img src="${src}" alt="ficha">`; }); }
    v.querySelector('#ok').addEventListener('click', () => {
      const g = n => v.querySelector(`[name="${n}"]`).value;
      Store.guardaDia(iso, {condicion: g('condicion'), ramaA: g('ramaA'), ramaB: g('ramaB'), notas: g('notas')});
      cerrar(); toast('Día guardado');
    });
    if(futuro && window.Mercado){
      const A = Store.ajustes, F = Store.fases(), cc = Store.cuentaCal();
      const pr = (Vistas._proyeccion(iso, iso, cc) || {})[iso];
      const faseP = pr ? pr.fase : (cc && Motor.faseReal(Motor.estadoCuenta(cc)) === 'eval' ? 'eval' : 'fond');
      const tg = faseP === 'eval' ? F.eval : F.fond;
      Mercado.noticiasDe(iso).then(ns => {
        const el = v.querySelector('#escDia'); if(!el) return;
        const plan = `<div class="card" style="margin-bottom:8px"><div class="fila"><h3>Plan del día · ${cc ? h(cc.alias || cc.firma) : ''}</h3><span class="pill ${faseP === 'eval' ? 'acc' : 'ok'}">${faseP === 'eval' ? 'EVALUACIÓN' : 'FUNDED'}</span></div>
          <div class="grid g3" style="gap:8px;margin-top:10px">${kpi('Target del día', '+' + fmt(pr ? pr.pnl : tg.target), faseP === 'eval' ? '$1k/día = 3 días para pasar' : 'tu pedazo del pastel', 'mini')}${kpi('Daily loss', '-' + fmt(tg.loss), faseP === 'eval' ? 'en examen arriesgas el drawdown para pasar' : 'ya fondeado, corto y sin discusión', 'mini')}${kpi('Consistencia', cc && Store.consistenciaDe(cc) ? Math.round(Store.consistenciaDe(cc)*100) + '%' : '—', cc && Store.consistenciaDe(cc) ? (faseP === 'eval' ? 'ningún día más de ' + fmt(Store.consistenciaDe(cc) * (cc.reglas.target||0)) : 'mejor día ≤ ' + Math.round(Store.consistenciaDe(cc)*100) + '% de la ganancia al retirar') : 'sin regla', 'mini')}</div>
          ${pr && pr.hitos.length ? `<div style="margin-top:8px">${pr.hitos.map(x => `<span class="hito-cal ${x.tono}" style="display:inline-block;margin-right:6px">${h(x.t)}</span>`).join('')}</div>` : ''}
          <div class="mini dim" style="margin-top:8px">Condición escrita antes de la apertura · solo continuaciones · equilibrio + FVG · TP interno · ${A.pararTrasPerdidas} pérdidas = fin · ${A.maxTradesDia} trades máximo.</div></div>`;
        if(!ns.length){ el.innerHTML = plan + `<div class="card"><h3 class="up">Día limpio</h3><div class="sub">Sin datos USD de impacto alto o medio</div><div class="mini dim" style="margin-top:8px">No hay noticia que cruce la ventana: el escenario lo escribe el precio. Marca rangos, escribe las dos ramas de la condición y espera la apertura.</div></div>`; return; }
        el.innerHTML = plan + `<div class="card"><h3>Escenarios del día</h3><div class="sub">${ns.length} dato${ns.length > 1 ? 's' : ''} USD que mueven ES · NQ · BTC</div>
          <div style="margin-top:10px;display:flex;flex-direction:column;gap:10px">${ns.map(n => { const I = Mercado.info(n); const enVentana = (() => { const min = n.t.getHours()*60 + n.t.getMinutes(); const abre = Motor.aperturaNY(n.t); return min >= abre - 30 && min <= abre + 95; })();
            return `<div style="border:1px solid var(--linea);padding:10px 12px">
              <div class="fila"><b class="mono">${Mercado.horaLocal(n.t)}</b><b>${h(n.titulo)}</b><span class="pill ${n.impacto === 'High' ? 'no' : 'acc'}">${n.impacto === 'High' ? 'ALTO' : 'MEDIO'}</span>${enVentana ? '<span class="pill no">CRUZA TU VENTANA</span>' : ''}<div class="crece"></div><span class="mono mini tenue">previo ${h(n.prev||'—')} · pronóstico ${h(n.fc||'—')}</span></div>
              <div class="grid g2" style="gap:8px;margin-top:8px">
                <div class="nbox down"><div class="eti">Escenario A · sale más alto / mejor</div>${h(I.mejor)}</div>
                <div class="nbox up"><div class="eti">Escenario B · sale más bajo / peor</div>${h(I.peor)}</div></div>
              <div class="mini dim" style="margin-top:8px"><b>Cómo:</b> ${h(I.como)}${enVentana ? ' <b class="down">Este dato cae dentro de tu ventana NY AM: no entres 15 min antes ni 15 después.</b>' : ''}</div></div>`; }).join('')}</div></div>`;
      }).catch(() => { const el = v.querySelector('#escDia'); if(el) el.innerHTML = vacio('No se pudo leer Forex Factory (fuera de la semana o sin conexión).'); });
    }
  }

  function reporta(r){
    if(!r.ok){ alert(r.error); return; }
    toast(r.nuevos + ' trades nuevos · ' + r.dup + ' repetidos · ' + r.formato);
    if(r.nuevos){ vista = 'diario'; location.hash = 'diario'; pinta(); }
  }
  // arrastrar un CSV a la zona de la vista Sincronizar
  document.addEventListener('dragover', e => { const z = e.target.closest('#zona'); if(z){ e.preventDefault(); z.classList.add('sobre'); } });
  document.addEventListener('dragleave', e => { const z = e.target.closest('#zona'); if(z) z.classList.remove('sobre'); });
  document.addEventListener('drop', e => { const z = e.target.closest('#zona'); if(!z) return; e.preventDefault(); z.classList.remove('sobre');
    [...e.dataTransfer.files].forEach(f => f.text().then(tx => reporta(Sync.importarTexto(tx, {etiqueta:'📄 ' + f.name})))); });

  /* ------------------------------------------------------ importar / csv */
  function importar(){
    const i = document.createElement('input');
    i.type = 'file'; i.accept = '.json';
    i.onchange = () => { const f = i.files[0]; if(!f) return;
      const r = new FileReader();
      r.onload = () => { Store.importaCompleto(r.result).then(n => toast('Respaldo importado' + (n ? ' · ' + n + ' screenshots' : ''))).catch(e => alert(e.message)); };
      r.readAsText(f); };
    i.click();
  }
  /* Reporte del día en Markdown: para Drive, Notion o el grupo */
  function reporteDia(){
    const iso = Store.hoyISO(), ts = Store.tradesSel().filter(t => t.fecha === iso), d = Store.dia(iso), m = Stats.metricas(ts);
    const cta = Store.cuentaActiva(), est = cta ? Motor.estadoCuenta(cta) : null;
    const md = ['# NORTHPOINT · ' + UI.fechaLarga(iso), '', '**Cuenta:** ' + (cta ? (cta.alias||cta.firma) + ' · balance ' + fmt(est.balance) + ' · colchón ' + fmt(est.colchon) : '—'),
      '**Condición del día:** ' + (d.condicion || '—'), d.ramaA ? '- A: ' + d.ramaA : '', d.ramaB ? '- B: ' + d.ramaB : '', d.activada && d.activada !== '—' ? '- Se activó: ' + d.activada : '', '',
      '## Resultado', '- P&L: ' + masMenos(m.pnl) + ' en ' + m.n + ' trades · win ' + pct(m.winRate,0) + ' · disciplina ' + m.adherencia.toFixed(0) + '/100', '',
      '## Trades', '| hora | dir | estrategia | R | P&L | reglas | errores |', '|---|---|---|---|---|---|---|',
      ...ts.map(t => `| ${t.hora||''} | ${t.direccion === 'long' ? 'LARGO' : 'CORTO'} | ${t.estrategia||''} | ${t.r != null ? (+t.r).toFixed(2) : ''} | ${masMenos(Motor.neto(t))} | ${Motor.adherencia(t).puntos} | ${(t.errores||[]).join(', ')} |`),
      '', '## Notas', d.notas || '', ...ts.filter(t => t.notas).map(t => '- ' + t.hora + ': ' + t.notas)].filter(x => x !== null).join('\n');
    const bl = new Blob([md], {type:'text/markdown'}); const el = document.createElement('a'); el.href = URL.createObjectURL(bl); el.download = 'northpoint-' + iso + '.md'; el.click();
  }
  function csv(){
    const t = Store.estado.trades;
    const cols = ['fecha','hora','modo','instrumento','direccion','contratos','entrada','sl','tp','salida','pnl','comision','r','estrategia','tipo','tpTipo','condicionPDA','condicion','objetivo','confluencias','errores','resultado','notas'];
    const filas = [cols.join(',')].concat(t.map(x => cols.map(c => {
      let v = x[c]; if(Array.isArray(v)) v = v.join(' | ');
      return '"' + String(v == null ? '' : v).replace(/"/g,'""') + '"';
    }).join(',')));
    const b = new Blob([filas.join('\n')], {type:'text/csv'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'northpoint-trades.csv'; a.click();
  }

  /* ------------------------------------------------------------ ejemplo */
  /* Generador con semilla: el ejemplo siempre cuenta la misma historia —
     cumplir las 4 reglas gana mucho más que romperlas. */
  function rnd(semilla){ let x = semilla; return () => (x = (x*1664525 + 1013904223) % 4294967296) / 4294967296; }

  function demo(){
    const R = rnd(20260906);
    const p = FIRMAS['FundedNext Futures'].planes['Rapid Daily · Challenge'];
    const s = p.tamanos[50000];
    const c = Store.nuevaCuenta({
      firma:'FundedNext Futures', plan:'Rapid Daily · Challenge', tamano:50000, inicial:50000,
      alias:'Ejemplo · Rapid 50k', fase:'eval', costo:155,
      reglas:{target:s.target, dll:s.dll, maxDD:s.maxDD, ddTipo:p.ddTipo, congelaEn:p.congelaEn,
              consistencia:p.consistencia, minDias:p.minDias, diaValido:0, split:p.split,
              capPayout:null, maxPayouts:null, buffer:null}
    });
    Store.ajustes.cuentaActiva = c.id;

    function trade(base){
      const limpio = base.limpio;
      const gana = R() < (limpio ? 0.85 : 0.40);
      const rr = gana ? (limpio ? 0.7 + R()*0.9 : 0.9 + R()*1.4) : -1;
      const t = Object.assign({
        id: Store.id(), sesionId:null, cuentaId:null, instrumento:'MNQ',
        direccion: R() < .5 ? 'long' : 'short', contratos:3,
        entrada:null, sl:null, tp:null, salida:null,
        r: Math.round(rr*100)/100,
        condicion: R() < .5 ? 'Si rechaza el FVG de 5m en 20 145 → corto a mínimos de Asia'
                            : 'Si invierte el FVG de 5m → largo a PDH',
        condicionPDA:'FVG 5m', condicionCumplida:true,
        estrategia: R() < .6 ? 'Condición + Equilibrio + FVG' : (R() < .5 ? 'iFVG en equilibrio' : 'ORB'),
        tipo: limpio ? 'continuacion' : (R() < .45 ? 'reversion' : 'continuacion'),
        confluencias: limpio ? ['equilibrio','fvg','killzone','liquidez']
                             : (R() < .5 ? ['fvg','killzone'] : ['equilibrio','killzone']),
        tpTipo: limpio ? 'interno' : (R() < .65 ? 'externo' : 'interno'),
        objetivo: R() < .5 ? 'Swing interno' : 'Asia low',
        resultado: gana ? 'ganada' : 'perdida',
        errores: limpio ? [] : [ESTRATEGIA.errores[Math.floor(R()*ESTRATEGIA.errores.length)]],
        notas:'', img:null, creado:new Date().toISOString()
      }, base);
      delete t.limpio;
      return t;
    }

    const hoy = new Date();
    let n = 0;
    for(let d = 26; d >= 0; d--){
      const f = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - d);
      if(f.getDay() === 0 || f.getDay() === 6) continue;
      const iso = f.toLocaleDateString('en-CA');
      Store.estado.dias[iso] = {condicion:'FVG de 5m 20 145 – 20 160', ramaA:'rechazo → corto a Asia low (20 040)',
        ramaB:'iFVG → largo a PDH (20 310)', activada: R() < .5 ? 'A' : 'B', notas:'', animo:'', cerrado:true, rutina:{}};
      const cuantos = R() < 0.42 ? 2 : 1;
      for(let k = 0; k < cuantos; k++){
        const riesgo = 120 + Math.round(R()*70);
        const t = trade({limpio: R() < 0.70, modo:'real', cuentaId:c.id, fecha:iso,
          hora: (7 + (k ? 1 : 0)) + ':' + String(31 + Math.floor(R()*28)).padStart(2,'0'), comision:3.72});
        t.pnl = Math.round(t.r * riesgo);
        Store.estado.trades.push(t); n++;
      }
    }

    const ses = Store.nuevaSesion({nombre:'MNQ · agosto · condición 5m', variante:'TP interno vs externo',
      instrumento:'MNQ', desde:'2026-08-01', hasta:'2026-08-29',
      notas:'¿El TP a liquidez interna gana más veces que ir por la externa?'});
    for(let i = 0; i < 62; i++){
      const f = new Date(2026, 7, 1 + Math.floor(i/3));
      const t = trade({limpio: R() < 0.66, modo:'backtest', sesionId:ses.id, cuentaId:null,
        fecha: f.toLocaleDateString('en-CA'), hora:'7:' + String(32 + Math.floor(R()*26)).padStart(2,'0'), comision:3.72});
      t.pnl = Math.round(t.r * 150);
      Store.estado.trades.push(t);
    }

    Store.guardar(); toast(n + ' trades reales + 62 de backtest cargados');
  }

  pinta();
})();
