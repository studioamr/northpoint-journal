/* ============================================================================
   MESA — reglas de firmas, instrumentos y ESTRATEGIA
   ----------------------------------------------------------------------------
   Los números de firma salen del catálogo verificado el 2026-07-18 leyendo
   ÚNICAMENTE centros de ayuda oficiales (~/claude/candado/data/firm-rules.js),
   más FundedNext Futures Rapid verificado el 2026-08-27 en helpfutures.fundednext.com.

   REGLA DE LA CASA: lo que André escriba manda sobre el catálogo. Las firmas
   cambian reglas seguido; esto es punto de partida, manda tu contrato.
   Lo no verificado se deja en null y la app lo dice — nunca se rellena con un
   número plausible.
   ========================================================================= */

window.FIRMAS = {

  "FundedNext Futures": {
    fuente: "helpfutures.fundednext.com", verificado: "2026-08-27",
    planes: {
      "Rapid Daily · Challenge": {
        fase:"eval", ddTipo:"eod", congelaEn:100, consistencia:0, minDias:1, split:0.90,
        tamanos:{ 25000:{target:1500, dll:500,  maxDD:1000, contratos:2},
                  50000:{target:3000, dll:1000, maxDD:2000, contratos:4},
                  100000:{target:5000, dll:1250, maxDD:2500, contratos:6} },
        nota:"1 paso, fee único, sin mensualidad. Noticias permitidas. Tradovate. El drawdown es EOD (solo se mueve al cierre del día) y se congela en inicial+$100 — el más noble del catálogo."
      },
      "Rapid Daily · Fondeada": {
        fase:"fondeada", ddTipo:"eod", congelaEn:100, consistencia:0, minDias:1, split:0.90,
        capPayout:{25000:800, 50000:1200, 100000:2500}, maxPayouts:5,
        tamanos:{ 25000:{target:0, dll:500,  maxDD:1000, contratos:2, buffer:1100},
                  50000:{target:0, dll:1000, maxDD:2000, contratos:4, buffer:2100},
                  100000:{target:0, dll:1250, maxDD:2500, contratos:6, buffer:2600} },
        nota:"Retiro diario, SIN consistencia. Solo se retira lo que esté ARRIBA del buffer (inicial+MLL+$100), mínimo $250 y ciclo mínimo $500. LETRA CHICA: la cuenta se CIERRA al 5º retiro."
      },
      "Rapid Pro · Fondeada": {
        fase:"fondeada", ddTipo:"eod", congelaEn:100, consistencia:0.40, minDias:3, split:0.90,
        capPayout:{25000:800, 50000:1200, 100000:2500}, maxPayouts:5,
        tamanos:{ 25000:{target:0, dll:0, maxDD:1000, contratos:2, buffer:1100},
                  50000:{target:0, dll:0, maxDD:2000, contratos:4, buffer:2100},
                  100000:{target:0, dll:0, maxDD:2500, contratos:6, buffer:2600} },
        nota:"Sin límite diario, pero consistencia 40% y retiro cada 3 días. También muere al 5º retiro. El camino a cuenta LIVE de FundedNext es vía Flex, no vía Rapid."
      }
    }
  },

  "Tradeify": {
    fuente: "help.tradeify.co", verificado: "2026-07-18",
    planes: {
      "Growth Evaluation": {
        fase:"eval", ddTipo:"eod", congelaEn:null, consistencia:0, minDias:1, split:0.90,
        tamanos:{ 50000:{target:3000, dll:1250, maxDD:2000},
                  100000:{target:6000, dll:2500, maxDD:3500},
                  150000:{target:9000, dll:3750, maxDD:5000} },
        nota:"Sin consistencia: se puede pasar en 1 día. El límite diario es blando (pausa el día, no truena). En evaluación el drawdown NO se congela."
      },
      "Growth Sim Funded": {
        fase:"fondeada", ddTipo:"eod", congelaEn:100, consistencia:0.35, minDias:5, split:0.90,
        tamanos:{ 50000:{target:0, dll:1250, maxDD:2000, diaValido:150},
                  100000:{target:0, dll:2500, maxDD:3500, diaValido:200},
                  150000:{target:0, dll:3750, maxDD:5000, diaValido:250} },
        nota:"Consistencia 35%. Payout con 5 días de ganancia sobre el umbral y balance mínimo. El límite diario SUBE al llegar a 6% de ganancia."
      },
      "Select Evaluation": {
        fase:"eval", ddTipo:"eod", congelaEn:null, consistencia:0.40, minDias:3, split:0.90,
        tamanos:{ 50000:{target:3000, dll:0, maxDD:2000},
                  100000:{target:6000, dll:0, maxDD:3000},
                  150000:{target:9000, dll:0, maxDD:4500} },
        nota:"SIN límite diario. La consistencia de 40% obliga a un mínimo de 3 días: ningún día puede ser más del 40% de la ganancia total."
      },
      "Select Flex (fondeada)": {
        fase:"fondeada", ddTipo:"eod", congelaEn:100, consistencia:0, minDias:5, split:0.90,
        tamanos:{ 50000:{target:0, dll:0, maxDD:2000, diaValido:150},
                  100000:{target:0, dll:0, maxDD:3000, diaValido:200},
                  150000:{target:0, dll:0, maxDD:4500, diaValido:250} },
        nota:"Sin límite diario y SIN consistencia. Payout con 5 días ganadores. OJO: los contratos NO empiezan al máximo — una 100k arranca en 3 minis y escala con la ganancia."
      },
      "Select Daily (fondeada)": {
        fase:"fondeada", ddTipo:"eod", congelaEn:100, consistencia:0, minDias:0, split:0.90,
        tamanos:{ 50000:{target:0, dll:1000, maxDD:2000},
                  100000:{target:0, dll:1250, maxDD:2500},
                  150000:{target:0, dll:1750, maxDD:3500} },
        nota:"El drawdown más apretado de todo Tradeify en 100k/150k. Payout diario: 2× la ganancia desde el último, con tope. Elegir Flex o Daily es PERMANENTE por cuenta."
      },
      "Lightning Funded": {
        fase:"fondeada", ddTipo:"eod", congelaEn:100, consistencia:0.20, minDias:0, split:0.90,
        tamanos:{ 50000:{target:3000, dll:1250, maxDD:2000},
                  100000:{target:6000, dll:2500, maxDD:4000},
                  150000:{target:9000, dll:3000, maxDD:5250} },
        nota:"Fondeo directo, sin evaluación. La consistencia SUBE por payout: 20% → 25% → 30%. El 'objetivo' desbloquea el payout, NO es lo que puedes retirar. Sin resets: hay que recomprar."
      }
    }
  },

  "Apex Trader Funding": {
    fuente: "apextraderfunding.com/help-center", verificado: "2026-07-18",
    planes: {
      "Evaluación · EOD Trail": {
        fase:"eval", ddTipo:"eod", congelaEn:null, congelaEnObjetivo:true, consistencia:0, minDias:0, split:1.0,
        tamanos:{ 25000:{target:1500, dll:500, maxDD:1000},
                  50000:{target:3000, dll:1000, maxDD:2000},
                  100000:{target:6000, dll:1500, maxDD:3000},
                  150000:{target:9000, dll:2000, maxDD:4000} },
        nota:"El umbral se congela al llegar a inicial+objetivo. Tocar el límite diario pausa la sesión, no truena la cuenta."
      },
      "Evaluación · Intraday Trail": {
        fase:"eval", ddTipo:"intradia", congelaEn:null, congelaEnObjetivo:true, consistencia:0, minDias:0, split:1.0,
        tamanos:{ 25000:{target:1500, dll:0, maxDD:1000},
                  50000:{target:3000, dll:0, maxDD:2000},
                  100000:{target:6000, dll:0, maxDD:3000},
                  150000:{target:9000, dll:0, maxDD:4000} },
        nota:"En TRADOVATE el umbral NUNCA deja de trailear (en Rithmic/WealthCharts sí se congela). Sigue tu PICO e incluye P&L no realizado: una posición abierta a favor te sube el piso."
      },
      "Performance Account (fondeada)": {
        fase:"fondeada", ddTipo:"intradia", congelaEn:100, consistencia:0.50, minDias:5, split:1.0, maxPayouts:6,
        tamanos:{ 25000:{target:0, dll:0, maxDD:1000},
                  50000:{target:0, dll:0, maxDD:2000},
                  100000:{target:0, dll:0, maxDD:3000},
                  150000:{target:0, dll:0, maxDD:4000} },
        nota:"Consistencia 50% (el 30% es Legacy, retirado el 1-mar-2026). Se mide sobre ganancia NETA al pedir payout: los días perdedores cuentan en tu contra. Máximo 6 payouts por cuenta."
      }
    }
  },

  "Otra / manual": {
    fuente: "tu contrato", verificado: null,
    planes: {
      "Personalizado": {
        fase:"eval", ddTipo:"eod", congelaEn:100, consistencia:0, minDias:0, split:0.90,
        tamanos:{ 50000:{target:3000, dll:1000, maxDD:2000} },
        nota:"Plantilla en blanco: escribe tú los números de tu contrato. Todo es editable."
      }
    }
  }
};

