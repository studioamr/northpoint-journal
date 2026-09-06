/* ============================================================================
   MESA — estado y persistencia
   Todo vive en localStorage del navegador. Nada sale de tu máquina.
   Exporta/importa a JSON para respaldo y para pasar de un dispositivo a otro.
   ========================================================================= */
(function(){
  const LLAVE = 'mesa.v1';

  const VACIO = {
    v: 1,
    creado: null,
    ajustes: {
      nombre: 'André',
      instrumento: 'MNQ',
      slPuntos: 20,           // stop típico en puntos, para calcular contratos
      metaDiaria: 250,        // "tu pedazo del pastel": con esto el día ya está ganado
      metaMaxDia: 500,        // techo: llegando aquí se cierra la plataforma
      perdidaMaxDia: 500,     // un día de -$1,000 es el que te quita la cuenta al siguiente
      evalFullPort: true,     // en evaluación: contratos máximos, pasar lo más rápido posible
      maxTradesDia: 2,        // risk management: 1–2 trades por día
      pararTrasPerdidas: 2,   // dos perdidas seguidas y se acabó el día
      pararTrasGanada: true,  // if W → get off the charts
      riesgoPctCuenta: 0.01,  // nunca más del 1% de la cuenta por trade
      maxContratos: 1,        // máximo 1 mini
      riesgoEvalPct: 0.5,     // fracción del colchón que arriesgas por día en evaluación
      riesgoFondPct: 0.25,    // fracción del colchón por día ya fondeado
      reduceTrasPerdida: 0.5, // tamaño del siguiente trade después de perder
      stopsMinimos: 3,        // colchón mínimo en stops para operar tamaño normal
      estrategias: ['Condición + Equilibrio + FVG', 'iFVG en equilibrio', 'ORB'],   // nombres de tus estrategias; el rendimiento de cada una sale en el Panel
      cuentaActiva: null,
      seleccion: [],          // ids de cuentas a ver a la vez; vacío = la activa
      calCuenta: null,        // el calendario ve UNA cuenta a la vez
      fases: { eval:{target:1000, loss:2000, consistencia:0.40}, fond:{target:200, loss:500, consistencia:0.40} },   // target y daily loss por fase · eval: $1k/día = 3 días para pasar
      modo: 'real'            // real | backtest
    },
    cuentas: [],
    trades: [],
    sesiones: [],   // sesiones de backtesting
    dias: {},       // 'YYYY-MM-DD' -> { condicion, rama, plan, notas, animo, cerrado, rutina:{} }
    payouts: [],
    sync: { archivos:{}, log:[], ultimo:null, apiCfg:{entorno:'live', usuario:'', cid:'', cuentaTv:''} }
  };

  let S = null;

  function clona(o){ return JSON.parse(JSON.stringify(o)); }
  function id(){ return Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4); }

  function cargar(){
    try{
      const crudo = localStorage.getItem(LLAVE);
      S = crudo ? Object.assign(clona(VACIO), JSON.parse(crudo)) : clona(VACIO);
      S.ajustes = Object.assign(clona(VACIO.ajustes), S.ajustes || {});
      S.sync = Object.assign(clona(VACIO.sync), S.sync || {});
    }catch(e){
      console.warn('MESA: estado corrupto, empiezo limpio', e);
      S = clona(VACIO);
    }
    if(!S.creado){ S.creado = new Date().toISOString(); }
    // migración única: risk management dictado (1–2 trades/día)
    if(!S.ajustes._rm1){ if(S.ajustes.maxTradesDia > 2) S.ajustes.maxTradesDia = 2; S.ajustes._rm1 = true; }
    if(!S.ajustes._tp1100){ if(S.ajustes.fases && S.ajustes.fases.eval && S.ajustes.fases.eval.target === 1000) S.ajustes.fases.eval.target = 1100; S.ajustes._tp1100 = true; }   // 6-sep-2026: eval = riesgo 2,000 para 1,100 de TP
    return S;
  }

  function guardar(){
    try{ localStorage.setItem(LLAVE, JSON.stringify(S)); }
    catch(e){ alert('No se pudo guardar (¿espacio lleno?). Exporta un respaldo.'); }
    document.dispatchEvent(new CustomEvent('mesa:cambio'));
  }

  /* ------------------------------------------------------------- utilidades */
  const hoyISO = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

  /* ------------------------------------------------------------------ CRUD */
  const API = {
    get estado(){ return S; },
    get ajustes(){ return S.ajustes; },
    hoyISO, id, guardar,

    cuentaActiva(){
      const sel = API.cuentasSel();
      if(sel.length) return sel[0];
      return S.cuentas.find(c => c.id === S.ajustes.cuentaActiva)
          || S.cuentas.find(c => c.estado === 'viva')
          || S.cuentas[0] || null;
    },
    /* cuentas que se están viendo: las marcadas, o la activa */
    cuentasSel(){
      const ids = (S.ajustes.seleccion || []).filter(id => S.cuentas.some(c => c.id === id));
      if(ids.length) return ids.map(id => S.cuentas.find(c => c.id === id));
      const a = S.cuentas.find(c => c.id === S.ajustes.cuentaActiva) || S.cuentas.find(c => c.estado === 'viva') || S.cuentas[0];
      return a ? [a] : [];
    },
    cuentaCal(){ return API.cuentaActiva(); },   // el calendario sigue a la cuenta de la cabecera (el selector propio se quitó)
    tradesCal(){ const c = API.cuentaCal(); return c ? API.tradesReales(c.id) : []; },
    fases(){ const base = {eval:{target:1100, loss:2000, consistencia:0.40}, fond:{target:200, loss:500, consistencia:0.40}}; const a = API.ajustes.fases || {};
      const f = {eval: Object.assign({}, base.eval, a.eval || {}), fond: Object.assign({}, base.fond, a.fond || {})}; if(f.eval.target === 1100) f.eval.target = 1000; return f; },
    /* consistencia efectiva de una cuenta: la de su contrato si la tiene; si no, la de la fase en Ajustes */
    consistenciaDe(c){ const r = c.reglas || {}; if(r.consistencia > 0) return r.consistencia; const f = API.fases(); return (c.fase === 'eval' ? f.eval.consistencia : f.fond.consistencia) || 0; },
    tradesSel(){ const ids = new Set(API.cuentasSel().map(c => c.id)); return S.trades.filter(t => t.modo === 'real' && ids.has(t.cuentaId)); },
    cuenta(cid){ return S.cuentas.find(c => c.id === cid) || null; },

    nuevaCuenta(datos){
      const c = Object.assign({
        id: id(), alias:'', firma:'', plan:'', tamano:50000, inicial:50000,
        fase:'eval', estado:'viva', comprada: hoyISO(), costo:0,
        reglas:{ target:3000, dll:0, maxDD:2000, ddTipo:'eod', congelaEn:100,
                 consistencia:0, minDias:0, split:0.9, diaValido:150,
                 capPayout:null, maxPayouts:null, buffer:null },
        notas:''
      }, datos||{});
      S.cuentas.push(c);
      if(!S.ajustes.cuentaActiva) S.ajustes.cuentaActiva = c.id;
      guardar(); return c;
    },
    borraCuenta(cid){
      S.cuentas = S.cuentas.filter(c => c.id !== cid);
      S.trades  = S.trades.filter(t => t.cuentaId !== cid);
      S.payouts = S.payouts.filter(p => p.cuentaId !== cid);
      if(S.ajustes.cuentaActiva === cid) S.ajustes.cuentaActiva = (S.cuentas[0]||{}).id || null;
      guardar();
    },

    /* --------------------------------------------------------------- trades */
    nuevoTrade(datos){
      const t = Object.assign({
        id: id(), modo:'real', cuentaId: (API.cuentaActiva()||{}).id || null, sesionId:null,
        fecha: hoyISO(), hora:'', instrumento: S.ajustes.instrumento,
        direccion:'long', contratos:1,
        entrada:null, sl:null, tp:null, salida:null,
        pnl:0, comision:0, r:null,
        estrategia:'', condicion:'', condicionPDA:'', condicionCumplida:true,
        tipo:'continuacion', confluencias:[], tpTipo:'interno', objetivo:'',
        resultado:'ganada', errores:[], notas:'', img:null,
        creado: new Date().toISOString()
      }, datos||{});
      S.trades.push(t); guardar(); return t;
    },
    editaTrade(tid, campos){
      const t = S.trades.find(x => x.id === tid);
      if(t){ Object.assign(t, campos); guardar(); }
      return t;
    },
    borraTrade(tid){ S.trades = S.trades.filter(t => t.id !== tid); guardar(); },

    tradesDe(cuentaId, modo){
      return S.trades.filter(t => (modo ? t.modo === modo : true) &&
                                  (cuentaId ? t.cuentaId === cuentaId : true));
    },
    tradesReales(cuentaId){ return API.tradesDe(cuentaId, 'real'); },

    /* ------------------------------------------------------ día / bitácora */
    dia(fecha){
      const f = fecha || hoyISO();
      if(!S.dias[f]) S.dias[f] = { condicion:'', ramaA:'', ramaB:'', activada:'', notas:'', animo:'', cerrado:false, rutina:{} };
      return S.dias[f];
    },
    guardaDia(fecha, campos){ Object.assign(API.dia(fecha), campos); guardar(); },

    /* ------------------------------------------------------------ backtest */
    nuevaSesion(datos){
      const s = Object.assign({
        id:id(), nombre:'Sesión '+(S.sesiones.length+1), instrumento:S.ajustes.instrumento,
        variante:'', desde:'', hasta:'', notas:'', creada:new Date().toISOString()
      }, datos||{});
      S.sesiones.push(s); guardar(); return s;
    },
    borraSesion(sid){
      S.sesiones = S.sesiones.filter(s => s.id !== sid);
      S.trades = S.trades.filter(t => t.sesionId !== sid);
      guardar();
    },

    /* ------------------------------------------------------------- payouts */
    nuevoPayout(datos){
      const p = Object.assign({ id:id(), cuentaId:(API.cuentaActiva()||{}).id||null,
        fecha:hoyISO(), monto:0, estado:'solicitado', nota:'' }, datos||{});
      S.payouts.push(p); guardar(); return p;
    },
    borraPayout(pid){ S.payouts = S.payouts.filter(p => p.id !== pid); guardar(); },
    payoutsDe(cid){ return S.payouts.filter(p => p.cuentaId === cid); },

    /* ------------------------------------------------------ respaldo total */
    exporta(){
      const blob = new Blob([JSON.stringify(S, null, 2)], {type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'northpoint-' + hoyISO() + '.json';
      a.click(); URL.revokeObjectURL(a.href);
    },
    importa(texto){
      const datos = JSON.parse(texto);
      if(!datos || !Array.isArray(datos.trades)) throw new Error('Ese archivo no es un respaldo de NORTHPOINT.');
      S = Object.assign(clona(VACIO), datos);
      S.ajustes = Object.assign(clona(VACIO.ajustes), datos.ajustes||{});
      guardar();
    },
    /* respaldo COMPLETO: estado + screenshots (IndexedDB) en un solo JSON */
    async exportaCompleto(){
      const imgs = {};
      for(const t of S.trades.filter(t => t.img)){ const d = await Img.get(t.id); if(d) imgs[t.id] = d; }
      const blob = new Blob([JSON.stringify({__np:1, estado:S, imagenes:imgs}, null, 0)], {type:'application/json'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'northpoint-completo-' + hoyISO() + '.json'; a.click(); URL.revokeObjectURL(a.href);
      return Object.keys(imgs).length;
    },
    async importaCompleto(texto){
      const d = JSON.parse(texto);
      if(d && d.__np && d.estado){ for(const [id, src] of Object.entries(d.imagenes || {})) await Img.put(id, src); API.importa(JSON.stringify(d.estado)); return Object.keys(d.imagenes||{}).length; }
      API.importa(texto); return 0;
    },
    borraTodo(){ S = clona(VACIO); S.creado = new Date().toISOString(); guardar(); }
  };

  window.Store = API;
  cargar();
})();
