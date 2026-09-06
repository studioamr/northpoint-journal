/* ============================================================================
   MESA — el motor: drawdown, fase, permiso del día y calificación de la estrategia
   Aquí viven los cálculos que deciden si HOY puedes operar y con cuánto.
   ========================================================================= */
(function(){

  /* ------------------------------------------------------------ tiempo ---- */
  function desfaseMin(tz, d){
    const f = new Intl.DateTimeFormat('en-US', {timeZone:tz, hour12:false,
      year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit'});
    const p = {}; f.formatToParts(d).forEach(x => { if(x.type!=='literal') p[x.type] = x.value; });
    const utc = Date.UTC(+p.year, +p.month-1, +p.day, (+p.hour)%24, +p.minute, +p.second);
    return (utc - Math.floor(d.getTime()/1000)*1000) / 60000;
  }
  /* Minutos desde medianoche LOCAL en que abre Nueva York (9:30 ET), hoy. */
  function aperturaNY(d){
    d = d || new Date();
    const diff = desfaseMin(Intl.DateTimeFormat().resolvedOptions().timeZone, d) - desfaseMin('America/New_York', d);
    let min = 9*60 + 30 + diff;
    return ((min % 1440) + 1440) % 1440;
  }
  const hhmm = m => String(Math.floor(m/60)).padStart(2,'0') + ':' + String(Math.round(m%60)).padStart(2,'0');
  const minAhora = () => { const d = new Date(); return d.getHours()*60 + d.getMinutes(); };

  /* ------------------------------------------------------------ dinero ---- */
  const neto = t => (+t.pnl || 0) - (+t.comision || 0);

  function porDia(trades){
    const m = new Map();
    trades.forEach(t => {
      const d = m.get(t.fecha) || {fecha:t.fecha, pnl:0, n:0, ganadas:0, perdidas:0, be:0, trades:[]};
      d.pnl += neto(t); d.n++;
      if(t.resultado === 'ganada') d.ganadas++; else if(t.resultado === 'perdida') d.perdidas++; else d.be++;
      d.trades.push(t); m.set(t.fecha, d);
    });
    return [...m.values()].sort((a,b) => a.fecha < b.fecha ? -1 : 1);
  }

  /* --------------------------------------------------- estado de la cuenta */
  function estadoCuenta(cuenta){
    if(!cuenta) return null;
    const r = cuenta.reglas, ini = +cuenta.inicial;
    const trades = Store.tradesReales(cuenta.id);
    const dias = porDia(trades);

    let bal = ini, pico = ini, cierres = [];
    dias.forEach(d => { bal += d.pnl; cierres.push({fecha:d.fecha, bal}); if(bal > pico) pico = bal; });
    const balance = bal;

    // ---- piso (threshold) según el tipo de drawdown
    let piso;
    if(r.ddTipo === 'estatico'){
      piso = ini - r.maxDD;
    }else{
      piso = pico - r.maxDD;
      if(r.congelaEn !== null && r.congelaEn !== undefined) piso = Math.min(piso, ini + r.congelaEn);
      if(r.congelaEnObjetivo && r.target) piso = Math.min(piso, ini + r.target - r.maxDD);
      piso = Math.max(piso, ini - r.maxDD);
    }
    const colchon = balance - piso;
    const pisoCongelado = (r.congelaEn != null && piso >= ini + r.congelaEn - 0.01);

    // ---- objetivo
    const objetivo = r.target ? ini + r.target : null;
    const faltaTarget = objetivo ? Math.max(0, objetivo - balance) : 0;
    const pasado = objetivo ? balance >= objetivo : false;

    // ---- días
    const umbral = r.diaValido || 0;
    const diasGanadores = dias.filter(d => d.pnl > 0).length;
    const diasValidos = dias.filter(d => d.pnl >= (umbral || 0.01)).length;
    const mejorDia = dias.reduce((a,d) => Math.max(a, d.pnl), 0);
    const ganancia = balance - ini;

    // ---- consistencia
    const c = r.consistencia || 0;
    let consist = null;
    if(c > 0){
      const pct = ganancia > 0 ? mejorDia / ganancia : 0;
      const totalNecesario = mejorDia > 0 ? mejorDia / c : 0;
      consist = {
        limite: c, actual: pct, cumple: ganancia > 0 && pct <= c + 1e-9,
        falta: Math.max(0, totalNecesario - ganancia),
        maxHoy: Math.max(mejorDia, ganancia > 0 ? (c*ganancia)/(1-c) : 0)
      };
    }

    // ---- retiro
    const buffer = (r.buffer != null) ? ini + r.buffer : (r.congelaEn != null ? ini + r.maxDD + r.congelaEn : ini);
    const pagados = Store.payoutsDe(cuenta.id);
    const retirado = pagados.filter(p => p.estado === 'pagado').reduce((a,p) => a + (+p.monto||0), 0);
    const sobreBuffer = Math.max(0, balance - buffer);
    let retirable = 0, bloqueoRetiro = [];
    if(cuenta.fase !== 'eval'){
      retirable = sobreBuffer;
      if(r.capPayout) retirable = Math.min(retirable, r.capPayout);
      if(r.minDias && diasValidos < r.minDias) bloqueoRetiro.push('Faltan ' + (r.minDias - diasValidos) + ' días válidos' + (umbral ? ' (≥ $' + umbral + ')' : ''));
      if(consist && !consist.cumple) bloqueoRetiro.push('Consistencia: tu mejor día es el ' + (consist.actual*100).toFixed(0) + '% del total (tope ' + (c*100) + '%)');
      if(retirable < 250) bloqueoRetiro.push('Por arriba del buffer hay $' + Math.round(sobreBuffer) + ' (mínimo $250)');
    }
    const payoutsHechos = pagados.filter(p => p.estado === 'pagado').length;

    const quemada = balance <= piso + 0.01;

    return {
      cuenta, trades, dias, cierres, balance, pico, piso, colchon, pisoCongelado,
      objetivo, faltaTarget, pasado, ganancia, mejorDia, diasGanadores, diasValidos, umbral,
      consist, buffer, sobreBuffer, retirable, bloqueoRetiro, retirado, payoutsHechos, quemada,
      pnlHoy: (dias.find(d => d.fecha === Store.hoyISO()) || {pnl:0}).pnl,
      tradesHoy: trades.filter(t => t.fecha === Store.hoyISO())
    };
  }

  /* -------------------------------------------------- fase y plan del día */
  const FASES = {
    eval:     { nombre:'EVALUACIÓN', color:'#FFC53D',
                meta:'Llegar al objetivo sin tronar el colchón. Aquí no se cobra: se sobrevive.' },
    buffer:   { nombre:'BUFFER',     color:'#8FB8FF',
                meta:'Construir el colchón por arriba del buffer y acumular días válidos. Todavía no se retira.' },
    payouts:  { nombre:'PAYOUTS',    color:'#C6FF3D',
                meta:'Cobrar. Días ganadores chicos y consistentes, sin romper el % de consistencia.' }
  };

  function faseReal(est){
    if(!est) return 'eval';
    const c = est.cuenta;
    if(c.fase === 'eval') return 'eval';
    if(est.sobreBuffer > 250 && (!c.reglas.minDias || est.diasValidos >= c.reglas.minDias)) return 'payouts';
    return 'buffer';
  }

  function planDelDia(est){
    const A = Store.ajustes;
    if(!est) return null;
    const fase = faseReal(est);
    const inst = INSTRUMENTOS[A.instrumento] || INSTRUMENTOS.MNQ;
    const dia = Store.dia();

    // ---- cuánto puedo arriesgar hoy, según la fase
    const stopUSD = A.slPuntos * inst.puntoUSD;
    const dll = est.cuenta.reglas.dll || 0;
    let riesgoDia, riesgoTrade, contratos, meta, metaTxt, metaMax = null;
    if(fase === 'eval' && A.evalFullPort){
      // FULL PORT: el máximo de contratos que permite la firma (o lo que aguante el colchón con 3 stops),
      // el freno es el colchón y las pérdidas seguidas. Objetivo: pasar lo más rápido posible.
      const maxFirma = est.cuenta.reglas.contratos || 0;
      contratos = Math.max(0, Math.floor((est.colchon / Math.max(2, A.stopsMinimos || 3)) / stopUSD));
      if(maxFirma) contratos = Math.min(contratos, maxFirma);
      riesgoTrade = contratos * stopUSD;
      riesgoDia = riesgoTrade * Math.max(1, A.pararTrasPerdidas);
      if(dll) riesgoDia = Math.min(riesgoDia, (dll - Math.max(0, -est.pnlHoy)) * 0.8);
      meta = est.faltaTarget > 0 ? est.faltaTarget : A.metaDiaria;
      metaTxt = est.faltaTarget > 0 ? 'Faltan ' + fmt(est.faltaTarget) + ' para pasar. Full port: ' + contratos + ' ' + A.instrumento + (maxFirma ? ' (tope de la firma ' + maxFirma + ')' : '') + '.' : 'Objetivo cumplido.';
    }else{
      const pct = fase === 'eval' ? A.riesgoEvalPct : A.riesgoFondPct;
      riesgoDia = est.colchon * pct;
      if(dll) riesgoDia = Math.min(riesgoDia, (dll - Math.max(0, -est.pnlHoy)) * 0.8);
      if(A.perdidaMaxDia) riesgoDia = Math.min(riesgoDia, A.perdidaMaxDia);
      riesgoDia = Math.max(0, Math.min(riesgoDia, est.colchon - 50));
      riesgoTrade = riesgoDia / Math.max(1, A.pararTrasPerdidas);
      contratos = Math.max(0, Math.floor(riesgoTrade / stopUSD));
      if(est.cuenta.reglas.contratos) contratos = Math.min(contratos, est.cuenta.reglas.contratos);
      meta = A.metaDiaria; metaMax = A.metaMaxDia || null;
      metaTxt = 'Tu pedazo del pastel: ' + fmt(A.metaDiaria) + (metaMax ? ' · techo ' + fmt(metaMax) + ' y cierras' : '');
    }
    // RISK MANAGEMENT: nunca más del 1% de la cuenta por trade, máximo 1 mini
    const topePct = (A.riesgoPctCuenta || 0) * est.balance;
    if(topePct > 0 && riesgoTrade > topePct){ riesgoTrade = topePct; riesgoDia = Math.min(riesgoDia, riesgoTrade * Math.max(1, A.pararTrasPerdidas)); }
    if(A.maxContratos) contratos = Math.min(contratos, A.maxContratos);
    contratos = Math.min(contratos, Math.max(0, Math.floor(riesgoTrade / stopUSD)));
    if(est.consist && est.consist.maxHoy > 0 && meta > est.consist.maxHoy){
      meta = est.consist.maxHoy;
      metaTxt = 'La consistencia manda: hoy no puedes ganar más de ' + fmt(est.consist.maxHoy) + ' sin romper el ' + (est.consist.limite*100) + '%.';
    }
    const techoConsistencia = est.consist ? est.consist.maxHoy : null;

    // ---- semáforo
    const hoy = est.tradesHoy;
    let seguidas = 0;
    [...hoy].reverse().some(t => { if(t.resultado === 'perdida'){ seguidas++; return false; } return true; });
    const abre = aperturaNY(), cierra = abre + 90;
    const ahora = minAhora();

    let luz = 'verde', titulo = 'PUEDES OPERAR', razones = [];
    const alto = (t, r) => { luz = 'rojo'; titulo = t; razones.push(r); };

    if(est.quemada) alto('CUENTA TRONADA', 'El balance tocó el piso de drawdown. Esta cuenta ya no opera.');
    else if(est.cuenta.estado !== 'viva') alto('CUENTA ' + est.cuenta.estado.toUpperCase(), 'La marcaste así en Cuentas.');
    else if(est.pasado && fase === 'eval') alto('OBJETIVO CUMPLIDO', 'Ya pasaste la evaluación. Un trade más solo puede quitarte la cuenta.');
    else if(hoy.length >= A.maxTradesDia) alto('SE ACABÓ EL DÍA', 'Ya tomaste ' + hoy.length + ' trades (tope ' + A.maxTradesDia + ').');
    else if(A.pararTrasGanada && hoy.some(t => (t.pnl - (t.comision||0)) > 0)){ luz = 'meta'; titulo = 'GANASTE · FUERA DE LAS GRÁFICAS'; razones.push('If W, get off the charts. Ya hay un trade ganador hoy: cierra la plataforma.'); }
    else if(seguidas >= A.pararTrasPerdidas) alto('SE ACABÓ EL DÍA', seguidas + ' pérdidas seguidas. El día siguiente existe.');
    else if(est.pnlHoy <= -riesgoDia && riesgoDia > 0) alto('SE ACABÓ EL DÍA', 'Perdiste ' + fmt(-est.pnlHoy) + ', tu tope de hoy era ' + fmt(riesgoDia) + '.');
    else if(metaMax && est.pnlHoy >= metaMax){ luz = 'meta'; titulo = 'TECHO DEL DÍA · CIERRA'; razones.push('Llevas ' + fmt(est.pnlHoy) + ', el techo es ' + fmt(metaMax) + '. Cierra la plataforma: lo que sigue es propina para el mercado.'); }
    else if(est.pnlHoy >= meta && meta > 0 && fase !== 'eval'){ luz = 'meta'; titulo = 'DÍA GANADO · MÁXIMO UNO MÁS'; razones.push('Llevas ' + fmt(est.pnlHoy) + ' (meta ' + fmt(meta) + '). Un trade más solo si es 4/4, mismo tamaño, y luego cierras.'); }
    else if(est.pnlHoy >= meta && meta > 0){ luz = 'meta'; titulo = 'OBJETIVO A LA VISTA'; razones.push('Llevas ' + fmt(est.pnlHoy) + '. Registra y revisa si ya pasaste.'); }
    else if(contratos < 1) alto('COLCHÓN INSUFICIENTE', 'Con ' + fmt(est.colchon) + ' de colchón no cabe ni un contrato con tu stop de ' + A.slPuntos + ' pts.');

    if(luz === 'verde'){
      if(!dia.condicion.trim()){ luz = 'ambar'; titulo = 'ESCRIBE LA CONDICIÓN'; razones.push('Regla 1: sin condición escrita antes de la apertura, no hay trade.'); }
      else if(ahora > cierra){ luz = 'ambar'; titulo = 'FUERA DE VENTANA'; razones.push('La ventana NY AM cerró a las ' + hhmm(cierra) + '. Lo que entre ahora es FOMO.'); }
      else if(ahora < abre - 45){ luz = 'ambar'; titulo = 'PREPARACIÓN'; razones.push('Faltan ' + Math.round(abre - ahora) + ' min para la apertura. Marca rangos y escribe la condición.'); }
      else if(seguidas === 1){ luz = 'ambar'; titulo = 'UNA PÉRDIDA · ÚLTIMA BALA'; razones.push('El siguiente trade es el último del día, gane o pierda.'); }
      else razones.push('Ventana viva. Solo continuación, solo con equilibrio + FVG, TP a liquidez interna.');
    }
    if(est.consist && est.pnlHoy > techoConsistencia && techoConsistencia > 0)
      razones.push('OJO consistencia: hoy llevas ' + fmt(est.pnlHoy) + ' y el tope sano era ' + fmt(techoConsistencia) + '. Necesitarás ' + fmt(est.consist.falta) + ' más de ganancia total para poder cobrar.');

    return {
      fase, faseInfo: FASES[fase], riesgoDia, riesgoTrade, contratos, meta, metaTxt, metaMax, stopUSD,
      fullPort: fase === 'eval' && A.evalFullPort,
      techoConsistencia, luz, titulo, razones, abre, cierra, ahora, hhmm,
      tradesHoy: hoy.length, seguidas, restanTrades: Math.max(0, A.maxTradesDia - hoy.length)
    };
  }

  /* -------------------------------------------- calificación de estrategia */
  function adherencia(t){
    const det = [];
    let p = 0;
    const c1 = !!(t.condicion && t.condicion.trim()) && t.condicionCumplida !== false;
    const c2 = t.tipo === 'continuacion';
    const c3 = (t.confluencias||[]).includes('equilibrio') && ((t.confluencias||[]).includes('fvg') || (t.confluencias||[]).includes('ifvg'));
    const c4 = t.tpTipo === 'interno';
    [['condicion',c1],['continuacion',c2],['equilibrio',c3],['tpInterno',c4]].forEach(([id, ok]) => {
      const regla = ESTRATEGIA.reglas.find(r => r.id === id);
      if(ok) p += regla.peso;
      det.push({id, ok, titulo: regla.titulo, corto: regla.corto});
    });
    return { puntos: p, det, limpio: p === 100 };
  }

  function fmt(n){
    const s = Math.abs(+n||0) >= 1000 ? Math.round(+n||0).toLocaleString('en-US')
                                      : (Math.round((+n||0)*100)/100).toLocaleString('en-US',{maximumFractionDigits:2});
    return ((+n||0) < 0 ? '-$' : '$') + s.replace('-','');
  }

  window.Motor = { estadoCuenta, planDelDia, faseReal, FASES, adherencia, porDia, neto, aperturaNY, hhmm, minAhora, fmt };
})();
