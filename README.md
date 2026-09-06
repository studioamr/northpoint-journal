# NORTHPOINT — del examen al payout

Plataforma privada de trading de fondeo para André (antes «MESA» y «NORTHPOINT JOURNAL»; la carpeta sigue siendo `~/claude/mesa`). Un TradeZella hecho a la medida de **una** estrategia
y de **una** forma de operar cuentas de fondeo: la app no solo registra trades, **califica cada uno contra las
cuatro reglas** y te dice si hoy puedes operar, con cuánto y hasta dónde.

```bash
python3 -m http.server 4356 --directory ~/claude/mesa
```
→ http://localhost:4356

Todo vive en el `localStorage` del navegador. Nada sale de tu máquina. Respaldo en **Ajustes → Exportar**.

## Descargar

- Mac: https://studioamr.github.io/northpoint-journal/download/NORTHPOINT.dmg (arrastrar a Aplicaciones; la 1ª vez clic derecho → Abrir)
- Web: https://studioamr.github.io/northpoint-journal/ (los datos viven en el navegador de cada quien)

## La estrategia que vigila (`js/reglas.js` → `ESTRATEGIA`)

| # | Regla | Qué mide la app |
|---|-------|-----------------|
| 01 | **Condición, no sesgo diario** | Que exista una condición escrita ("si esto → entonces aquello", con precios) *antes* de operar |
| 02 | **Solo continuaciones** | Que el trade vaya a favor de lo que la condición activó |
| 03 | **Equilibrio 0.5 + FVG** | Que la entrada tenga las **dos** confluencias, nunca una sola |
| 04 | **TP conservador** | Que el objetivo sea liquidez **interna**, no el home run |

Cada trade sale con una calificación de 0 a 100 (25 puntos por regla). El Panel compara sin piedad
**"con las 4 reglas cumplidas" vs "con al menos una rota"**: win rate, profit factor y expectativa de cada grupo.
Ese contraste es el corazón de la app.

## Los trades entran solos (`js/importar.js`)

Nada de capturar números a mano. Tres vías, de la más automática a la más manual:

1. **Carpeta vigilada** (Chrome/Edge, File System Access API). Eliges tu carpeta de Descargas una sola vez;
   MESA la barre cada 4 s y cada CSV nuevo de Tradovate (Reports → **Performance** u **Orders/Fills**) entra
   solo, con dedupe por huella (fecha+hora+instrumento+lado+contratos+entrada+salida+P&L). Solo lee archivos
   de los últimos 3 días.
2. **Arrastrar o pegar** — cualquier navegador: sueltas el CSV, o pegas la tabla copiada de Tradovate.
3. **Conector API Tradovate** (experimental) — login con usuario + API key (cid/sec), sondea `/fill/list`
   cada 30 s. Contraseña y secret viven solo en la pestaña. **Las fondeadoras suelen desactivar la API en
   cuentas eval/funded** — por eso la carpeta es la vía principal, no esta.

El Performance CSV ya trae trades cerrados; los Orders/Fills se emparejan en posiciones (abre → queda plano)
por contrato, FIFO, con volteo de posición contemplado. Comisión y R llegan **estimados** (tu stop típico ×
valor del punto) y el trade queda marcado **por calificar**: en el Diario aparece con cuatro toques
(COND · CONT · EQ+FVG · TP) y una palomita. Esa es la única parte tuya.

## Las ocho vistas del menú (+ selector de cuentas y Ajustes en la cabecera)

En la cabecera eliges **qué cuentas ver**: una sola (para operar), varias o todas a la vez (el Panel suma balances y colchones y
muestra un chip por cuenta; Diario, Calendario, Reportes y Lab filtran igual).

- *(fuera del menú, en `#plan`)* **Plan del día** — semáforo (`PUEDES OPERAR` / `ESCRIBE LA CONDICIÓN` / `SE ACABÓ EL DÍA` / `META HECHA`),
  colchón real, riesgo de hoy, contratos que te tocan, meta del día, la condición con sus dos ramas y la rutina
  por horario (la apertura de NY se calcula sola según el horario de verano).
- **Panel** — el tablero tipo TradeZella: P&L, win rate, profit factor, días ganadores, curva de balance
  contra el piso, **Puntaje NP** (salud del proceso, no del P&L) y **Estrategias**: el rendimiento de cada una (n, win, PF,
  expectativa, P&L). Cada trade se registra con su estrategia; la lista se edita en Ajustes o con «+ nueva» desde el formulario.
