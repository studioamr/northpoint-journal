/* ============================================================================
   MESA — importación automática de trades (Tradovate CSV, portapapeles,
   carpeta vigilada y conector API). Cero captura manual de números.
   ----------------------------------------------------------------------------
   Formatos que entiende:
   · Tradovate → Reports → Performance (CSV): ya viene en trades cerrados
     (symbol, qty, buyPrice, sellPrice, pnl, boughtTimestamp, soldTimestamp).
   · Tradovate → Reports → Orders / Fills (CSV): ejecuciones sueltas; se
     emparejan en posiciones (abre → queda plano) por contrato, FIFO.
   · Cualquier CSV/TSV con columnas reconocibles (fecha, símbolo, lado, cantidad,
     precio, pnl). Si no se entiende, se dice cuáles columnas faltan.
   ========================================================================= */
(function(){

  /* ------------------------------------------------------------- parser */
  function parseCSV(texto){
    const sep = (texto.split('\n')[0].match(/\t/g)||[]).length > (texto.split('\n')[0].match(/,/g)||[]).length ? '\t' : ',';
    const filas = []; let fila = [], campo = '', q = false;
    for(let i = 0; i < texto.length; i++){
      const ch = texto[i];
      if(q){
        if(ch === '"'){ if(texto[i+1] === '"'){ campo += '"'; i++; } else q = false; }
        else campo += ch;
      }else{
        if(ch === '"') q = true;
        else if(ch === sep){ fila.push(campo); campo = ''; }
        else if(ch === '\n' || ch === '\r'){ if(ch === '\r' && texto[i+1] === '\n') i++; fila.push(campo); filas.push(fila); fila = []; campo = ''; }
        else campo += ch;
      }
    }
    if(campo !== '' || fila.length){ fila.push(campo); filas.push(fila); }
    const limpias = filas.filter(f => f.some(c => c.trim() !== ''));
    if(limpias.length < 2) return {cab:[], regs:[]};
    const cab = limpias[0].map(c => c.trim());
    const regs = limpias.slice(1).map(f => { const o = {}; cab.forEach((c,i) => o[c] = (f[i]||'').trim()); return o; });
    return {cab, regs};
  }

  const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  function col(cab, ...cands){
    const n = cab.map(norm);
    for(const c of cands){ const i = n.indexOf(norm(c)); if(i >= 0) return cab[i]; }
    for(const c of cands){ const i = n.findIndex(x => x.includes(norm(c))); if(i >= 0) return cab[i]; }
    return null;
  }

  function num(v){
    if(v === null || v === undefined) return null;
    let s = String(v).trim(); if(!s) return null;
    s = s.replace(/[$€£¥\s]/g, '');                       // la moneda va ANTES del paréntesis: Tradovate escribe "$(70.00)"
    const neg = /^\(.*\)$/.test(s) || /-/.test(s);        // paréntesis = número negativo (formato contable)
    s = s.replace(/[(),]/g, '').replace(/-/g, '');
    const n = parseFloat(s); if(isNaN(n)) return null;
    return neg ? -n : n;
  }
  function fecha(v){
    if(!v) return null;
    let d = new Date(v);
    if(isNaN(d)){ const m = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})[ T]*(\d{1,2})?:?(\d{2})?:?(\d{2})?/);
      if(m){ const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; d = new Date(y, +m[1]-1, +m[2], +(m[4]||0), +(m[5]||0), +(m[6]||0)); } }
    return isNaN(d) ? null : d;
  }
  const iso = d => d.toLocaleDateString('en-CA');
  const hhmm = d => String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  function raiz(sym){
    const s = String(sym||'').toUpperCase().trim();
    const m = s.match(/^([A-Z0-9]+?)[FGHJKMNQUVXZ]\d{1,2}$/);
    const r = m ? m[1] : s;
    return INSTRUMENTOS[r] ? r : (Object.keys(INSTRUMENTOS).find(k => r.startsWith(k)) || r || 'MNQ');
  }
  const esCompra = v => /^(b|buy|long|compra)/i.test(String(v||'').trim());

  /* ------------------------------------------------- performance (cerrados) */
  function dePerformance(cab, regs){
    const cS = col(cab,'symbol','contract','instrument'), cQ = col(cab,'qty','quantity'),
          cBP = col(cab,'buyPrice','buy price'), cSP = col(cab,'sellPrice','sell price'),
          cP = col(cab,'pnl','p&l','profit'), cBT = col(cab,'boughtTimestamp','bought'), cST = col(cab,'soldTimestamp','sold'),
          cBF = col(cab,'buyFillId','buy fill id'), cSF = col(cab,'sellFillId','sell fill id');
    return regs.map(r => {
      const tb = fecha(r[cBT]), ts = fecha(r[cST]);
      if(!tb || !ts) return null;
      const long = tb <= ts;
      const ent = long ? tb : ts, sal = long ? ts : tb;
      const qty = Math.abs(num(r[cQ])||1);
      const bp = num(r[cBP]), sp = num(r[cSP]);
      const inst = raiz(r[cS]);
      let pnl = num(r[cP]);
      if(pnl === null && bp !== null && sp !== null) pnl = (sp - bp) * (INSTRUMENTOS[inst]||{puntoUSD:1}).puntoUSD * qty;
      const ref = [cBF && r[cBF], cSF && r[cSF]].filter(Boolean).join('-');
      return armar({inst, direccion: long ? 'long' : 'short', contratos: qty,
        entrada: long ? bp : sp, salida: long ? sp : bp, pnl, ent, sal, ref});
    }).filter(Boolean);
  }

  /* ------------------------------------------------- órdenes / fills sueltos */
  function deFills(cab, regs){
    const cS = col(cab,'contract','symbol','product'), cL = col(cab,'B/S','side','action','buysell'),
          cQ = col(cab,'filledQty','filled qty','qty','quantity'), cPr = col(cab,'avgPrice','avg fill price','price','fill price'),
          cT = col(cab,'Fill Time','timestamp','time','date'), cSt = col(cab,'status');
    const fills = regs.map(r => {
      if(cSt && r[cSt] && !/fill/i.test(r[cSt])) return null;
      const t = fecha(r[cT]); const q = Math.abs(num(r[cQ])||0); const p = num(r[cPr]);
      if(!t || !q || p === null) return null;
      return {t, sym: String(r[cS]||''), inst: raiz(r[cS]), lado: esCompra(r[cL]) ? 1 : -1, q, p};
    }).filter(Boolean).sort((a,b) => a.t - b.t);

    // emparejar: una posición por contrato, de abrir a quedar plano
    const pos = {}, out = [];
    fills.forEach(f => {
      const k = f.sym.toUpperCase();
      const P = pos[k] || (pos[k] = {neto:0, lotes:[], ent:null, dir:0, entQ:0, entV:0, salQ:0, salV:0, pnl:0});
      if(P.neto === 0){ P.dir = f.lado; P.ent = f.t; P.entQ = 0; P.entV = 0; P.salQ = 0; P.salV = 0; P.pnl = 0; P.lotes = []; }
      if(Math.sign(f.lado) === Math.sign(P.dir) || P.neto === 0){
        P.lotes.push({q:f.q, p:f.p}); P.entQ += f.q; P.entV += f.q*f.p; P.neto += f.lado*f.q;
      }else{
        let rest = f.q;
        while(rest > 0 && P.lotes.length){
          const l = P.lotes[0]; const u = Math.min(rest, l.q);
          P.pnl += (f.p - l.p) * P.dir * u * (INSTRUMENTOS[f.inst]||{puntoUSD:1}).puntoUSD;
          l.q -= u; rest -= u; if(l.q === 0) P.lotes.shift();
        }
        P.salQ += f.q; P.salV += f.q*f.p; P.neto += f.lado*f.q;
        if(P.neto === 0){
          out.push(armar({inst:f.inst, direccion: P.dir > 0 ? 'long' : 'short', contratos: P.entQ,
            entrada: P.entV/P.entQ, salida: P.salV/P.salQ, pnl: P.pnl, ent: P.ent, sal: f.t}));
        }else if(P.neto * P.dir < 0){ // volteó la posición: abre otra en la misma ejecución
          const q2 = Math.abs(P.neto); P.dir = f.lado; P.ent = f.t; P.entQ = q2; P.entV = q2*f.p; P.lotes = [{q:q2,p:f.p}]; P.salQ = 0; P.salV = 0; P.pnl = 0;
        }
      }
    });
    return out;
  }

  function armar(o){
    const I = INSTRUMENTOS[o.inst] || INSTRUMENTOS.MNQ;
    const A = Store.ajustes;
    const com = Math.round(I.comision * o.contratos * 100) / 100;
    const rEst = A.slPuntos ? (o.pnl / (A.slPuntos * I.puntoUSD * o.contratos)) : null;
    const dia = Store.estado.dias[iso(o.ent)];
    const abre = Motor.aperturaNY(o.ent), min = o.ent.getHours()*60 + o.ent.getMinutes();
    const enVentana = min >= abre - 5 && min <= abre + 95;
    return {
      fecha: iso(o.ent), hora: hhmm(o.ent), instrumento: o.inst, direccion: o.direccion, contratos: o.contratos,
      entrada: o.entrada != null ? +(+o.entrada).toFixed(2) : null, salida: o.salida != null ? +(+o.salida).toFixed(2) : null,
      sl: null, tp: null, pnl: Math.round((o.pnl||0)*100)/100, comision: com,
      r: rEst != null ? Math.round(rEst*100)/100 : null, rEstimado: true, comisionEstimada: true,
      condicion: dia && dia.condicion ? dia.condicion : '', condicionPDA: dia && dia.condicionPDA ? dia.condicionPDA : '',
      condicionCumplida: !!(dia && dia.condicion), tipo:'continuacion',
      confluencias: enVentana ? ['killzone'] : [], tpTipo:'interno', objetivo:'',
      resultado: o.pnl - com > 0 ? 'ganada' : o.pnl - com < 0 ? 'perdida' : 'be',
      errores: enVentana ? [] : ['Fuera de la ventana'], notas:'', img:null,
      duracionMin: o.sal ? Math.round((o.sal - o.ent)/60000) : null,
      ref: o.ref || null,
      porCalificar: true
    };
  }

  /* Para no repetir trades al reimportar el mismo archivo. Antes se comparaba fecha+precio+monto y dos parciales
     idénticas (misma hora, mismo precio, mismo P&L) se tomaban por la misma: se perdían operaciones reales.
     Ahora manda el id de ejecución del CSV; y lo ya guardado sin id se descuenta uno por uno, no en bloque. */
  const clasica = t => [t.fecha, t.hora, t.instrumento, t.direccion, t.contratos, t.entrada, t.salida, Math.round(t.pnl)].join('|');
  const huella = t => t.ref ? 'ref|' + t.ref : clasica(t);

  /* ------------------------------------------------------------ importar */
  function importarTexto(texto, opt){
    opt = opt || {};
    const {cab, regs} = parseCSV(texto);
    if(!cab.length) return {ok:false, error:'No encontré una tabla con encabezados.'};
    let trades, formato;
    if(col(cab,'buyPrice','buy price') && col(cab,'sellPrice','sell price')){ formato = 'Tradovate · Performance'; trades = dePerformance(cab, regs); }
    else if(col(cab,'B/S','side','action','buysell') && col(cab,'avgPrice','avg fill price','price','fill price')){ formato = 'Tradovate · Orders / Fills'; trades = deFills(cab, regs); }
    else return {ok:false, error:'No reconozco las columnas: ' + cab.slice(0,8).join(', ') + '… Exporta desde Tradovate → Reports → Performance u Orders.'};

    const veces = new Map();
    Store.estado.trades.forEach(t => { if(t.huella) veces.set(t.huella, (veces.get(t.huella) || 0) + 1); });
    // copiador (Tradesyncer / group trading): el mismo trade entra en cada cuenta seleccionada
    const destinos = (opt.cuentas && opt.cuentas.length) ? opt.cuentas
                   : (Store.ajustes.copiador && Store.cuentasSel().length > 1) ? Store.cuentasSel().map(c => c.id)
                   : [opt.cuentaId || (Store.cuentaActiva()||{}).id || null];
    let nuevos = 0, dup = 0;
    trades.forEach(t => {
      destinos.forEach(cuentaId => {
        const suf = '|' + (cuentaId || '');
        const hh = huella(t) + suf, vieja = clasica(t) + suf;
        const ya = [hh, vieja].find(k => (veces.get(k) || 0) > 0);      // uno guardado tapa una fila, no todas
        if(ya){ veces.set(ya, veces.get(ya) - 1); dup++; return; }
        Store.estado.trades.push(Object.assign({}, t, {id: Store.id(), modo: opt.modo || 'real', cuentaId, sesionId: opt.sesionId || null,
          origen: opt.origen || 'tradovate-csv', huella: hh, creado: new Date().toISOString()}));
        nuevos++;
      });
    });
    if(nuevos) Store.guardar();
    log((opt.etiqueta || 'Importación') + ': ' + nuevos + ' nuevos, ' + dup + ' repetidos · ' + formato);
    return {ok:true, formato, nuevos, dup, total: trades.length};
  }

  function log(msg){
    const s = Store.estado.sync || (Store.estado.sync = {archivos:{}, log:[]});
    s.log.unshift({t: new Date().toISOString(), msg});
    s.log = s.log.slice(0, 40);
    s.ultimo = new Date().toISOString();
    Store.guardar();
  }

  /* --------------------------------------------------- carpeta vigilada */
  /* Chrome/Edge: File System Access API. Eliges Descargas una vez; MESA lee cada
     CSV nuevo que exportes de Tradovate y lo importa en segundos.           */
  let handle = null, timer = null, estado = {activo:false, carpeta:'', ultimoScan:null, error:''};

  function idb(){
    return new Promise((res, rej) => {
      const r = indexedDB.open('mesa-fs', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('h');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function guardaHandle(h){ const db = await idb(); const tx = db.transaction('h','readwrite'); tx.objectStore('h').put(h,'carpeta'); return new Promise(r => tx.oncomplete = r); }
  async function leeHandle(){ const db = await idb(); return new Promise(r => { const q = db.transaction('h').objectStore('h').get('carpeta'); q.onsuccess = () => r(q.result||null); q.onerror = () => r(null); }); }

  async function elegirCarpeta(){
    if(!window.showDirectoryPicker) throw new Error('Tu navegador no soporta carpetas vigiladas (usa Chrome o Edge). Puedes arrastrar el CSV o pegarlo.');
    handle = await window.showDirectoryPicker({id:'mesa-descargas', mode:'read', startIn:'downloads'});
    await guardaHandle(handle);
    estado.carpeta = handle.name; estado.error = '';
    arrancar();
  }
  async function reconectar(){
    try{
      handle = await leeHandle(); if(!handle) return false;
      const p = await handle.queryPermission({mode:'read'});
      estado.carpeta = handle.name;
      if(p === 'granted'){ arrancar(); return true; }
      estado.activo = false; estado.error = 'Toca «Reanudar» para volver a dar permiso a la carpeta ' + handle.name + '.';
      document.dispatchEvent(new CustomEvent('mesa:sync'));
      return false;
    }catch(e){ return false; }
  }
  async function reanudar(){
    if(!handle) handle = await leeHandle();
    if(!handle) return elegirCarpeta();
    const p = await handle.requestPermission({mode:'read'});
    if(p === 'granted'){ estado.error = ''; arrancar(); } else estado.error = 'Permiso denegado.';
  }
  function arrancar(){
    estado.activo = true; clearInterval(timer);
    timer = setInterval(escanear, 4000); escanear();
    document.dispatchEvent(new CustomEvent('mesa:sync'));
  }
  function detener(){ estado.activo = false; clearInterval(timer); timer = null; document.dispatchEvent(new CustomEvent('mesa:sync')); }

  async function escanear(){
    if(!handle) return;
    const s = Store.estado.sync || (Store.estado.sync = {archivos:{}, log:[]});
    try{
      for await (const [nombre, h] of handle.entries()){
        if(h.kind !== 'file' || !/\.(csv|tsv|txt)$/i.test(nombre)) continue;
        const f = await h.getFile();
        const clave = nombre + '|' + f.lastModified + '|' + f.size;
        if(s.archivos[clave]) continue;
        if(Date.now() - f.lastModified > 1000*60*60*24*3){ s.archivos[clave] = 'viejo'; continue; } // solo lo fresco (3 días)
        const texto = await f.text();
        const r = importarTexto(texto, {etiqueta:'📁 ' + nombre, origen:'tradovate-csv'});
        s.archivos[clave] = r.ok ? (r.nuevos + ' nuevos') : 'ignorado';
        if(r.ok && r.nuevos) UI.toast(r.nuevos + ' trades entraron de ' + nombre);
      }
      estado.ultimoScan = new Date(); estado.error = '';
      Store.estado.sync = s;
    }catch(e){ estado.error = e.message; if(/permission|NotAllowed/i.test(e.name + e.message)) detener(); }
    document.dispatchEvent(new CustomEvent('mesa:sync'));
  }

  /* --------------------------------------------------- Tradovate API */
  /* Experimental: solo sirve si tu cuenta tiene acceso API (las fondeadoras
     suelen desactivarlo). Credenciales solo en memoria de esta pestaña.   */
  const API = { token:null, exp:null, base:'', cuentas:[], cuentaId:null, activo:false, timer:null, error:'', contratos:{}, ultimo:null };

  async function apiLogin(cfg){
    API.base = cfg.entorno === 'live' ? 'https://live.tradovateapi.com/v1' : 'https://demo.tradovateapi.com/v1';
    const r = await fetch(API.base + '/auth/accesstokenrequest', {method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify({name:cfg.usuario, password:cfg.password, appId:'MESA', appVersion:'1.0', cid: cfg.cid, sec: cfg.sec,
        deviceId: localStorage.getItem('mesa.dev') || (localStorage.setItem('mesa.dev', Store.id()+Store.id()), localStorage.getItem('mesa.dev'))})});
    const j = await r.json();
    if(!j.accessToken) throw new Error(j.errorText || j['p-ticket'] ? 'Tradovate pide captcha/espera (p-ticket). Intenta en unos minutos.' : 'Login rechazado.');
    API.token = j.accessToken; API.exp = j.expirationTime;
    const c = await apiGet('/account/list');
    API.cuentas = c; API.cuentaId = (cfg.cuentaTv && c.find(x => String(x.id) === String(cfg.cuentaTv)) || c[0] || {}).id || null;
    sessionStorage.setItem('mesa.tv', JSON.stringify({token:API.token, base:API.base, cuentaId:API.cuentaId}));
    API.error = ''; apiArrancar();
    return c;
  }
  async function apiGet(p){
    const r = await fetch(API.base + p, {headers:{Authorization:'Bearer ' + API.token, Accept:'application/json'}});
    if(r.status === 401){ apiDetener(); throw new Error('Sesión de Tradovate expirada. Vuelve a conectar.'); }
    return r.json();
  }
  function apiArrancar(){ API.activo = true; clearInterval(API.timer); API.timer = setInterval(apiSondear, 30000); apiSondear(); document.dispatchEvent(new CustomEvent('mesa:sync')); }
  function apiDetener(){ API.activo = false; clearInterval(API.timer); API.token = null; sessionStorage.removeItem('mesa.tv'); document.dispatchEvent(new CustomEvent('mesa:sync')); }
  async function apiSondear(){
    try{
      const fills = await apiGet('/fill/list');
      const mios = fills.filter(f => !API.cuentaId || f.accountId === API.cuentaId);
      const filas = [];
      for(const f of mios){
        if(!API.contratos[f.contractId]) API.contratos[f.contractId] = (await apiGet('/contract/item?id=' + f.contractId)).name || 'MNQ';
        filas.push({contract: API.contratos[f.contractId], 'B/S': f.action, qty: f.qty, price: f.price, timestamp: f.timestamp, status:'Filled'});
      }
      if(filas.length){
        const cab = Object.keys(filas[0]);
        const csv = [cab.join(',')].concat(filas.map(r => cab.map(k => '"' + String(r[k]).replace(/"/g,'""') + '"').join(','))).join('\n');
        const r = importarTexto(csv, {etiqueta:'⚡ Tradovate API', origen:'tradovate-api'});
        if(r.ok && r.nuevos) UI.toast(r.nuevos + ' trades nuevos vía API');
      }
      API.ultimo = new Date(); API.error = '';
    }catch(e){ API.error = e.message; }
    document.dispatchEvent(new CustomEvent('mesa:sync'));
  }
  function apiReconectar(){
    try{ const s = JSON.parse(sessionStorage.getItem('mesa.tv')||'null'); if(!s) return;
      API.token = s.token; API.base = s.base; API.cuentaId = s.cuentaId; apiArrancar(); }catch(e){}
  }

  /* ------------------------------------------- app de escritorio (Swift) */
  /* Cuando corre dentro de la app nativa, la carpeta vigilada la hace macOS:
     Swift lee los CSV nuevos y los manda aquí en base64.                  */
  const nativo = !!window.__npNativo;
  const np = msg => { try{ window.webkit.messageHandlers.np.postMessage(msg); }catch(e){} };
  window.__npCsv = (nombre, b64) => {
    try{
      const texto = decodeURIComponent(escape(atob(b64)));
      const r = importarTexto(texto, {etiqueta:'📁 ' + nombre, origen:'tradovate-csv'});
      if(r.ok && r.nuevos){ UI.toast(r.nuevos + ' trades entraron de ' + nombre); np({cmd:'notificar', titulo:'NORTHPOINT', texto: r.nuevos + ' trades nuevos de ' + nombre}); }
    }catch(e){ log('Error leyendo ' + nombre + ': ' + e.message); }
  };
  window.__npCarpeta = (activo, nombre) => { estado.activo = !!activo; estado.carpeta = nombre || ''; estado.ultimoScan = new Date(); estado.error = ''; document.dispatchEvent(new CustomEvent('mesa:sync')); };
  if(nativo){
    Object.assign(window.Sync = window.Sync || {}, {});
  }

  window.Sync = { importarTexto, parseCSV, huella, estado, API, apiLogin, apiDetener, apiReconectar, log, nativo,
    elegirCarpeta: nativo ? (() => { np({cmd:'elegirCarpeta'}); return Promise.resolve(); }) : elegirCarpeta,
    reconectar, reanudar: nativo ? (() => { np({cmd:'elegirCarpeta'}); return Promise.resolve(); }) : reanudar,
    detener: nativo ? (() => np({cmd:'detenerCarpeta'})) : detener,
    escanear: nativo ? (() => { np({cmd:'barrer'}); return Promise.resolve(); }) : escanear,
    notificar: (titulo, texto) => nativo && np({cmd:'notificar', titulo, texto}) };
  if(!nativo){ reconectar(); }
  apiReconectar();
})();
