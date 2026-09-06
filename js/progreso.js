/* ============================================================================
   NORTHPOINT JOURNAL — PROGRESO DE ANDRÉ
   De dónde empieza → 100,000 MXN al mes. Baby steps: cada paso se palomea
   solo con los datos de la app (trades, cuentas, payouts) o a mano.
   ========================================================================= */
(function(){
  const {h, fmt, pct, signo, masMenos, kpi, vacio, aviso} = UI;
  const TC = () => Store.ajustes.tc || 18.5;
  const META_MXN = () => Store.ajustes.metaMXN || 100000;

  function datos(){
    const S = Store.estado, hoy = new Date();
    const reales = S.trades.filter(t => t.modo === 'real');
    const bt = S.trades.filter(t => t.modo === 'backtest');
    const ests = S.cuentas.map(c => ({c, e: Motor.estadoCuenta(c)}));
    const fondeadas = ests.filter(x => x.c.fase !== 'eval' && x.c.estado === 'viva' && !x.e.quemada);
    const pagados = S.payouts.filter(p => p.estado === 'pagado');
    const neto = p => (+p.monto||0) * ((Store.cuenta(p.cuentaId)||{reglas:{}}).reglas.split || 0.9);
    const hace30 = new Date(Date.now() - 30*86400000).toLocaleDateString('en-CA');
    const cobrado30 = pagados.filter(p => p.fecha >= hace30).reduce((a,p) => a + neto(p), 0);
    const porMes = {};
    pagados.forEach(p => { const k = p.fecha.slice(0,7); porMes[k] = (porMes[k]||0) + neto(p); });
    const meses3 = [0,1,2].map(i => { const d = new Date(hoy.getFullYear(), hoy.getMonth()-i, 1); return d.toLocaleDateString('en-CA').slice(0,7); });
    const ult10 = reales.slice().sort((a,b) => (b.fecha+(b.hora||'')) < (a.fecha+(a.hora||'')) ? -1 : 1).slice(0,10);
    const limpios10 = ult10.length >= 10 && ult10.every(t => Motor.adherencia(t).limpio);
    return { reales, bt, ests, fondeadas, pagados, cobrado30, porMes, meses3, ult10, limpios10,
      pasadas: ests.filter(x => x.c.estado === 'pasada' || x.c.fase !== 'eval').length,
      conBuffer: fondeadas.filter(x => x.e.balance >= x.e.buffer).length,
      cobradoTotal: pagados.reduce((a,p) => a + neto(p), 0) };
  }

  function pasos(D){
    const usd = META_MXN() / TC();
    const m = Store.ajustes;
    return [
      {id:'backtest', t:'Backtestear la estrategia · 50 trades', auto: D.bt.length >= 50, prog: Math.min(1, D.bt.length/50),
       como:`Llevas ${D.bt.length}. Antes de pagar un examen: 50 trades de backtest de "condición → continuación → equilibrio + FVG → TP interno". Si el win rate no pasa de 60%, no compres nada todavía.`},
      {id:'eval', t:'Comprar la primera evaluación', auto: D.ests.length >= 1, prog: D.ests.length ? 1 : 0,
       como:`FundedNext Rapid 50k (~$155). Registrarla en Cuentas. Objetivo +$3,000; en evaluación se opera full port (4 minis) porque el objetivo es pasar rápido.`},
      {id:'disciplina', t:'10 trades seguidos con las 4 reglas', auto: D.limpios10, prog: D.ult10.length ? D.ult10.filter(t => Motor.adherencia(t).limpio).length/10 : 0,
       como:`Condición escrita antes de abrir, solo continuaciones, equilibrio + FVG, TP interno. Los últimos ${D.ult10.length} trades: ${D.ult10.filter(t => Motor.adherencia(t).limpio).length} limpios. Es el paso que casi nadie da y el que más paga.`},
      {id:'pasar', t:'Pasar la evaluación', auto: D.pasadas >= 1, prog: D.ests.length ? Math.max(0, ...D.ests.map(x => x.c.fase !== 'eval' ? 1 : (x.e.objetivo ? Math.min(1, x.e.ganancia / (x.e.objetivo - x.c.inicial)) : 0))) : 0,
       como:`+$3,000 sobre 50,000. Con 4 minis y stop de 20 pts arriesgas $160 por trade; a 2R por día son ~10 días. Una pérdida de $1,000 en un día no existe: el tope es $500.`},
      {id:'buffer', t:'Construir el buffer · $52,100', auto: D.conBuffer >= 1, prog: D.fondeadas.length ? Math.max(0, ...D.fondeadas.map(x => Math.min(1, (x.e.balance - x.c.inicial) / Math.max(1, x.e.buffer - x.c.inicial)))) : 0,
       como:`Ya fondeado: +$2,100 con días de $250–500. Debajo del buffer no se retira nada. Con $300/día son 7 días. Pérdida máxima diaria $500, tras una pérdida mitad de tamaño y es el último.`},
      {id:'payout', t:'Primer payout cobrado', auto: D.pagados.length >= 1, prog: D.pagados.length ? 1 : 0,
       como:`Arriba de $52,100 pides mínimo $250 y máximo $1,200 (te llegan $1,080). Regla del camino: $500 a BTC, la mitad del resto a la siguiente evaluación, lo demás a tu billetera.`},
      {id:'mexico', t:`${META_MXN().toLocaleString('es-MX')} MXN en un mes`, auto: D.cobrado30 >= usd, prog: Math.min(1, D.cobrado30 / usd),
       como:`= ${fmt(usd)} a ${TC()}. Son 5 retiros de $1,080 en el mes: una sola 50k rindiendo $278/día lo cubre. Últimos 30 días: ${fmt(D.cobrado30)} (${Math.round(D.cobrado30*TC()).toLocaleString('es-MX')} MXN).`},
      {id:'segunda', t:'Segunda cuenta fondeada viva', auto: D.fondeadas.length >= 2, prog: Math.min(1, D.fondeadas.length/2),
       como:`La Rapid muere al 5º retiro: la siguiente eval se compra con el primer payout, no cuando la primera se cierre. Con dos vivas, un mes malo de una no te tumba el plan.`},
      {id:'tres', t:`3 meses seguidos ≥ ${META_MXN().toLocaleString('es-MX')} MXN`, auto: D.meses3.every(k => (D.porMes[k]||0) >= usd), prog: D.meses3.filter(k => (D.porMes[k]||0) >= usd).length/3,
       como:`${D.meses3.map(k => k + ': ' + fmt(D.porMes[k]||0)).join(' · ')}. Cuando esto se cumpla, vivir en México ya no es una apuesta: es un ingreso.`},
      {id:'torre', t:'Elegir el piso alto en la torre favorita', auto: null, prog: null,
       como:`Manual. Con 3 meses seguidos cubiertos, firmas el depa. Antes no: la renta se paga con payouts, no con esperanza.`}
    ];
  }

  /* ------------------------------------------------ plan de riesgo -----
     Objetivo: retirar X al mes con N cuentas (copiador: el mismo trade en
     todas). De ahí salen targets y pérdidas máximas mensual / semanal /
     diario / por trade, en total y por cuenta.                            */
  function plan(){
    const A = Store.ajustes, P = Object.assign({metaDia:250, cuentas:5, split:0.9, dias:20, semanas:4, maxDD:2000, diaValido:150, rr:1.5, trades:2}, A.plan5 || {});
    const inst = INSTRUMENTOS[A.instrumento] || INSTRUMENTOS.MNQ;
    const stopUSD = A.slPuntos * inst.puntoUSD;
    // se parte del mínimo diario por cuenta y se sube: semana, mes, retiro
    const porCta = { dia: P.metaDia };
    porCta.semana = porCta.dia * (P.dias / P.semanas);
    porCta.mes = porCta.dia * P.dias;
    porCta.trade = porCta.dia / Math.max(1, P.trades);
    const brutoMes = porCta.mes * P.cuentas;
    const retiro = brutoMes * P.split;
    const riesgo = {
      dia: Math.min(porCta.dia, A.perdidaMaxDia || 500),
      semana: Math.min(porCta.semana, P.maxDD * 0.25),
      mes: Math.min(porCta.mes, P.maxDD * 0.5)
    };
    riesgo.trade = riesgo.dia / Math.max(1, A.pararTrasPerdidas);
    const contratos = Math.max(1, Math.floor(riesgo.trade / stopUSD));
    const ganaTrade = contratos * stopUSD * P.rr;
    const wrBE = 1 / (1 + P.rr);
    const tradesGanadores = Math.ceil(porCta.dia / ganaTrade);      // ganadores que necesitas al día para el mínimo
    const diasBuenos = Math.ceil(porCta.mes / Math.max(P.diaValido, porCta.dia));
    return {P, stopUSD, brutoMes, retiro, porCta, riesgo, contratos, ganaTrade, wrBE, diasBuenos, tradesGanadores,
      total: k => porCta[k] * P.cuentas, riesgoTotal: k => riesgo[k] * P.cuentas};
  }

  function tablaPlan(){
    const X = plan(), P = X.P, A = Store.ajustes;
    const campo = (k, lbl, step) => `<label class="campo"><span>${lbl}</span><input type="number" step="${step||1}" data-plan5="${k}" value="${P[k]}"></label>`;
    const fila = (nom, tgt, rsk, nota) => `<tr><td><b>${nom}</b><div class="mini tenue">${nota||''}</div></td>
      <td class="num up">+${fmt(tgt)}</td><td class="num up">+${fmt(tgt * P.cuentas)}</td>
      <td class="num down">-${fmt(rsk)}</td><td class="num down">-${fmt(rsk * P.cuentas)}</td></tr>`;
    return `<div class="card" style="margin-bottom:12px">
      <div class="fila" style="gap:14px">
        <div><h3>Plan de riesgo</h3><div class="sub">Mínimo por día por cuenta → semana → mes → retiro · copiador: el mismo trade en todas</div></div>
        <div class="crece"></div>
        <div class="fila" style="gap:6px"><span class="eti">Cuentas</span>
          <button class="btn chico" data-acc="plan5menos">−</button><span class="mono" style="font-size:20px;min-width:28px;text-align:center" id="p5n">${P.cuentas}</span><button class="btn chico" data-acc="plan5mas">+</button></div>
        <label class="campo" style="width:150px"><span>Mínimo/día por cuenta ($)</span><input type="number" step="25" data-plan5="metaDia" value="${P.metaDia}"></label>
      </div>
      <div class="grid g4" style="gap:8px;margin:12px 0">
        ${kpi('Retiro al mes', fmt(X.retiro), fmt(X.brutoMes) + ' ganados × ' + pct(P.split,0) + ' · ' + P.cuentas + ' cuentas', 'mini')}
        ${kpi('Por cuenta al mes', fmt(X.porCta.mes), fmt(P.metaDia) + ' × ' + P.dias + ' días', 'mini')}
        ${kpi('Tamaño', X.contratos + ' ' + h(A.instrumento) + ' × ' + P.cuentas, fmt(X.riesgo.trade) + ' de riesgo por trade por cuenta · stop ' + A.slPuntos + ' pts', 'mini')}
        ${kpi('Un ganador deja', '+' + fmt(X.ganaTrade), 'a ' + P.rr + 'R · necesitas ' + X.tradesGanadores + ' ganador' + (X.tradesGanadores > 1 ? 'es' : '') + ' al día para los ' + fmt(P.metaDia), 'mini')}
      </div>
      <div class="tabla-scroll"><table><thead><tr><th>Periodo</th><th class="num">target por cuenta</th><th class="num">target total ×${P.cuentas}</th><th class="num">pérdida máx. por cuenta</th><th class="num">total ×${P.cuentas}</th></tr></thead><tbody>
        ${fila('Día', X.porCta.dia, X.riesgo.dia, 'mínimo hecho = plataforma cerrada · ' + A.pararTrasPerdidas + ' pérdidas seguidas = día cerrado')}
        ${fila('Semana', X.porCta.semana, X.riesgo.semana, 'máximo 2 días rojos · tope 25% del drawdown')}
        ${fila('Mes', X.porCta.mes, X.riesgo.mes, 'si pierdes esto se cierra el mes y se revisa la estrategia · tope 50% del drawdown')}
        ${fila('Trade', X.porCta.trade, X.riesgo.trade, X.contratos + ' ' + A.instrumento + ' por cuenta · riesgo/día ÷ ' + A.pararTrasPerdidas)}
      </tbody></table></div>
      <div class="grid g3" style="gap:8px;margin-top:12px">
        ${kpi('Win rate mínimo', pct(X.wrBE,0), 'para no perder a ' + P.rr + 'R · tú vas en ' + pct(Stats.metricas(Store.tradesSel()).winRate,0), 'mini')}
        ${kpi('Día malo × ' + P.cuentas, '-' + fmt(X.riesgoTotal('dia')), 'eso cuesta un día mal con el copiador · nunca más de ' + fmt(A.perdidaMaxDia||500) + ' por cuenta', 'mini')}
        ${kpi('Retiro por cuenta', fmt(X.porCta.mes * P.split), 'revisa el tope de retiro de tu plan: si es menor, el excedente se queda en la cuenta', 'mini')}
      </div>
      <details class="mas" style="margin-top:12px"><summary>Supuestos del plan · editables</summary><div>
        <div class="grid g4" style="gap:8px">
          ${campo('split','Reparto (0–1)',0.05)}${campo('dias','Días operados/mes',1)}${campo('semanas','Semanas/mes',1)}${campo('maxDD','Drawdown por cuenta ($)',100)}
          ${campo('diaValido','Día ganador mínimo ($)',25)}${campo('rr','R por trade ganador',0.25)}${campo('trades','Trades por día',1)}
        </div>
        <div class="mini tenue">El stop (${A.slPuntos} pts = ${fmt(X.stopUSD)}), la pérdida máxima diaria (${fmt(A.perdidaMaxDia||500)}) y «parar tras ${A.pararTrasPerdidas} pérdidas» salen de Ajustes.</div>
      </div></details>
    </div>`;
  }
  Vistas._plan5 = plan;

  Vistas.progreso = function(){
    const D = datos();
    const P = pasos(D);
    const manual = Store.ajustes.pasos || {};
    const hecho = p => p.auto === null ? !!manual[p.id] : p.auto;
    const hechos = P.filter(hecho).length;
    const sig = P.find(p => !hecho(p));
    const usd = META_MXN() / TC();
    return `
    <div class="fila" style="margin-bottom:12px">
      <div><div class="eti">Progreso de André</div><h2>De aquí a ${META_MXN().toLocaleString('es-MX')} MXN al mes</h2></div>
      <div class="crece"></div>
      <label class="campo" style="width:110px"><span>MXN por USD</span><input type="number" step="0.5" data-ajuste="tc" value="${TC()}"></label>
      <label class="campo" style="width:130px"><span>Meta MXN/mes</span><input type="number" step="5000" data-ajuste="metaMXN" value="${META_MXN()}"></label>
    </div>

    <div class="grid g5" style="margin-bottom:12px">
      ${kpi('Cobrado · 30 días', fmt(D.cobrado30), Math.round(D.cobrado30*TC()).toLocaleString('es-MX') + ' MXN de ' + META_MXN().toLocaleString('es-MX'))}
      ${kpi('Meta en USD', fmt(usd), '= 5 retiros de $1,080 · una 50k a $278/día')}
      ${kpi('Fondeadas vivas', D.fondeadas.length, D.ests.length + ' cuentas en total · ' + D.pagados.length + ' payouts')}
      ${kpi('Trades reales', D.reales.length, D.bt.length + ' de backtest')}
      ${kpi('Pasos', hechos + ' / ' + P.length, sig ? 'siguiente: ' + sig.t : 'todo hecho')}
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="fila"><h3>Dónde estás</h3><div class="crece"></div><span class="mono acc">${pct(hechos/P.length,0)}</span></div>
      <div class="barra" style="margin-top:10px;height:8px"><i style="width:${(hechos/P.length*100).toFixed(0)}%"></i></div>
      <div class="mini dim" style="margin-top:10px">${sig ? `<b class="acc">Siguiente paso:</b> ${h(sig.t)}. ${h(sig.como)}` : 'Los diez pasos están hechos. Ahora es mantener.'}</div>
    </div>

    ${tablaPlan()}

    <div class="pasos">${P.map((p, i) => { const ok = hecho(p); const activo = sig && sig.id === p.id;
      return `<div class="pasoB ${ok ? 'ok' : ''} ${activo ? 'activo' : ''}">
        <div class="pb-n mono">${String(i+1).padStart(2,'0')}</div>
        <div class="pb-c">
          <div class="fila"><b class="pb-t">${h(p.t)}</b>
            ${ok ? '<span class="pill ok">HECHO</span>' : activo ? '<span class="pill acc">AHORA</span>' : ''}
            <div class="crece"></div>
            ${p.auto === null ? `<label class="check ${manual[p.id] ? 'on' : ''}"><input type="checkbox" data-paso="${p.id}" ${manual[p.id] ? 'checked' : ''}> lo hice</label>`
              : `<span class="mono mini tenue">${p.prog != null ? pct(p.prog,0) : ''}</span>`}</div>
          ${p.prog != null ? `<div class="barra ${ok ? 'up' : ''}" style="margin:7px 0 6px"><i style="width:${(Math.min(1,p.prog)*100).toFixed(0)}%"></i></div>` : ''}
          <div class="mini dim">${h(p.como)}</div>
        </div></div>`; }).join('')}</div>

    ${aviso('Los pasos con barra se palomean solos con lo que registres (trades, cuentas, payouts). El orden importa: <b>no compres el examen sin backtest, no pidas payout sin buffer, no firmes el depa sin 3 meses</b>.', 'acc')}`;
  };
  window.Progreso = { datos, pasos };
})();