- **Registrar trade** — primero el **cargador**: diez balas, cada trade real gasta una (las gastadas se ven ganadas/perdidas), y
  arriba en grande el **win rate de las últimas diez** con el mínimo de 40% (equilibrio a 1.5R); debajo de 40% avisa que revises
  antes de disparar. Tocas la siguiente bala y sale el formulario rápido: dirección, P&L (o entrada/salida y se calcula), **las 4 reglas como cuatro botones**,
  **screenshot** (pega con ⌘V, arrastra o clic; se guarda comprimido en IndexedDB) y notas. Lo demás plegado en «Más detalles».
- **Diario** — todos los trades, filtrables por resultado y por disciplina (4/4 reglas vs reglas rotas). Exporta CSV.
- **Calendario** — el mes con el P&L de cada día. Clic en un **día pasado**: la **ficha oficial del día** (`js/ficha.js`, PNG
  1080×1350 dibujado en canvas: NORTHPOINT, fecha, P&L grande, win/PF/disciplina, condición, trades, hasta dos screenshots, notas)
  para descargar o compartir, más su bitácora y el botón **«Marcar targets del día siguiente →»** que abre el siguiente día hábil. El Calendario ve **una cuenta a la vez** (selector arriba), porque cada
  cuenta va en su fase: en **evaluación** target +$1,000 y daily loss −$2,000 (el chiste: pasar en 3 días de trading arriesgando el
  drawdown; la consistencia por fase topa el mejor día); ya
  **fondeada**, +$200 y −$500. Editable en Ajustes → *Target y daily loss por fase*. En los **días por venir**: el target y el daily
  loss de la fase con su etiqueta EVAL/FUNDED y los hitos proyectados (**PASAS LA EVAL · BUFFER HECHO · COBRAS $X · CUENTA CONCLUYE**), más los datos USD del día (Forex
  Factory) con su escenario en una línea. Clic en un día futuro: plan del
  día + escenarios A/B de cada noticia (largos/cortos) + aviso si cruza la ventana NY AM.
- **Progreso** — el panel de André: de aquí a **100,000 MXN/mes** (tipo de cambio y meta editables). Diez baby steps que se
  palomean solos con los datos (50 trades de backtest → primera eval → 10 trades seguidos con las 4 reglas → pasar → buffer $52,100
  → primer payout → 100k MXN en un mes → segunda fondeada → 3 meses seguidos → elegir el depa), con el «cómo» y la cuenta de cada paso.
  Arriba, el **plan de riesgo**: retirar $X al mes con N cuentas (copiador) → targets y pérdidas máximas mensual / semanal / diario /
  por trade, en total y por cuenta, tamaño en contratos, win rate mínimo y días buenos necesarios. Supuestos editables.
- *(cabecera, ⚡ Importar)* **Sincronizar** — carpeta vigilada, arrastrar/pegar, conector API y bitácora de lo que entró.
- **Reportes** — arriba el **Historial** (todas las cuentas: trades, win, PF, R, disciplina, invertido vs cobrado = resultado real,
  curva de R, mes a mes), luego hallazgos escritos en español, desgloses, y al final el **Lab de ciencia de datos**: Monte Carlo bootstrap de tus
  trades contra las reglas de tu cuenta (probabilidad de pasar / tronar en 60 días, abanico de futuros p5–p95), Kelly vs tu riesgo,
  rachas perdedoras esperadas, distribución de P&L, edge móvil, mapa de calor hora×día y contrafactuales («si hubieras quitado las
  reversiones…»). Hallazgos ("con las 4 reglas ganas 93%, rompiendo alguna 50%") y
  desgloses por TP, tipo de trade, confluencia, PDA, hora, día de la semana, dirección y error cometido.
- **Backtesting** — selector de **estrategia** arriba (todas o una), KPIs, curva en **R** (no en dólares) y la tabla de trades.
  Cada trade de backtest lleva su estrategia desde el formulario.
- **Cuentas** — la flota. Balance, colchón contra el piso, días válidos, consistencia, y el botón
  **Pasar a fondeada** cuando pasas la evaluación (crea la cuenta nueva con las reglas del plan fondeado y archiva la eval).