/* Lo que NO está verificado y la app no debe fingir que sabe. */
window.SIN_VERIFICAR = [
  "«Red Pill» / «Blue Pill»: no aparecen con ese nombre en el catálogo verificado de Tradeify (18-jul-2026). Si es el nombre comercial nuevo, dime a qué plan corresponde (Growth / Select / Lightning) y lo mapeo — mientras tanto elige el plan por sus reglas, no por el apodo.",
  "FundedNext: qué pasa con el buffer en el «final settlement» al concluir la cuenta (5º retiro) no está documentado. Pregunta a soporte antes de comprar.",
  "FundedNext: política de copy-trading y máximo de cuentas simultáneas."
];

/* ---------------------------------------------------------------- INSTRUMENTOS */
window.INSTRUMENTOS = {
  MNQ:{nombre:"Micro Nasdaq", puntoUSD:2,    tick:0.25, comision:1.24},
  NQ: {nombre:"Nasdaq",       puntoUSD:20,   tick:0.25, comision:2.50},
  MES:{nombre:"Micro S&P",    puntoUSD:5,    tick:0.25, comision:1.24},
  ES: {nombre:"S&P 500",      puntoUSD:50,   tick:0.25, comision:2.50},
  MGC:{nombre:"Micro Oro",    puntoUSD:10,   tick:0.10, comision:1.24},
  MCL:{nombre:"Micro Crudo",  puntoUSD:100,  tick:0.01, comision:1.24},
  M2K:{nombre:"Micro Russell",puntoUSD:5,    tick:0.10, comision:1.24},
  MYM:{nombre:"Micro Dow",    puntoUSD:0.50, tick:1,    comision:1.24}
};

