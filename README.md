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

## Entrada

Al abrir: **NORTHPOINT** flotando y abajo el log in. La primera vez creas tu acceso (nombre + PIN de 4 dígitos opcional,
guardado como hash local); después inicias sesión cada vez o marcas «Recordarme en esta Mac». ⎋ en la cabecera cierra sesión.
Sin cuentas: la pantalla de arranque es la lista de cosas por hacer (cuenta, risk management, alertas, carpeta, primer trade).

## La estrategia que vigila (`js/reglas.js` → `ESTRATEGIA`)

| # | Regla | Qué mide la app |
|---|-------|-----------------|
| 01 | **Condición, no sesgo diario** | Que exista una condición escrita ("si esto → entonces aquello", con precios) *antes* de operar |
| 02 | **Solo continuaciones** | Que el trade vaya a favor de lo que la condición activó |
| 03 | **Equilibrio 0.5 + FVG** | Que la entrada tenga las **dos** confluencias, nunca una sola |
| 04 | **TP conservador** | Que el objetivo sea liquidez **interna**, no el home run |

Cada trade sale con una calificación de 0 a 100 (25 puntos por regla). El Dashboard compara sin piedad
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
valor del punto) y el trade queda marcado **por calificar**: en Trades aparece con cuatro toques
(COND · CONT · EQ+FVG · TP) y una palomita. Esa es la única parte tuya.

## El menú (+ selector de cuentas y Ajustes en la cabecera)

Agrupado en **Operar** (Mercado, Dashboard, Trades, Calendario), **Analizar** (Reportes, Backtesting) y **Cuenta** (Cuentas,
Payouts, Progreso, Riesgo). El Dashboard va por secciones: Resumen · Cuenta · Rendimiento · Alertas · Últimos trades.
La vista Trading (Tradovate / TradingView embebidos) sigue existiendo en `#trading`, pero ya no está en el menú.

En la cabecera eliges **qué cuentas ver**: una sola (para operar), varias o todas a la vez (el Dashboard suma balances y colchones y
muestra un chip por cuenta; Trades, Calendario, Reportes y Lab filtran igual).

- *(fuera del menú, en `#plan`)* **Plan del día** — semáforo (`PUEDES OPERAR` / `ESCRIBE LA CONDICIÓN` / `SE ACABÓ EL DÍA` / `META HECHA`),
  colchón real, riesgo de hoy, contratos que te tocan, meta del día, la condición con sus dos ramas y la rutina
  por horario (la apertura de NY se calcula sola según el horario de verano).
- **Dashboard** — el tablero tipo TradeZella: P&L, win rate, profit factor, días ganadores, curva de balance
  contra el piso, **Puntaje NP** (salud del proceso, no del P&L) y **Estrategias**: el rendimiento de cada una (n, win, PF,
  expectativa, P&L). Cada trade se registra con su estrategia; la lista se edita en Ajustes o con «+ nueva» desde el formulario.
- **Registrar trade** — primero la **batería**: diez celdas, cada trade real gasta una (las usadas se ven verdes/rojas, la siguiente
  pulsa), y arriba en grande el **win rate de las últimas diez** con el mínimo de 40% (equilibrio a 1.5R); debajo de 40% avisa que
  revises antes de gastar otra. Tocas la siguiente celda y sale el formulario rápido: dirección, P&L (o entrada/salida y se calcula), **las 4 reglas como cuatro botones**,
  **screenshot** (pega con ⌘V, arrastra o clic; se guarda comprimido en IndexedDB) y notas. Lo demás plegado en «Más detalles».
- **Trades** — todos los trades, filtrables por resultado y por disciplina (4/4 reglas vs reglas rotas). Exporta CSV.
  Al abrir un trade sale **el formulario de siempre** (la ficha-primero se probó y se quitó: «déjalo como el panel de log trade»);
  en su pie hay **⤓ PDF**: un reporte A4 del trade hecho sin librerías (`js/pdf.js`: Helvetica, tabla de 12 datos, las 4 reglas,
  condición, PDA, errores, notas y el screenshot como JPEG; en la app nativa se guarda con NSSavePanel vía `cmd:'guardar'`, en
  navegador se descarga). La ficha PNG sigue disponible por código (`Ficha.dibujaTrade`), generada sola con los datos del trade
  (`Ficha.dibujaTrade`, PNG 1080×1350) con **toda la información del trade**: cuenta y fase, pills (LARGO/CORTO, instrumento
  × contratos, estrategia, real/backtest), P&L en grande + balance después + % de la cuenta + R, rejilla de 12 datos (entrada,
  salida, stop, take profit, puntos, riesgo $, comisión, bruto, sesión, tipo, TP a liquidez interna/externa, confluencias), las 4
  reglas con ✓/✗ y la disciplina, condición + PDA + objetivo, errores, el screenshot si lo pegaste y las notas. Desde la ficha:
  **Editar** (abre el formulario), **PNG** y **Compartir**.