- **Payouts** — buffer, cuánto puedes pedir hoy, qué te falta para poder cobrar, el contador de retiros para las cuentas que
  mueren al quinto, la **estrategia de retiros en orden** (proyecta todas las cuentas vivas con los targets por fase: qué cuenta
  cobra primero y cuándo, cuánto va a BTC / a evals nuevas / a tu bolsillo, el acumulado del mes contra la meta en MXN y cuántas
  fondeadas hacen falta rotando) y el **progreso de cada cuenta** en tres tramos: EVALUACIÓN → BUFFER → PAYOUTS.
- **Playbook / Ajustes** — la estrategia escrita, y tus topes (instrumento, stop típico, meta diaria,
  máximo de trades, parar tras N pérdidas, % del colchón que arriesgas en eval y ya fondeado).

## De dónde salen los números de las firmas

`js/reglas.js` → `FIRMAS`. Del catálogo verificado leyendo **únicamente centros de ayuda oficiales**:

- **FundedNext Futures** — helpfutures.fundednext.com, verificado 27-ago-2026 (Rapid Daily y Rapid Pro).
- **Tradeify** — help.tradeify.co, verificado 18-jul-2026 (Growth, Select Flex/Daily, Lightning).
- **Apex Trader Funding** — apextraderfunding.com/help-center, verificado 18-jul-2026.

Reglas de la casa, heredadas de SPOTTER AI:
1. Todo en **dólares por tamaño de cuenta**; los porcentajes mienten.
2. El modelo es **firma → plan → tamaño**, nunca "una firma".
3. Lo que no se pudo verificar se deja en `null` (la lista vive en `SIN_VERIFICAR` de `js/reglas.js`; él pidió quitarla de la vista).
4. **Manda tu contrato**: todas las reglas son editables en Cuentas → Reglas.

### Pendiente de confirmar
**«Red Pill» / «Blue Pill» de Tradeify no aparecen con ese nombre en el catálogo verificado.** Elige el plan por
sus reglas (Growth / Select / Lightning) o dime a cuál corresponde el apodo comercial y lo mapeo.

## El motor (`js/motor.js`)

- **Piso de drawdown** por tipo: trailing de cierre de día, trailing intradía y estático, con congelamiento
  en `inicial + X` o en el objetivo (Apex eval). El colchón que ves es `balance − piso`, no un porcentaje inventado.
- **Consistencia**: además de decirte si la cumples, calcula **cuánto es lo máximo que puedes ganar hoy**
  sin volverte inconsistente — `c·G / (1−c)` — y cuánta ganancia total te falta para desbloquear el retiro.
- **Riesgo del día**: fracción del colchón según la fase, topada por el límite diario, dividida entre el
  número de pérdidas que te permites. De ahí salen los contratos.
- **Fases**: `EVALUACIÓN` → `BUFFER` (fondeada construyendo colchón) → `PAYOUTS`. El plan del día cambia con la fase.
- **Risk management (Ajustes, manda sobre todo):** **1–2 trades por día · if W, get off the charts (un ganador y cierras) ·
  nunca más del 1% de la cuenta por trade ($500 en 50k) · máximo 1 mini.** El semáforo lo aplica (GANASTE · FUERA DE LAS GRÁFICAS),
  el cargador lo recuerda y el tamaño sugerido nunca lo pasa.
- **Las reglas de riesgo de André (Ajustes):** fondeada = **pérdida máxima $500/día** (un día de -$1,000 es el que te
  quita la cuenta al siguiente), **meta $250, techo $500 y cierras**; después de perder, mitad de tamaño y es el último;
  2 pérdidas seguidas o 3 trades = se acabó el día. **Evaluación = full port**: contratos máximos de la firma, pasar lo
  más rápido posible; el freno es el colchón (mínimo 3 stops) y las 2 pérdidas seguidas, no la meta diaria.

## Integraciones

- **Alertas de TradingView → journal → teléfono** (`js/alertas.js`). Puente sin servidor con **ntfy.sh**: el indicador
  **NP JOURNAL** (`~/claude/tradingview/np-journal.pine`, la estrategia de las 4 reglas con mensajes en JSON) manda el webhook a
  `https://ntfy.sh/<tu-tema>`; el journal se suscribe por SSE y la alerta llega en segundos con botón «registrar trade» prellenado
  (dirección, entrada, SL, TP, contratos, condición). El mismo tema, al revés, lleva los **avisos inteligentes** del journal al
  teléfono con la app ntfy: meta hecha, 2 pérdidas, escribe la condición, apertura de NY, cierre de ventana.
