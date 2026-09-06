/* ============================================================================
   NORTHPOINT JOURNAL — alertas de TradingView y notificaciones al teléfono
   ----------------------------------------------------------------------------
   Puente sin servidor: ntfy.sh. TradingView manda la alerta (webhook) a
   https://ntfy.sh/<tu-tema>; el journal se suscribe por SSE y la recibe en
   segundos. El mismo tema sirve al revés: el journal publica sus avisos
   inteligentes ("meta hecha, cierra", "2 pérdidas") y te llegan al teléfono
   con la app gratuita de ntfy (iOS/Android) suscrita al tema.
   El indicador que manda las alertas es NP JOURNAL (np-journal.pine), la
   estrategia de las 4 reglas con mensajes en JSON.
   ========================================================================= */
(function(){
  const est = { conectado:false, error:'', ultimo:null, src:null };
  const cfg = () => Object.assign({tema:'', servidor:'https://ntfy.sh', telefono:true}, Store.ajustes.alertas || {});

  function url(){ const c = cfg(); return c.servidor.replace(/\/$/,'') + '/' + encodeURIComponent(c.tema.trim()); }

  function conectar(){
    desconectar();
    const c = cfg(); if(!c.tema.trim()) return;
    try{
      const s = new EventSource(url() + '/sse');
      est.src = s;
      s.onopen = () => { est.conectado = true; est.error = ''; document.dispatchEvent(new CustomEvent('mesa:sync')); };
      s.onerror = () => { est.conectado = false; est.error = 'Sin conexión con ' + c.servidor; document.dispatchEvent(new CustomEvent('mesa:sync')); };
      s.onmessage = ev => { try{ const m = JSON.parse(ev.data); if(m.event === 'message') recibe(m); }catch(e){} };
    }catch(e){ est.error = e.message; }
  }
  function desconectar(){ if(est.src){ est.src.close(); est.src = null; } est.conectado = false; }

  /* Un mensaje que llega: si es de NP JOURNAL viene en JSON; si no, se guarda como texto. */
  function recibe(m){
    let d = null; try{ d = JSON.parse(m.message); }catch(e){}
    if(m.title && /NORTHPOINT/i.test(m.title) && !d) return;              // eco de nuestros propios avisos
    const a = { id: m.id || Store.id(), t: new Date((m.time||Date.now()/1000)*1000).toISOString(), titulo: m.title || (d && d.evento ? 'NP JOURNAL · ' + d.evento : 'Alerta'),
      texto: d ? '' : m.message, datos: d, leida:false };
    const S = Store.estado; S.alertas = (S.alertas || []); S.alertas.unshift(a); S.alertas = S.alertas.slice(0, 60);
    est.ultimo = new Date(); Store.guardar();
    UI.toast('⚡ ' + (d ? resumen(d) : (m.title || m.message || 'alerta')));
    if(window.Sync && Sync.notificar) Sync.notificar(a.titulo, d ? resumen(d) : m.message);
  }
  function resumen(d){
    if(!d) return '';
    const dir = (d.dir||'').toUpperCase() === 'SHORT' ? 'CORTO' : (d.dir||'').toUpperCase() === 'LONG' ? 'LARGO' : '';
    if(d.evento === 'setup') return `Setup ${dir} armado · entrada ${d.entrada} · SL ${d.sl} · TP ${d.tp} · 1:${d.rr}`;
    if(d.evento === 'entrada') return `Tocó la entrada ${dir} ${d.entrada} · SL ${d.sl} · TP ${d.tp}`;
    if(d.evento === 'invalidado') return 'El hueco del setup se invalidó';
    return d.evento || JSON.stringify(d);
  }

  /* Publicar un aviso: al teléfono (ntfy) + nativo si aplica */
  async function avisar(titulo, texto, prio){
    const c = cfg();
    if(window.Sync && Sync.notificar) Sync.notificar(titulo, texto);
    if(!c.tema.trim() || !c.telefono) return;
    try{ await fetch(url(), {method:'POST', body: texto, headers:{'Title': 'NORTHPOINT · ' + titulo, 'Priority': prio || 'default', 'Tags': 'chart_with_upwards_trend'}}); }catch(e){}
  }

  /* Avisos inteligentes: cuando el semáforo cambia de estado, se avisa una vez por día y estado. */
  const avisados = {};
  function vigila(){
    const cta = Store.cuentaActiva(); if(!cta) return;
    const p = Motor.planDelDia(Motor.estadoCuenta(cta)); if(!p) return;
    const clave = Store.hoyISO() + '|' + p.titulo;
    if(avisados[clave]) return;
    if(['meta','rojo'].includes(p.luz) && p.tradesHoy > 0){ avisados[clave] = true; avisar(p.titulo, p.razones[0] || '', p.luz === 'rojo' ? 'high' : 'default'); }
  }
  document.addEventListener('mesa:cambio', vigila);

  /* Recordatorios de rutina (apertura de NY) mientras la app está abierta */
  let ultimoRec = '';
  setInterval(() => {
    const abre = Motor.aperturaNY(), ahora = Motor.minAhora();
    const pasos = [{m: abre - 30, t:'Escribe la condición', x:'Las dos ramas, con precios. Sin condición no hay trade.'}, {m: abre, t:'Apertura de Nueva York', x:'Ver qué rama se activa. No ejecutar todavía.'}, {m: abre + 90, t:'Cierre de la ventana', x:'Se acabó. Registra y califica cada trade.'}];
    const hoy = new Date().getDay(); if(hoy === 0 || hoy === 6) return;
    pasos.forEach(s => { const k = Store.hoyISO() + s.t; if(ahora === s.m && ultimoRec !== k){ ultimoRec = k; avisar(s.t, s.x); } });
  }, 30000);

  const marcaLeidas = () => { (Store.estado.alertas||[]).forEach(a => a.leida = true); Store.guardar(); };
  window.Alertas = { est, cfg, conectar, desconectar, avisar, resumen, marcaLeidas, url };
  if(cfg().tema) conectar();
})();