- **Calendario** — cabecera limpia para pantalla completa: solo el mes en grande, el P&L del mes, la leyenda de fases (EVAL +$1,000 /
  −$2,000 · FUNDED +$200 / −$500) y la cuenta; se quitaron el balance grande de arriba, la línea «Calendario · cuenta · fase →
  target…» y el texto de ayuda de abajo. Los días futuros sí muestran (él lo pidió de vuelta) la píldora EVAL/FUNDED, «target +$ ·
  daily loss −$», los hitos y las noticias USD con su escenario (alto → cortos · bajo → largos).
  Antes: la cuenta (ganancia desde el inicial, colchón, piso, el mes y el anillo hacia
  objetivo/buffer); debajo el mes con el P&L de cada día. Clic en un **día pasado**: la **ficha oficial del día** (`js/ficha.js`, PNG
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
- **Backtesting** — arriba, el **backtest automático de la estrategia** (`js/backtest.js`): con las velas de 5 min de NQ de los
  últimos 60 días (`data/nq5m.json`, la baja el workflow cada hora; en la app nativa, de Yahoo directo) recorre día por día la
  condición del FVG de apertura (9:35–9:45) → dirección → continuación en el 0.705 → stop tras el origen → TP interno, con 1 % de
  riesgo, máx 2 trades, «if W → fuera» y 2 pérdidas → fuera; da total, trades, win rate, R promedio, profit factor, mejor/peor día,
  máximo drawdown de la curva, la curva y el día por día; variantes: sin «if W fuera», TP a 2R, TP a 1R. Debajo, el backtesting
  manual de siempre. Backtesting manual — selector de **estrategia** arriba (todas o una), KPIs, curva en **R** (no en dólares) y la tabla de trades.
  Cada trade de backtest lleva su estrategia desde el formulario.
- **Cuentas** — la flota. Balance, colchón contra el piso, días válidos, consistencia, y el botón
  **Pasar a fondeada** cuando pasas la evaluación (crea la cuenta nueva con las reglas del plan fondeado y archiva la eval).
- **Payouts** — buffer, cuánto puedes pedir hoy, qué te falta para poder cobrar, el contador de retiros para las cuentas que
  mueren al quinto, y el **progreso de cada cuenta** en tres tramos: EVALUACIÓN → BUFFER → PAYOUTS.
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
  alto y medio, hora de Morelia, «HOY», próxima noticia fuerte con ventana de no-operar). Se muestra en **tabla estilo Forex Factory** (día, hora, divisa, cuadrito de impacto rojo/naranja, evento, real, pronóstico, previo) y
  arriba de todo va la **Vela de 4H · Open → Manipulación → Distribución** (`po3` en mercado.js, también en el Dashboard): las
  velas de 5 min de la 4H previa y la actual (bloques 18·22·02·06·10·14 NY) con OPEN, MANIPULACIÓN, AHORA, el high/low previo,
  la fase leída (OPEN / MANIPULACIÓN ? / DISTRIBUCIÓN ▲▼), si ya rompió el break y el FVG de 5m de la expansión con su estado;
  debajo va el **Resumen de la noche** (`Mercado.noche`): high y low de **Asia** (18:00–02:00 NY), **Londres**
  (02:00–08:30 NY) y **Pre-NY** (08:30–09:30 NY) para NQ y ES, sacados de las velas de 5 min de Yahoo (`range=2d`), con «vivo» o
  «tomado» según lo que pasó después, el rango y dónde está el precio; en fin de semana enseña la última noche real. Se ve **en
  gráfica** (`graficaNoche`, SVG): la línea del precio desde que abre Asia, una caja por sesión del low al high, los niveles
  extendidos a la derecha (verde/rosa vivos, gris tachado si ya se tomaron), la marca de NY 9:30 y el precio de ahora. Sustituye al
  aviso de «próxima noticia fuerte USD», que se quitó. Cada noticia se abre con su ficha: qué mide,
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
- **Perfil y temas**: Ajustes → nombre, iniciales/foto, ciudad, frase (el perfil va hasta abajo del menú) y los temas: **Glass Oscuro** (de fábrica: minimal glassmorphism,
  negro + azul suave, esferas desenfocadas de fondo, Inter 500), **Glass Claro** (blanco, clean · calm · clear), Lima, **Bosque** (#051F20→#8EB69B),
  **Diamante** (`glass-diamante`: dark liquid glass animado —blobs que se mueven, red de cristal y destello que barre en CSS— más
  cristales de diamante flotando en el canvas de `fondo.js`, bordes blancos brillantes, verde fosfo #39FF14 en positivo y rosa
  fosfo #FF2E63 en negativo con glow, botón principal blanco; y el copy «rich diamonds» de `Tema.voz`: toasts «💎 RICH · +$215 ·
  DIAMOND HANDS», semáforo «GANASTE · RICH · DIAMOND HANDS», Resumen «RICH DIAMONDS»… solo en ese tema) y su familia **RICH**
  (`Tema.RICH`, atributo `data-rich` en `<html>`, mismas reglas de vidrio en `[data-rich]` con tokens y blobs por tema): **Lingotes**
  (`glass-oro`, lingotes de oro flotando, voz GOLD), **Billetes** (`glass-billetes`, lluvia de billetes de $100, voz CASH / MONEY
  PRINTER), **Esmeralda** (`glass-esmeralda`, cristales verdes, voz EMERALD), **Platino** (`glass-platino`, lingotes de platino, voz
  PLATINUM) y **Bitcoin** (`glass-btc`, monedas ₿, voz STACK SATS / HODL); los objetos se dibujan en `fondo.js` (`gema`, `lingote`,
  `billete`, `moneda`), **Océano** (#021024→#7DA0CA), **Noche** (navy + azul + ámbar), Blanco, Oro, Papel, Cobalto y los Aurora. Base del rediseño: tarjetas 22px,
  botones **liquid glass** en pastilla (brillo superior, sombra interior), anillos de progreso en los KPIs, Inter en todo.
- **Riesgo** — arriba los **parámetros** (cuenta inicial, objetivo de eval, buffer, tope por retiro, retiros máximos, split, TP y
  riesgo por día en eval y en funded, win rate por día, dónde se quema) y todo se recalcula solo; **la canica**: una vida simulada
  con esas probabilidades desde la eval hasta donde le alcance la suerte (ruta con hitos: PASAS, BUFFER, COBRAS #n, QUEMADA) y
  1,000 canicas para ver qué % pasa, llega al buffer, cobra o concluye; y las **pirámides** de decisión por etapa como en su
  libreta (WIN a la izquierda, LOSS a la derecha, terminales verdes y X rojas) con el camino de la última canica resaltado.
- **Trading** (`#trading`, fuera del menú): en la app de escritorio, **Tradovate** (trader.tradovate.com) o **TradingView completo** se abren **dentro de la
  vista**, con tu login guardado: tus cuentas de fondeo, posiciones y órdenes ahí mismo (un WKWebView colocado sobre el hueco de la
  vista). En navegador ninguno se deja embeber: botón para abrirlos en pestaña, o el «chart rápido» (widget gratis de TradingView).

## Perfiles

Al abrir, la app pregunta **quién entra**: cada persona crea su perfil (nombre y PIN opcional) y todo lo suyo —cuentas, trades,
ajustes, tema— se guarda bajo su perfil (`localStorage` `mesa.v1.<id>`; la lista vive en `np.perfiles`). Varias personas pueden
usar la misma computadora sin mezclar nada; «Cambiar de perfil» está en Ajustes → Perfil. Los datos viejos sin perfil se
convierten solos en el primer perfil.

## App de escritorio (Windows)

`desktop-win/` es la misma web envuelta en **Electron** con el mismo puente nativo que la de Mac (`preload.js` expone
`window.webkit.messageHandlers.np`; `main.js` resuelve `fetch` sin CORS, guardar PNG/PDF, carpeta vigilada de CSV, notificaciones,
abrir links y Tradovate/TradingView embebidos en un BrowserView). Se construye desde la Mac con `npm run dist:win` (electron-builder,
NSIS + portable, sin firma). Descarga: **https://github.com/studioamr/northpoint-journal/releases/latest** →
`NORTHPOINT-Setup-1.0.2.exe` (instalador) o `NORTHPOINT-Portable-1.0.2.exe` (sin instalar). Windows avisará que el editor es
desconocido (no está firmado): «Más información → Ejecutar de todas formas». Cada persona crea su perfil y sus cuentas; los datos
viven en su PC.

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
