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

  /* ------------------------------------------------ el plan, al revés -----
     Antes se partía de «cuánto quiero hacer al día». Ahora se parte de la META
     y del número de cuentas, y la app calcula sola cuánto hay que apuntar cada
     día en cada etapa: evaluación, funded (buffer) y payouts. Todo con el
     riesgo:beneficio que él opera.                                           */
  function plan(){
    const A = Store.ajustes;
    const P = Object.assign({cuentas:5, dias:20, rr:1.5, diasEval:3, diasBuffer:4}, A.plan5 || {});
    const R = window.Riesgo && Riesgo.params ? Riesgo.params() : null;
    const objetivo = R ? R.objetivo : 3000, buffer = R ? R.buffer : 2100, tope = R ? R.tope : 1000;
    const split = (R ? R.split : 90) / 100, maxPagos = R ? R.maxPagos : 5, inicial = R ? R.inicial : 50000;
    const perd = {eval: R ? R.evalLoss : 2000, buffer: R ? R.fondLoss : 500, payouts: R ? R.payLoss : 250};

    const metaUSD   = META_MXN() / TC();
    const netoRet   = tope * split;                                  // lo que te queda de cada retiro
    const retirosCta = P.cuentas > 0 ? (metaUSD / netoRet) / P.cuentas : 0;   // retiros al mes POR CUENTA
    const diasRetiro = retirosCta > 0 ? P.dias / retirosCta : Infinity;       // días que puedes tardar en cada uno

    const T = {eval: objetivo / Math.max(1, P.diasEval),
               buffer: buffer / Math.max(1, P.diasBuffer),
               payouts: isFinite(diasRetiro) ? tope / diasRetiro : 0};
    const dias = {eval: P.diasEval, buffer: P.diasBuffer, payouts: diasRetiro};

    const inst = INSTRUMENTOS[A.instrumento] || INSTRUMENTOS.MNQ;
    const stopUSD = (A.slPuntos || 20) * inst.puntoUSD;
    const riesgoTrade = inicial * (A.riesgoPctCuenta || 0.01);
    const techo = (A.instrumento === 'MNQ' || A.instrumento === 'MES') ? (A.maxContratos || 1) * 10 : (A.maxContratos || 1);
    const contratos = Math.max(1, Math.min(techo, Math.floor(riesgoTrade / stopUSD)));   // nunca más de un mini
    const ganador = contratos * stopUSD * P.rr;   // lo que deja un ganador con el tamaño real                      // lo que deja un ganador a 1:rr
    const wrBE = 1 / (1 + P.rr);
    const ganadores = k => Math.max(1, Math.ceil(T[k] / Math.max(1, ganador)));

    const arranque = P.diasEval + P.diasBuffer;                      // días hasta poder cobrar
    const primerRetiro = arranque + Math.ceil(isFinite(diasRetiro) ? diasRetiro : 0);
    const porCuentaTotal = maxPagos * netoRet;                       // todo lo que da una cuenta antes de morir
    const mesesCuenta = retirosCta > 0 ? maxPagos / retirosCta : Infinity;
    const ingresoMes = retirosCta * netoRet * P.cuentas;
    return {P, objetivo, buffer, tope, split, maxPagos, inicial, perd, metaUSD, netoRet, retirosCta, diasRetiro,
            T, dias, stopUSD, riesgoTrade, contratos, ganador, wrBE, ganadores,
            arranque, primerRetiro, porCuentaTotal, mesesCuenta, ingresoMes};
  }

  function tablaPlan(){
    const X = plan(), P = X.P, A = Store.ajustes;
    const campo = (k, lbl, step) => `<label class="campo"><span>${lbl}</span><input type="number" step="${step||1}" data-plan5="${k}" value="${P[k]}"></label>`;
    const nd = n => !isFinite(n) ? '—' : (n < 10 ? (Math.round(n*10)/10) : Math.round(n)) + (Math.round(n) === 1 ? ' día' : ' días');
    const fila = (nom, k, nota) => `<tr>
      <td><b>${nom}</b><div class="mini tenue">${nota}</div></td>
      <td class="num up">+${fmt(X.T[k])}</td>
      <td class="num down">-${fmt(X.perd[k])}</td>
      <td class="num">${nd(X.dias[k])}</td>
      <td class="num">${X.ganadores(k)}</td></tr>`;
    const alerta = X.retirosCta > X.maxPagos
      ? aviso(`A este ritmo cada cuenta pide <b>${X.retirosCta.toFixed(1)} retiros al mes</b> y el plan solo da ${X.maxPagos}. La cuenta se agota antes de fin de mes: sube el número de cuentas o baja la meta.`)
      : '';
    return `<div class="card" style="margin-bottom:12px">
      <div class="fila" style="gap:14px">
        <div><h3>El plan</h3><div class="sub">De la meta hacia atrás: cuánto tienes que apuntar cada día en cada etapa</div></div>
        <div class="crece"></div>
        <div class="fila" style="gap:6px"><span class="eti">Cuentas</span>
          <button class="btn chico" data-acc="plan5menos">−</button><span class="mono" style="font-size:20px;min-width:28px;text-align:center" id="p5n">${P.cuentas}</span><button class="btn chico" data-acc="plan5mas">+</button></div>
      </div>
      ${alerta}
      <div class="grid g4" style="gap:8px;margin:12px 0">
        ${kpi('Meta al mes', fmt(X.metaUSD), META_MXN().toLocaleString('es-MX') + ' MXN al tipo de cambio ' + TC(), 'mini')}
        ${kpi('Con este plan', fmt(X.ingresoMes), X.retirosCta.toFixed(1) + ' retiros al mes por cuenta × ' + P.cuentas + ' cuentas', 'mini')}
        ${kpi('Cada retiro deja', fmt(X.netoRet), fmt(X.tope) + ' de tope × ' + pct(X.split,0), 'mini')}
        ${kpi('Primer retiro', nd(X.primerRetiro), X.P.diasEval + ' de eval + ' + X.P.diasBuffer + ' de buffer + ' + nd(X.diasRetiro), 'mini')}
      </div>
      <div class="tabla-scroll"><table><thead><tr><th>Etapa</th><th class="num">apuntar al día</th><th class="num">riesgo del día</th><th class="num">cuánto dura</th><th class="num">ganadores a 1:${P.rr}</th></tr></thead><tbody>
        ${fila('Evaluación', 'eval', 'hasta ' + fmt(X.objetivo) + ' para pasar')}
        ${fila('Funded · buffer', 'buffer', 'hasta ' + fmt(X.buffer) + ' arriba del inicial')}
        ${fila('Payouts', 'payouts', fmt(X.tope) + ' por retiro · ' + X.retirosCta.toFixed(1) + ' al mes')}
      </tbody></table></div>
      <div class="grid g3" style="gap:8px;margin-top:12px">
        ${kpi('Riesgo por trade', fmt(X.contratos * X.stopUSD), 'máximo ' + pct(A.riesgoPctCuenta||0.01,0) + ' de ' + fmt(X.inicial) + ' · ' + X.contratos + ' ' + h(A.instrumento) + ' con stop de ' + (A.slPuntos||20) + ' pts', 'mini')}
        ${kpi('Un ganador deja', '+' + fmt(X.ganador), 'a 1:' + P.rr + ' · win rate mínimo ' + pct(X.wrBE,0) + ' · vas en ' + pct(Stats.metricas(Store.tradesSel()).winRate,0), 'mini')}
        ${kpi('Vida de una cuenta', fmt(X.porCuentaTotal), X.maxPagos + ' retiros · se agota en ' + (isFinite(X.mesesCuenta) ? (Math.round(X.mesesCuenta*10)/10) + ' meses' : '—') + ' y hay que reponerla', 'mini')}
      </div>
      <details class="mas" style="margin-top:12px"><summary>Supuestos del plan · editables</summary><div>
        <div class="grid g4" style="gap:8px">
          ${campo('rr','Riesgo : beneficio (1 : x)',0.25)}${campo('dias','Días de mercado al mes',1)}${campo('diasEval','Días para pasar la eval',1)}${campo('diasBuffer','Días para hacer el buffer',1)}
        </div>
        <div class="mini tenue">El objetivo (${fmt(X.objetivo)}), el buffer (${fmt(X.buffer)}), el tope por retiro (${fmt(X.tope)}), el reparto (${pct(X.split,0)}) y los retiros máximos (${X.maxPagos}) salen de <b>Riesgo → Parámetros</b>. La meta y el tipo de cambio, de aquí arriba.</div>
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
      <div><h2>${META_MXN().toLocaleString('es-MX')} MXN al mes</h2></div>
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


    ${tablaPlan()}

    <div class="pasos">${P.filter(p => sig ? p.id === sig.id : false).map(p => { const i = P.indexOf(p);
      return `<div class="pasoB activo">
        <div class="pb-n mono">${String(i+1).padStart(2,'0')}</div>
        <div class="pb-c">
          <div class="fila"><b class="pb-t" style="font-size:18px">${h(p.t)}</b><span class="pill acc">AHORA</span>
            <div class="crece"></div>
            ${p.auto === null ? `<label class="check ${manual[p.id] ? 'on' : ''}"><input type="checkbox" data-paso="${p.id}" ${manual[p.id] ? 'checked' : ''}> lo hice</label>`
              : `<span class="mono mini tenue">${p.prog != null ? pct(p.prog,0) : ''}</span>`}</div>
          ${p.prog != null ? `<div class="barra" style="margin:7px 0 6px"><i style="width:${(Math.min(1,p.prog)*100).toFixed(0)}%"></i></div>` : ''}
          <div class="dim" style="font-size:13px">${h(p.como)}</div>
        </div></div>`; }).join('')}
      ${!sig ? `<div class="pasoB ok"><div class="pb-n mono">10</div><div class="pb-c"><b class="pb-t">Los diez pasos están hechos</b></div></div>` : ''}
    </div>
    <div class="pasos-hechos">${P.map((p, i) => `<span class="ph ${hecho(p) ? 'ok' : (sig && sig.id === p.id) ? 'activo' : ''}" title="${h(p.t)}">${String(i+1).padStart(2,'0')}</span>`).join('')}</div>`;
  };
  window.Progreso = { datos, pasos };
})();
