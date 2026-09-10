/* ============================================================================
   MESA — vistas: plan del día, panel, calendario, diario
   ========================================================================= */
(function(){
  const {h, fmt, pct, signo, masMenos, kpi, opciones, fechaLarga, fechaCorta, vacio, aviso} = UI;
  window.Vistas = window.Vistas || {};

  /* ===================================================== PLAN DEL DÍA ==== */
  Vistas.plan = function(){
    const cta = Store.cuentaActiva();
    if(!cta) return primeraVez();

    const est = Motor.estadoCuenta(cta);
    const p = Motor.planDelDia(est);
    const dia = Store.dia();
    const A = Store.ajustes;
    const inst = INSTRUMENTOS[A.instrumento];

    const pasos = ESTRATEGIA.rutina.map(r => {
      const m = p.abre + (+r.t);
      const hecho = !!dia.rutina[r.clave];
      const pasado = p.ahora > m + 20;
      const viva = p.ahora >= m - 10 && p.ahora <= m + 20;
      return `<div class="paso ${hecho ? 'hecho' : viva ? 'viva' : ''} ${pasado && !viva ? 'pasado' : ''}">
        <span class="h">${Motor.hhmm(m)}</span>
        <label class="crece" style="display:flex;gap:8px;cursor:pointer;align-items:flex-start">
          <input type="checkbox" data-rutina="${r.clave}" ${hecho ? 'checked' : ''} style="margin-top:3px">
          <span style="font-size:12.5px;color:${hecho ? 'var(--tenue)' : 'var(--dim)'}">${h(r.txt)}</span>
        </label></div>`;
    }).join('');

    return `
    <div class="fila" style="margin-bottom:14px">
      <div>
        <div class="eti">Plan del día · ${h(fechaLarga(Store.hoyISO()))}</div>
        <h2 style="margin:3px 0 0;font-size:19px;font-weight:600">${h(cta.alias || cta.firma)} <span class="dim mono" style="font-size:13px">${h(cta.plan)} · ${(cta.tamano/1000)}k</span></h2>
      </div>
      <div class="crece"></div>
      <span class="chip" style="color:${p.faseInfo.color};border-color:${p.faseInfo.color}55"><b></b>${p.faseInfo.nombre}</span>
      ${Vistas._latido()}
      <button class="btn" data-ir="sync">⚡ Sincronizar</button>
      <button class="btn acc" data-acc="nuevoTrade">+ Registrar trade</button>
    </div>

    <div class="semaforo ${p.luz}" style="margin-bottom:12px">
      <div class="fila">
        <div class="t">${h(p.titulo)}</div>
        <div class="crece"></div>
        <div class="mono mini dim">Ventana NY AM · ${Motor.hhmm(p.abre)} → ${Motor.hhmm(p.cierra)} · ahora ${Motor.hhmm(p.ahora)}</div>
      </div>
      <ul>${p.razones.map(r => `<li>${h(r)}</li>`).join('')}</ul>
      <div class="mini tenue" style="margin-top:9px">${h(p.faseInfo.meta)}</div>
    </div>

    <div class="grid g5" style="margin-bottom:12px">
      ${kpi('Colchón real', `<span class="${est.colchon < est.cuenta.reglas.maxDD*0.35 ? 'down' : ''}">${fmt(est.colchon)}</span>`,
            `piso ${fmt(est.piso)}${est.pisoCongelado ? ' · congelado' : ''}`, '', 'Cuánto puedes perder antes de tronar la cuenta')}
      ${kpi('Riesgo de hoy', fmt(p.riesgoDia), `${fmt(p.riesgoTrade)} por trade`)}
      ${kpi('Contratos', `${p.contratos} <span class="dim" style="font-size:12px">${h(A.instrumento)}</span>`,
            `stop ${A.slPuntos} pts = ${fmt(A.slPuntos*inst.puntoUSD*Math.max(1,p.contratos))}`)}
      ${kpi('Meta de hoy', fmt(p.meta), h(p.metaTxt.length > 46 ? p.metaTxt.slice(0,44)+'…' : p.metaTxt))}
      ${kpi('P&L de hoy', `<span class="${signo(est.pnlHoy)}">${masMenos(est.pnlHoy)}</span>`,
            `${p.tradesHoy} trades · quedan ${p.restanTrades}`)}
    </div>

    <div class="grid g2">
      <div class="card">
        <h3>La condición de hoy</h3>
        
        <div style="margin-top:11px;display:flex;flex-direction:column;gap:9px">
          <label class="campo"><span>PDA sobre la que decides</span>
            <select data-dia="condicionPDA">${opciones(['— elige —', ...ESTRATEGIA.pdas], dia.condicionPDA)}</select></label>
          <label class="campo"><span>Nivel / precio de la condición</span>
            <input data-dia="condicion" value="${h(dia.condicion)}" placeholder="FVG de 5m 20 145 – 20 160"></label>
          <label class="campo"><span>Rama A · si lo respeta</span>
            <input data-dia="ramaA" value="${h(dia.ramaA)}" placeholder="rechaza → corto a los mínimos de Asia (20 040)"></label>
          <label class="campo"><span>Rama B · si lo invierte</span>
            <input data-dia="ramaB" value="${h(dia.ramaB)}" placeholder="iFVG → largo a PDH (20 310)"></label>
          <div class="fila">
            <span class="eti">Se activó</span>
            <div class="seg" data-seg="activada">
              ${['—','A','B'].map(v => `<button data-v="${v}" class="${(dia.activada||'—') === v ? 'on' : ''}">${v}</button>`).join('')}
            </div>
            <div class="crece"></div>
            
          </div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="card">
          <h3>Rutina</h3>
          
          <div class="rutina" style="margin-top:10px">${pasos}</div>
        </div>
        <div class="card">
          <h3>Las cuatro reglas</h3>
          
          <div style="margin-top:9px;display:flex;flex-direction:column;gap:6px">
            ${ESTRATEGIA.reglas.map((r,i) => `<div class="fila" style="gap:8px">
              <span class="mono acc" style="font-size:10px">0${i+1}</span>
              <b style="font-size:12.5px;font-weight:500">${h(r.titulo)}</b>
              <span class="mini tenue">${h(r.corto)}</span></div>`).join('')}
          </div>
          <div class="mini tenue" style="margin-top:10px;border-top:1px solid var(--linea);padding-top:9px">${h(ESTRATEGIA.mentalidad)}</div>
        </div>
      </div>
    </div>

    ${est.tradesHoy.length ? `<div class="card" style="margin-top:12px"><h3>Trades de hoy</h3>
      <div class="tabla-scroll" style="margin-top:8px">${tablaTrades(est.tradesHoy)}</div></div>` : ''}
    `;
  };

  function primeraVez(){
    const A = Store.ajustes, S = Store.estado;
    const pasos = [
      {ok: S.cuentas.length > 0, t:'Registra tu cuenta de fondeo', s:'Firma, plan y tamaño: las reglas vienen del catálogo verificado y son editables.', acc:'nuevaCuenta', b:'+ Nueva cuenta'},
      {ok: !!(A._rm1 && A.maxContratos), t:'Revisa tu risk management', s:'1–2 trades por día · if W get off the charts · 1% por trade · máx 1 mini.', ir:'ajustes', b:'Ajustes'},
      {ok: !!(A.alertas && A.alertas.tema), t:'Conecta las alertas de TradingView', s:'Tema de ntfy + indicador NP JOURNAL: la alerta llega aquí y a tu teléfono.', ir:'ajustes', b:'Alertas'},
      {ok: !!(Sync.estado && Sync.estado.carpeta), t:'Elige tu carpeta de Descargas', s:'Cada CSV de Tradovate entra solo. También puedes pegar o arrastrar.', ir:'sync', b:'Importar'},
      {ok: S.trades.length > 0, t:'Registra o importa tu primer trade', s:'Dirección, P&L, las 4 reglas y el screenshot. O el CSV de Tradovate.', acc:'nuevoTrade', b:'+ Registrar trade'},
      {ok: false, t:'Explora con datos de ejemplo', s:'Una cuenta con cuatro semanas de trades y un backtest, para ver todo funcionando.', acc:'demo', b:'Cargar ejemplo'}
    ];
    return `<div style="max-width:520px;margin:120px auto;text-align:center">
      <h2 style="font-size:30px;margin:0 0 22px;letter-spacing:-.02em">NORTHPOINT</h2>
      <div class="fila" style="justify-content:center;gap:10px">
        <button class="btn acc" data-acc="nuevaCuenta">+ Nueva cuenta</button>
        <button class="btn" data-acc="nuevoTrade">+ Registrar trade</button>
        <button class="btn fantasma" data-acc="importar">Importar CSV</button></div></div>`;
  }

  /* ============================================================ PANEL ==== */
  Vistas.panel = function(){
    const cta = Store.cuentaActiva();
    if(!cta) return primeraVez();
    const sel = Store.cuentasSel();
    const varias = sel.length > 1;
    const est = Motor.estadoCuenta(cta);
    const t = varias ? Store.tradesSel() : est.trades;
    const m = Stats.metricas(t);
    const pt = Stats.puntaje(t);
    const inicialTotal = sel.reduce((a,c) => a + (+c.inicial), 0);
    const curva = Stats.curva(t, inicialTotal);
    const ests = sel.map(c => Motor.estadoCuenta(c));
    const balanceTotal = ests.reduce((a,e) => a + e.balance, 0);
    const colchonTotal = ests.reduce((a,e) => a + e.colchon, 0);
    const ddTotal = sel.reduce((a,c) => a + c.reglas.maxDD, 0);
    const progreso = est.objetivo ? Math.max(0, Math.min(1, est.ganancia / (est.objetivo - cta.inicial))) : 0;

    const sec = (t, s, cuerpo) => `<section class="sec"><div class="sec-h"><h2>${t}</h2>${s ? `<span class="dim">${s}</span>` : ''}</div>${cuerpo}</section>`;
    return `
    <div class="fila" style="margin-bottom:6px">
      <div>
        <h2 style="margin:3px 0 0"><span class="${signo(m.pnl)}">${masMenos(m.pnl)}</span> <span class="dim" style="font-size:14px;font-weight:500">en ${m.n} trades · ${m.dias} días</span></h2></div>
      <div class="crece"></div>
      <button class="btn acc" data-acc="nuevoTrade">+ Registrar trade</button>
    </div>

    ${(() => {
      /* qué tan cerca estás de los 100,000 MXN al mes: 0 es arrancar la evaluación */
      if(!window.Progreso || !Progreso.cerca) return '';
      const C = Progreso.cerca();
      const tramo = (t, p, cls) => `<div class="c100-t ${cls} ${p >= 1 ? 'listo' : ''}"><i style="width:${p*100}%"></i><span>${t}</span></div>`;
      return `<div class="c100">
        <div class="c100-n">${C.total.toFixed(0)}<small>%</small></div>
        <div class="c100-d">
          <div class="eti">de tu meta de ${(Store.ajustes.metaMXN||100000).toLocaleString('es-MX')} MXN al mes</div>
          <div class="c100-b">${tramo('evaluación', C.ev, 'ev')}${tramo('buffer', C.bu, 'bu')}${tramo('primer retiro', C.pa, 'pa')}${tramo('la meta', C.mes, 'me')}</div>
          <div class="c100-s">sigue: ${h(C.sigue.t)}${C.sigue.f > 0 ? ' · faltan ' + fmt(C.sigue.f) : ''}</div>
        </div>
      </div>`;
    })()}
    ${sec('Resumen', '', `<div class="grid g5">
      ${kpi('Balance', `<span class="${balanceTotal >= inicialTotal ? 'up' : 'down'}">${fmt(balanceTotal)}</span>`, `inicial ${fmt(inicialTotal)}${varias ? ' · ' + sel.length + ' cuentas' : ''}`)}
      ${kpi('Win rate', `<span class="${m.winRate >= .4 ? 'up' : 'down'}">${pct(m.winRate,1)}</span>`, `${m.ganadas}G · ${m.perdidas}P · ${m.be}BE`, '', null, m.winRate, m.winRate >= .4 ? 'var(--up)' : 'var(--down)')}
      ${kpi('Profit factor', `<span class="azul">${m.pf === Infinity ? '∞' : m.pf.toFixed(2)}</span>`, `${fmt(m.bruto)} / ${fmt(m.perd)}`, '', null, Math.min(1, (m.pf === Infinity ? 3 : m.pf) / 3), 'var(--azul)')}
      ${kpi('Días ganadores', `<span class="oro">${pct(m.diaWinRate,0)}</span>`, `${m.diasG} de ${m.dias} días`, '', null, m.diaWinRate, 'var(--oro)')}
      ${kpi('Prom. gana / pierde', `<span class="up">${fmt(m.avgWin)}</span> <span class="tenue">/</span> <span class="down">${fmt(m.avgLoss)}</span>`, m.ratio ? m.ratio.toFixed(2)+' × ' : '—')}
    </div>`)}

    ${sec('Cuenta', varias ? sel.length + ' cuentas' : '', `<div class="grid" style="grid-template-columns:1fr 320px">
      <div class="card">
        <div class="fila"><h3>Curva de balance</h3><div class="crece"></div>
          <span class="mini tenue mono">${varias ? 'suma de ' + sel.length + ' cuentas' : 'piso ' + fmt(est.piso) + ' · pico ' + fmt(est.pico)}</span></div>
        <div style="margin-top:10px">${Stats.linea(curva, {base: inicialTotal, color:'var(--acc)'})}</div>
        ${varias ? `<div class="fila" style="margin-top:12px;border-top:1px solid var(--linea);padding-top:11px;gap:8px">
          ${sel.map((c,i) => `<span class="chip ${ests[i].quemada ? 'down' : ests[i].ganancia >= 0 ? 'up' : ''}"><b></b>${h(c.alias || c.firma)} ${fmt(ests[i].balance)} · colchón ${fmt(ests[i].colchon)}</span>`).join('')}
          <div class="crece"></div><span class="mono mini tenue">colchón total ${fmt(colchonTotal)} de ${fmt(ddTotal)}</span></div>` : `
        <div class="fila" style="margin-top:12px;border-top:1px solid var(--linea);padding-top:11px">
          <div style="flex:1">
            <div class="eti">${est.objetivo ? 'Camino al objetivo' : 'Ganancia acumulada'}</div>
            <div class="barra ${est.ganancia >= 0 ? 'up' : 'down'}" style="margin-top:6px"><i style="width:${(progreso*100).toFixed(1)}%"></i></div>
            <div class="mini tenue mono" style="margin-top:4px">${est.objetivo ? fmt(est.ganancia) + ' de ' + fmt(est.objetivo - cta.inicial) + ' · faltan ' + fmt(est.faltaTarget) : masMenos(est.ganancia)}</div>
          </div>
          <div style="flex:1">
            <div class="eti">Drawdown</div>
            <div class="barra down" style="margin-top:6px"><i style="width:${Math.max(0,Math.min(100, (cta.reglas.maxDD - est.colchon)/cta.reglas.maxDD*100)).toFixed(1)}%"></i></div>
            <div class="mini tenue mono" style="margin-top:4px">${fmt(Math.max(0, cta.reglas.maxDD - est.colchon))} usados de ${fmt(cta.reglas.maxDD)} · quedan ${fmt(est.colchon)} · piso ${fmt(est.piso)}${est.pisoCongelado ? ' · congelado' : ''}</div>
          </div>
        </div>`}
      </div>
      <div class="card">
        <div class="fila"><h3>Puntaje NP</h3><div class="crece"></div><span class="mono acc" style="font-size:19px">${pt.total}</span></div>
        
        ${Stats.radar(pt.ejes)}
        <div class="mini tenue" style="text-align:center;margin-top:4px">Disciplina: ${m.adherencia.toFixed(0)}/100 de adherencia a las 4 reglas</div>
      </div>
    </div>`)}

    ${sec('Rendimiento', '', `<div class="grid g2">
      <div class="card"><h3>P&L por día</h3>
        <div style="margin-top:10px">${Stats.barras(m.serieDias.map(d => ({k:d.fecha, v:d.pnl})))}</div></div>
      <div class="card"><div class="fila"><h3>Estrategias</h3><div class="crece"></div><button class="btn chico fantasma" data-acc="nuevaEstrategia">+ estrategia</button></div>
        
        <div style="margin-top:10px">${rendimientoEstrategias(t)}</div></div>
    </div>`)}

    ${(Store.estado.alertas||[]).length ? sec('Alertas', '', `<div class="card"><div class="fila"><h3>Últimas alertas</h3>${Vistas._latidoAlertas()}<div class="crece"></div><button class="btn chico fantasma" data-ir="ajustes">Configurar</button></div>
      <table style="margin-top:8px"><tbody>${(Store.estado.alertas||[]).slice(0,5).map(a => `<tr><td class="mono tenue" style="width:120px">${new Date(a.t).toLocaleString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td><td>${h(a.datos ? Alertas.resumen(a.datos) : (a.titulo + ' · ' + a.texto))}</td>
        <td style="text-align:right">${a.datos && a.datos.entrada ? `<button class="btn chico" data-acc="alertaTrade" data-id="${a.id}">registrar</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`) : ''}

    ${sec('Últimos trades', '', `<div class="card"><div class="fila"><h3>Trades</h3><div class="crece"></div>
      <button class="btn chico fantasma" data-ir="diario">Ver todos</button></div>
      <div class="tabla-scroll" style="margin-top:8px">${tablaTrades(t.slice(-8).reverse())}</div></div>`)}`;
  };

  Vistas._comparativa = trades => rendimientoEstrategias(trades);
  function rendimientoEstrategias(trades){
    if(!trades.length) return vacio('Registra trades con su estrategia y aquí ves cuál rinde.');
    const grupos = Stats.desglose(trades, t => t.estrategia || 'Sin estrategia');
    const max = Math.max(...grupos.map(g => Math.abs(g.pnl))) || 1;
    return `<table><thead><tr><th>Estrategia</th><th class="num">n</th><th class="num">win</th><th class="num">PF</th><th class="num">expect.</th><th class="num">P&L</th><th style="width:110px"></th></tr></thead><tbody>
      ${grupos.map(g => `<tr><td><b style="font-weight:600">${h(g.clave)}</b></td><td class="num tenue">${g.n}</td><td class="num">${pct(g.winRate,0)}</td>
        <td class="num">${g.pf === Infinity ? '∞' : g.pf.toFixed(2)}</td><td class="num ${signo(g.expectativa)}">${fmt(g.expectativa)}</td>
        <td class="num ${signo(g.pnl)}"><b>${masMenos(g.pnl)}</b></td>
        <td><div class="barra ${g.pnl >= 0 ? 'up' : 'down'}"><i style="width:${(Math.abs(g.pnl)/max*100).toFixed(0)}%"></i></div></td></tr>`).join('')}
      </tbody></table>`;
  }
  Vistas._rendimientoEstrategias = rendimientoEstrategias;
  function comparativaDisciplina(trades){
    const limpios = trades.filter(t => Motor.adherencia(t).limpio);
    const sucios  = trades.filter(t => !Motor.adherencia(t).limpio);
    if(!trades.length) return vacio('Registra trades y aquí verás la diferencia.');
    const fila = (nom, ts, clase) => {
      const m = Stats.metricas(ts);
      return `<div style="margin-bottom:12px">
        <div class="fila"><b style="font-size:12.5px">${h(nom)}</b><span class="pill ${clase}">${ts.length} trades</span>
          <div class="crece"></div><span class="mono ${signo(m.pnl)}">${masMenos(m.pnl)}</span></div>
        <div class="barra ${clase === 'ok' ? 'up' : 'down'}" style="margin-top:6px"><i style="width:${(m.winRate*100).toFixed(0)}%"></i></div>
        <div class="mini tenue mono" style="margin-top:4px">win ${pct(m.winRate,0)} · PF ${m.pf === Infinity ? '∞' : m.pf.toFixed(2)} · expectativa ${fmt(m.expectativa)}</div></div>`;
    };
    return fila('Con las 4 reglas cumplidas', limpios, 'ok') + fila('Con al menos una regla rota', sucios, 'no');
  }

  /* ========================================================== DIARIO ==== */
  let filtro = {texto:'', regla:'', res:''};
  Vistas.diario = function(){
    const modo = 'real';
    let t = Store.tradesSel();
    if(filtro.res) t = t.filter(x => x.resultado === filtro.res);
    if(filtro.regla === 'limpios') t = t.filter(x => Motor.adherencia(x).limpio);
    if(filtro.regla === 'rotos') t = t.filter(x => !Motor.adherencia(x).limpio);
    if(filtro.texto){
      const q = filtro.texto.toLowerCase();
      t = t.filter(x => (x.condicion + ' ' + x.notas + ' ' + x.objetivo + ' ' + (x.errores||[]).join(' ')).toLowerCase().includes(q));
    }
    t = t.slice().sort((a,b) => (b.fecha + (b.hora||'')) < (a.fecha + (a.hora||'')) ? -1 : 1);
    const m = Stats.metricas(t);
    const porCal = t.filter(x => x.porCalificar);

    return `
    <div class="fila" style="margin-bottom:12px">
      <div>
      <h2 style="margin:3px 0 0;font-size:19px;font-weight:600">${t.length} trades <span class="dim mono" style="font-size:13px">${masMenos(m.pnl)} · win ${pct(m.winRate,0)}</span></h2></div>
      <div class="crece"></div>
      ${porCal.length ? `<span class="chip" style="color:var(--oro);background:var(--oroSuave);border-color:transparent"><b></b>${porCal.length} por calificar</span>` : ''}
      <button class="btn" data-ir="sync">⚡ Sincronizar</button>
      <button class="btn acc" data-acc="nuevoTrade">+ Registrar trade</button>
    </div>
    <div class="fila" style="margin-bottom:10px">
      <input placeholder="Buscar en condición, notas, objetivo…" data-filtro="texto" value="${h(filtro.texto)}" style="max-width:280px">
      <div class="seg" data-seg="fres">${[['','Todos'],['ganada','Ganadas'],['perdida','Perdidas'],['be','BE']].map(([v,t2]) =>
        `<button data-v="${v}" class="${filtro.res === v ? 'on' : ''}">${t2}</button>`).join('')}</div>
      <div class="seg" data-seg="fregla">${[['','Toda la disciplina'],['limpios','4/4 reglas'],['rotos','Con reglas rotas']].map(([v,t2]) =>
        `<button data-v="${v}" class="${filtro.regla === v ? 'on' : ''}">${t2}</button>`).join('')}</div>
      <div class="crece"></div>
      <button class="btn chico fantasma" data-acc="exportarCsv">Exportar CSV</button>
    </div>
    <div class="card" style="padding:0"><div class="tabla-scroll">${tablaTrades(t, true)}</div></div>`;
  };

  function tablaTrades(trades, largo){
    if(!trades.length) return vacio('Todavía no hay trades aquí.');
    return `<table><thead><tr>
      <th>Fecha</th><th>Hora</th><th>Inst.</th><th>Dir</th>${largo ? '<th>Condición</th>' : ''}
      <th class="num">R</th><th class="num">P&L</th><th>Reglas</th>${largo ? '<th>Errores</th>' : ''}<th></th></tr></thead><tbody>
      ${trades.map(t => {
        const a = Motor.adherencia(t), n = Motor.neto(t);
        const cr = t.porCalificar ? `<div class="calif-rapida" data-crid="${t.id}">
            ${a.det.map(d => `<button data-cr="${d.id}" class="${d.ok ? 'on' : ''}" title="${h(d.titulo)}">${d.id === 'condicion' ? 'COND' : d.id === 'continuacion' ? 'CONT' : d.id === 'equilibrio' ? 'EQ+FVG' : 'TP'}</button>`).join('')}
            <button data-cr="listo" class="on" style="color:var(--acc2);background:var(--accSuave);border-color:transparent">✓</button></div>` : '';
        return `<tr data-trade="${t.id}" class="${t.porCalificar ? 'porcalificar' : ''}" style="cursor:pointer">
          <td class="mono">${h(fechaCorta(t.fecha))}${t.origen && t.origen !== 'manual' ? ' <span class="pill acc" title="importado">⚡</span>' : ''}${t.img ? ' <span class="tenue" title="con screenshot">▣</span>' : ''}</td>
          <td class="mono tenue">${h(t.hora || '—')}</td>
          <td class="mono">${h(t.instrumento)}</td>
          <td><span class="pill ${t.direccion === 'long' ? 'ok' : 'no'}">${t.direccion === 'long' ? 'LARGO' : 'CORTO'}</span></td>
          ${largo ? `<td class="dim" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h(t.condicion || '—')}</td>` : ''}
          <td class="num ${signo(t.r)}">${t.r != null && t.r !== '' ? (+t.r).toFixed(2) : '—'}</td>
          <td class="num ${signo(n)}">${masMenos(n)}</td>
          <td>${cr || `<span class="mono ${a.limpio ? 'up' : a.puntos >= 75 ? 'acc' : 'down'}" style="font-size:11px">${a.puntos}</span>
            <span class="tenue mono" style="font-size:9px">${a.det.map(d => d.ok ? '●' : '○').join('')}</span>`}</td>
          ${largo ? `<td class="mini tenue" style="max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h((t.errores||[]).join(', ') || '—')}</td>` : ''}
          <td style="text-align:right"><button class="btn chico fantasma" data-acc="editaTrade" data-id="${t.id}">abrir</button></td>
        </tr>`;
      }).join('')}</tbody></table>`;
  }
  Vistas._tablaTrades = tablaTrades;
  Vistas._latidoAlertas = () => (window.Alertas && Alertas.est.conectado) ? '<span class="chip up"><span class="latido"></span>EN VIVO</span>' : '';
  Vistas._latido = function(){
    const vivo = (window.Sync && (Sync.estado.activo || Sync.API.activo));
    return vivo ? `<span class="chip up" title="Importación automática activa"><span class="latido"></span>EN VIVO</span>` : '';
  };
  Vistas._filtro = filtro;

  /* ====================================================== CALENDARIO ==== */
  let cal = { y: new Date().getFullYear(), m: new Date().getMonth() };

  /* Proyección hacia adelante con el plan: cuánto ganas o pierdes por día,
     cuándo pasas la eval, cuándo haces buffer, cuándo cobras y cuándo se
     cierra la cuenta. Determinista: cada día operado = la meta del plan.   */
  /* El calendario proyecta con los PARÁMETROS DE RIESGO (vista Riesgo → Parámetros).
     Riesgo.params() ya trae como base las fases de Ajustes y las reglas de la cuenta, y encima
     lo que él haya cambiado a mano (Store.ajustes.simRiesgo). Lo que no tocó se comporta igual que antes. */
  function proyeccion(desdeISO, hastaISO, cuenta){
    const F = Store.fases();
    const S = Store.ajustes.simRiesgo || {};                                   // solo lo que él fijó a mano
    const P = (window.Riesgo && Riesgo.params) ? Riesgo.params() : null;       // base + lo suyo
    const metaEval = P ? P.evalTP : F.eval.target, metaFund = P ? P.fondTP : F.fond.target;
    const evalLoss = P ? P.evalLoss : F.eval.loss, fondLoss = P ? P.fondLoss : F.fond.loss;
    const payLoss  = P ? P.payLoss  : F.fond.loss;                             // payouts tiene su propio objetivo y su propio riesgo
    const payTP    = P && P.payTP != null ? P.payTP : metaFund;
    const out = {};
    [cuenta || Store.cuentaCal()].filter(Boolean).forEach(c => {
      const e = Motor.estadoCuenta(c); if(e.quemada || c.estado !== 'viva') return;
      const r = c.reglas, ini = +c.inicial, alias = c.alias || c.firma;
      // una eval ya pasada se proyecta como la fondeada que sigue: arranca limpia en el balance inicial
      const evalPasada = c.fase === 'eval' && e.pasado;
      let fase = c.fase === 'eval' && !e.pasado ? 'eval' : 'fond', bal = evalPasada ? ini : e.balance, pagos = evalPasada ? 0 : e.payoutsHechos, diasValidos = evalPasada ? 0 : e.diasValidos, muerta = false;
      let primero = true;
      // una eval se proyecta con las reglas del plan FONDEADO de su firma (tope por retiro, retiros máx, buffer)
      let cap = r.capPayout || null, maxP = r.maxPayouts || null, buffer = e.buffer;
      if(c.fase === 'eval' && window.FIRMAS && FIRMAS[c.firma]){
        const fam = (c.plan || '').split(' ')[0];
        const planes = FIRMAS[c.firma].planes, k = Object.keys(planes).find(p => planes[p].fase === 'fondeada' && p.startsWith(fam)) || Object.keys(planes).find(p => planes[p].fase === 'fondeada');
        const pf = k ? planes[k] : null, tf = pf ? (pf.tamanos[c.tamano] || {}) : {};
        if(pf){ cap = pf.capPayout ? (pf.capPayout[c.tamano] || cap) : cap; maxP = pf.maxPayouts || maxP; if(tf.buffer != null) buffer = ini + tf.buffer; }
      }
      // lo que él fijó en Riesgo manda sobre el plan de la firma
      if(S.buffer != null) buffer = ini + S.buffer;
      if(S.tope != null) cap = S.tope;
      if(S.maxPagos != null) maxP = S.maxPagos;
      const split = S.split != null ? S.split / 100 : (r.split || 0.9);
      const obj = S.objetivo != null ? ini + S.objetivo : e.objetivo;
      // lo que ya lleva hecho HOY en esta cuenta: el target del día baja solo conforme opera
      const hoyISO = Store.hoyISO();
      const hechoHoy = Store.tradesReales(c.id).filter(x => x.fecha === hoyISO).reduce((a, x) => a + Motor.neto(x), 0);
      const minRetiro = cap ? cap : Math.max(1000, metaFund * 5);   // sin tope: se cobra en bloques, no cada $250
      const f = new Date(desdeISO + 'T12:00'), fin = new Date(hastaISO + 'T12:00');
      for(; f <= fin; f.setDate(f.getDate() + 1)){
        if(f.getDay() === 0 || f.getDay() === 6 || muerta) continue;
        const iso = f.toLocaleDateString('en-CA');
        const d = out[iso] || (out[iso] = {pnl:0, perd:0, hitos:[]});
        // consistencia: en eval ningún día puede ser más del X% del objetivo; el target diario se topa ahí
        const cons = fase === 'eval' ? ((r.consistencia > 0 ? r.consistencia : F.eval.consistencia) || 0) : ((r.consistencia > 0 ? r.consistencia : F.fond.consistencia) || 0);
        // eval: TP del día = $1k (o lo que falte para el objetivo), topado por la consistencia
        // si él fijó el TP por día en Riesgo, ese manda: es su plan. Si no, se topa por la consistencia de la firma.
        const etapa = fase === 'eval' ? 'eval' : (bal < buffer ? 'buffer' : 'payouts');
        let meta = etapa === 'eval' ? (S.evalTP != null ? metaEval : (cons && r.target ? Math.min(metaEval, cons * r.target) : metaEval)) : etapa === 'payouts' ? payTP : metaFund;
        if(iso === hoyISO && hechoHoy > 0) meta = Math.max(0, meta - hechoHoy);          // ya ganó parte del día
        if(fase === 'eval' && obj) meta = Math.max(0, Math.min(meta, obj - bal));        // el balance ya trae lo de hoy
        let perd = etapa === 'eval' ? evalLoss : etapa === 'payouts' ? payLoss : fondLoss;
        if(iso === hoyISO && hechoHoy < 0) perd = Math.max(0, perd + hechoHoy);          // ya quemó parte del riesgo del día
        if(primero && evalPasada){ d.hitos.push({t:'EVAL PASADA · PIDE LA FONDEADA', c:alias, tono:'up'}); }
        primero = false;
        d.pnl += meta; d.perd += perd; d.fase = fase; d.etapa = etapa; bal += meta; diasValidos++;
        if(fase === 'eval' && obj && bal >= obj){ d.hitos.push({t:'PASAS LA EVAL', c:alias, tono:'up'}); fase = 'fond'; bal = ini; diasValidos = 0; continue; }
        if(fase === 'fond'){
          if(bal - meta < buffer && bal >= buffer) d.hitos.push({t:'BUFFER HECHO', c:alias, tono:'azul'});
          const sobre = bal - buffer;
          const listo = sobre >= minRetiro && (!r.minDias || diasValidos >= r.minDias);
          if(bal >= buffer && listo){
            const monto = cap ? cap : sobre; pagos++;
            d.hitos.push({t:'COBRAS ' + fmt(monto * split), c:alias, tono:'acc', monto, neto: monto * split, n: pagos, cuentaId: c.id}); bal -= monto;
            if(maxP && pagos >= maxP){ d.hitos.push({t:'CUENTA CONCLUYE · retiro #' + pagos, c:alias, tono:'down'}); muerta = true; }
          }
        }
      }
    });
    return out;
  }
  Vistas._proyeccion = proyeccion;
  Vistas.calendario = function(){
    const cta = Store.cuentaCal();
    const t = Store.tradesCal();
    const dias = new Map(Motor.porDia(t).map(d => [d.fecha, d]));

    const primero = new Date(cal.y, cal.m, 1);
    const arranque = new Date(cal.y, cal.m, 1 - primero.getDay());
    const finGrid = new Date(arranque.getFullYear(), arranque.getMonth(), arranque.getDate() + 41);
    const proy = proyeccion(Store.hoyISO(), finGrid.toLocaleDateString('en-CA'), cta);
    const F = Store.fases();
    const estCta = cta ? Motor.estadoCuenta(cta) : null;
    const faseCta = cta ? (cta.fase === 'eval' && estCta.pasado ? 'pasada' : Motor.faseReal(estCta)) : 'eval';
    /* cada hito toma el color de su etapa: eval azul · buffer rojo · payouts amarillo */
    const etapaHito = x => /PASAS|EVAL PASADA/.test(x.t) ? 'eval' : /BUFFER/.test(x.t) ? 'buffer' : 'payouts';
    /* días pasados que fueron de evaluación: desde el primer trade hasta el día en que el balance tocó el objetivo */
    const evalDias = new Set();
    if(cta && cta.fase === 'eval'){
      let bal = +cta.inicial; const obj = estCta.objetivo || Infinity;
      Motor.porDia(t).slice().sort((a,b) => a.fecha < b.fecha ? -1 : 1).some(d => { evalDias.add(d.fecha); bal += d.pnl; return bal >= obj; });
    }
    /* solo el siguiente día hábil enseña su target y daily loss; los demás solo la fase y las noticias */
    /* el target y el daily loss van en el día de HOY; si hoy es sábado o domingo, en el siguiente hábil */
    const sig = Object.keys(proy).sort()[0] || Store.hoyISO();
    const celdas = [];
    let mesPnl = 0, mesN = 0, mesG = 0, etapaPrevia = null, cobrado = false;
    for(let i = 0; i < 42; i++){
      const f = new Date(arranque.getFullYear(), arranque.getMonth(), arranque.getDate() + i);
      const iso = f.toLocaleDateString('en-CA');
      const d = dias.get(iso);
      const fuera = f.getMonth() !== cal.m;
      if(!fuera && d){ mesPnl += d.pnl; mesN += d.n; if(d.pnl > 0) mesG++; }
      const dd = Store.estado.dias[iso];
      const futuro = !fuera && iso >= Store.hoyISO() && f.getDay() > 0 && f.getDay() < 6;
      const pr = futuro ? (proy[iso] || null) : null;
      /* el calendario solo marca lo que CAMBIA: la palabra de la etapa el día que arranca,
         y los hitos de verdad. Nada de repetir «cobras» todos los días. */
      const arranca = !!pr && pr.etapa !== etapaPrevia;
      if(pr) etapaPrevia = pr.etapa;
      const hitos = (pr ? pr.hitos : []).filter(x => {
        if(/^(PASAS|BUFFER|EVAL PASADA)/.test(x.t)) return false;   // la palabra de la etapa ya lo dice
        if(!x.t.startsWith('COBRAS')) return true;     // «cuenta concluye» se marca siempre
        if(cobrado) return false;                      // el primer cobro se marca; los demás no se repiten
        cobrado = true; return true;
      });
      const hitoCorto = x => x.t.startsWith('PASAS') ? '✓ PASAS LA EVAL' : x.t.startsWith('EVAL PASADA') ? '→ PIDE LA FONDEADA' : x.t.startsWith('BUFFER') ? '◆ BUFFER' : x.t.startsWith('COBRAS') ? '$ ' + x.t.replace('COBRAS ', '') : x.t.startsWith('CUENTA') ? '■ CONCLUYE' : x.t;
      const tit = futuro && pr ? `${pr.fase === 'eval' ? 'Evaluación' : 'Fondeada'} · target +${fmt(pr.pnl)} · daily loss -${fmt(pr.perd)}` : '';
      celdas.push(`<div class="d ${fuera ? 'fuera' : ''} ${d ? (d.pnl > 0 ? 'g' : d.pnl < 0 ? 'p_' : '') : ''} ${iso === Store.hoyISO() ? 'hoy' : ''} ${futuro ? 'futuro' : ''} ${futuro && pr ? 'f-' + (pr.etapa || pr.fase) : ''} ${futuro && hitos.length ? 'hito-' + etapaHito(hitos[0]) : ''} ${!futuro && d && evalDias.has(iso) ? 'p-eval' : ''}" ${fuera ? '' : `data-dia="${iso}"`} ${tit ? `title="${tit}"` : ''}>
        <div class="n">${f.getDate()}${!futuro && d && evalDias.has(iso) ? ' <span class="pill et-eval" style="font-size:8px;padding:1px 4px">EVAL</span>' : ''}${futuro && pr && arranca ? ` <span class="pill et-${pr.etapa || pr.fase}" style="font-size:8px;padding:1px 4px">${{eval:'EVAL', buffer:'FUNDED', payouts:'PAYOUTS'}[pr.etapa] || 'FUNDED'}</span>` : ''}</div>${futuro && pr ? `<div class="py">${iso === sig ? `<span class="eti" style="font-size:8px">target</span> <span class="up">+${fmt(pr.pnl)}</span> <span class="eti" style="font-size:8px">· daily loss</span> <span class="down">-${fmt(pr.perd)}</span>` : ''}${hitos.map(x => `<div class="hito-t ${etapaHito(x)}">${h(x.t)}</div>`).join('')}</div>` : ''}
        ${d ? `<div class="p ${signo(d.pnl)}">${masMenos(d.pnl)}</div><div class="t">${d.n} · ${d.ganadas}G ${d.perdidas}P</div>` : ''}
        ${dd && dd.condicion ? '<div class="marca">✎</div>' : ''}
      </div>`);
    }
    const sem = [];
    for(let i = 0; i < 6; i++){
      const trozo = Motor.porDia(t).filter(d => { const f = new Date(d.fecha + 'T12:00'); const idx = Math.floor((f - arranque) / 86400000 / 7); return idx === i; });
      sem.push(trozo.reduce((a,d) => a + d.pnl, 0));
    }

    /* la leyenda dice los mismos números con los que se proyecta: los de Riesgo → Parámetros */
    const PR = (window.Riesgo && Riesgo.params) ? Riesgo.params() : null;
    const rp = {evalTP: PR ? PR.evalTP : F.eval.target, evalLoss: PR ? PR.evalLoss : F.eval.loss,
                fondTP: PR ? PR.fondTP : F.fond.target, fondLoss: PR ? PR.fondLoss : F.fond.loss,
                payTP: PR && PR.payTP != null ? PR.payTP : (PR ? PR.fondTP : F.fond.target), payLoss: PR ? PR.payLoss : F.fond.loss};
    const legEval = `<span class="leg"><i class="fdot et-eval"></i>EVAL <b class="up">+${fmt(rp.evalTP)}</b> <b class="down">-${fmt(rp.evalLoss)}</b></span>`;
    const legFond = `<span class="leg"><i class="fdot et-buffer"></i>FUNDED <b class="up">+${fmt(rp.fondTP)}</b> <b class="down">-${fmt(rp.fondLoss)}</b></span><span class="leg"><i class="fdot et-payouts"></i>PAYOUTS <b class="up">+${fmt(rp.payTP)}</b> <b class="down">-${fmt(rp.payLoss)}</b></span>`;
    return `
    <div class="fila cal-top">
      <h2 class="cal-mes">${UI.MESES[cal.m]} <span>${cal.y}</span></h2>
      <span class="mono ${signo(mesPnl)}" style="font-size:15px">${masMenos(mesPnl)}</span>
      <div class="crece"></div>
      <div class="cal-leg">${faseCta === 'eval' ? legEval + legFond : legFond}</div>
      <button class="btn chico fantasma" data-acc="mes" data-v="-1">‹</button>
      <button class="btn chico fantasma" data-acc="mes" data-v="1">›</button>
    </div>
    <div class="cal" style="margin-bottom:4px">${UI.DOW.map(d => `<div class="dow">${d}</div>`).join('')}</div>
    <div class="cal">${celdas.join('')}</div>`;
  };
  Vistas._cal = cal;

})();