/* =========================================================== LA ESTRATEGIA ===
   Cuatro reglas. La app entera está construida para medir si las cumples,
   porque el win rate alto NO viene del setup: viene de no romperlas.
   ========================================================================= */
window.ESTRATEGIA = {
  nombre: "Condición · Continuación · Equilibrio · TP interno",
  premisa: "El mercado se mueve en las dos direcciones todos los días. No entras con un sesgo: entras con una condición escrita y reaccionas a la que se cumpla.",

  reglas: [
    { id:"condicion", peso:25, titulo:"Condición, no sesgo diario",
      corto:"Si esto → entonces aquello",
      texto:"Antes de operar escribes una condición sobre una PDA (FVG de 5m/15m/1h): «si respeta este FVG → voy corto a los mínimos de Asia; si lo invierte → voy largo a PDH». No entras al día con una dirección: entras con las dos ramas escritas y ejecutas la que el mercado active.",
      falla:"Operar por sesgo diario te ciega a la mitad de los setups buenos del día." },
    { id:"continuacion", peso:25, titulo:"Solo continuaciones",
      corto:"A favor del movimiento de la sesión",
      texto:"Una vez que la condición se cumple y sabes hacia dónde va el mercado, solo tomas trades a favor. Nada de reversiones. Es el cambio que más sube el win rate (10–15% por sí solo).",
      falla:"Las reversiones son el mayor destructor de win rate en cuentas de fondeo." },
    { id:"equilibrio", peso:25, titulo:"Equilibrio 0.5 + FVG",
      corto:"Dos confluencias, nunca una",
      texto:"El Fibonacci va sobre el retroceso contrario a la tendencia. El FVG (o el iFVG) solo se opera si cae encima del 0.5 del rango. Un FVG solo no basta: eso es lo que manda tus entradas al stop antes de que el trade funcione.",
      falla:"El FVG suelto es la entrada más común y la que más stops come." },
    { id:"tpInterno", peso:25, titulo:"TP conservador, liquidez interna",
      corto:"Tu pedazo del pastel",
      texto:"El take profit va a los mínimos/máximos internos, a los cuerpos, ANTES de la liquidez externa. No aguantas por el home run: registras el día ganador. $250–$500 diarios apilados pagan más payouts que un día de $3,000 cada quincena.",
      falla:"Ir por liquidez externa convierte trades ganadores en perdedores y rompe la racha de días ganadores que la firma sí premia." }
  ],

  riesgo: [
    "1–2 trades por día. No más.",
    "If W, get off the charts: un trade ganador y cierras la plataforma.",
    "Nunca más del 1% de la cuenta por trade ($500 en una 50k).",
    "Máximo 1 mini. El tamaño no se sube por convicción."
  ],
  mentalidad: "Mentalidad de longevidad: si tu meta es un payout en dos semanas, piénsalo en dos meses. Hay decenas de miles de días de trading por delante. Si hoy no hay condición, no operas: mañana existe.",

  pdas: ["FVG 1H","FVG 15m","FVG 5m","FVG 2m","iFVG (invertido)","Rejection block","Order block","Equilibrio 0.5","Volume imbalance"],
  liquidez: ["PDH","PDL","Asia high","Asia low","Londres high","Londres low","ONH","ONL","Swing interno","EQH / EQL","Máximos de sesión","Mínimos de sesión"],
  confluencias: [
    {id:"equilibrio", txt:"Equilibrio 0.5 del rango"},
    {id:"fvg",        txt:"FVG a favor"},
    {id:"ifvg",       txt:"iFVG (invertido)"},
    {id:"killzone",   txt:"Dentro de la ventana NY AM"},
    {id:"liquidez",   txt:"Liquidez clara como objetivo"},
    {id:"estructura", txt:"Estructura de sesión a favor"}
  ],
  errores: [
    "Sin condición escrita","Fue reversión","TP externo (codicia)","Fuera de la ventana",
    "Trade de revancha","Sobre-riesgo / muchos contratos","Moví el stop","Entré sin equilibrio",
    "Adelanté la entrada","Cerré antes de tiempo","FOMO por vela grande","Operé después de la meta"
  ],

  /* Rutina en hora de Morelia. La apertura de NY se calcula sola (horario de verano). */
  rutina: [
    {t:"-45", clave:"prep",      txt:"Marcar rangos: Asia, Londres, PDH/PDL, ONH/ONL. Fibonacci sobre el último retroceso."},
    {t:"-30", clave:"condicion", txt:"ESCRIBIR la condición del día. Las dos ramas, con precios. Si no la escribes, no operas."},
    {t:"0",   clave:"apertura",  txt:"Apertura NY. Ver qué rama se activa. No ejecutar todavía."},
    {t:"+15", clave:"ventana",   txt:"Ventana de ejecución: solo continuaciones, solo con equilibrio + FVG."},
    {t:"+90", clave:"cierre",    txt:"Cierre del día. Se acabó. Registrar y calificar cada trade."}
  ]
};