- **Mercado** (`js/mercado.js`): calendario de **Forex Factory** de la semana, **solo lo que mueve ES/NQ/BTC** (datos USD de impacto
  alto y medio, hora de Morelia, «HOY», próxima noticia fuerte con ventana de no-operar). Cada noticia se abre con su ficha: qué mide,
  cómo pega en ES/NQ/BTC, qué esperar si sale mejor o peor que el pronóstico (largos o cortos) y cómo operarla con la estrategia
  (la vela de la noticia deja el FVG → condición del día). Fichas para FOMC, Powell, CPI, PPI, NFP, desempleo, claims, PCE, PIB,
  ventas minoristas, ISM/PMI, confianza, JOLTS, ADP, duraderos, minutas, crudo, subastas y precios de **futuros**: NQ, ES y BTC del CME (Yahoo Finance: último, cambio vs cierre previo, rango del día; spot de CoinGecko
  como respaldo) + USD/MXN (er-api, alimenta la meta en pesos).
  Forex Factory no manda CORS: la **app de escritorio** lo lee directo (puente Swift); en el navegador de desarrollo corre
  `python3 tools/proxy.py` (puerto 4357, solo dominios permitidos).
- **Google Calendar**: la rutina va en `download/rutina-northpoint.ics` (en hora de Nueva York, sigue el horario de verano):
  8:45 marcar rangos · 9:00 escribir condición · 9:30 apertura · 9:45–11:00 ventana · 11:00 registrar; domingo 19:00 revisión semanal.
  Se importa en Google/Apple Calendar en un clic.
- **Copiador (Tradesyncer / group trading)**: Ajustes → Copiador: un CSV entra en todas las cuentas seleccionadas.
- **Respaldo completo con screenshots** (JSON con las imágenes de IndexedDB) y **reporte del día en Markdown** por sesión.
- **Perfil y temas**: Ajustes → nombre, iniciales/foto, ciudad, frase (el perfil va hasta abajo del menú) y cinco temas: Ácido, Blanco (marca
  original), Oro, Papel, Cobalto.

## App de escritorio (Mac)

`desktop-app/` — app nativa (WKWebView en Swift, sin navegador ni Electron), binario universal Intel + Apple Silicon.
Empaqueta `index.html + css + js` dentro del `.app`; localStorage e IndexedDB persisten en el contenedor de la app.

```bash
cd desktop-app && ./build.sh     # ícono → binario → .app → download/NORTHPOINT.dmg
```

Lo que la app nativa añade sobre el navegador:
- **Carpeta vigilada de verdad**: menú → *Elegir carpeta de Descargas* (⌘O). macOS sondea la carpeta cada 4 s y cada CSV nuevo de
  Tradovate entra solo (el navegador Safari no tiene File System Access API; aquí no hace falta).
- **Notificaciones del sistema** cuando entran trades.
- Ventana propia, ícono en el Dock, links externos al navegador del sistema.

No está firmada con cuenta de Apple Developer: la primera vez, clic derecho → Abrir → Abrir.

## Archivos

```
index.html          la app entera (una sola página)
css/app.css         piel v4: negro + ácido #C6FF3D, Syne/Space Grotesk/JetBrains Mono, campo de flujo en canvas, cinta de trades
js/lab.js           Monte Carlo, Kelly, rachas, edge móvil, calor, contrafactuales
js/fondo.js         canvas de fondo + cinta
js/importar.js      CSV Tradovate → trades, carpeta vigilada, conector API
js/img.js           screenshots de trades en IndexedDB (comprimidos a 1600px JPEG)
js/reglas.js        FIRMAS · INSTRUMENTOS · ESTRATEGIA · SIN_VERIFICAR
js/store.js         estado + localStorage + export/import
js/motor.js         drawdown, fase, semáforo, sizing, calificación
js/stats.js         métricas, puntaje, desgloses y gráficas SVG a mano
js/ui.js            helpers, modales, toasts
js/vistas.js        plan · panel · diario · calendario
js/vistas2.js       reportes · backtest · cuentas · payouts · playbook · ajustes
js/app.js           ruteo, formularios y datos de ejemplo
```

Sin dependencias, sin build, sin cuentas. Abre el archivo y funciona.
