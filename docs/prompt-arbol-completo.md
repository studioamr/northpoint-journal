# Prompt · El árbol completo (pizarrón interactivo de riesgo por fases de prop firm)

Eres un ingeniero front-end senior. Construye una página web de un solo archivo (HTML + CSS + JavaScript vanilla, sin frameworks ni dependencias externas) que dibuje **el árbol de decisión completo de una cuenta de fondeo (prop firm) desde el examen (EVAL) hasta cobrar el primer payout**, sobre un **pizarrón infinito** que el usuario pueda arrastrar y acercar/alejar. La página debe recalcular todo sola cuando el usuario cambie cualquier parámetro. Entrega el código completo, funcional y comentado, listo para abrir en un navegador.

## 1. Contexto de negocio

El usuario opera cuentas de fondeo de futuros (Micro Nasdaq, MNQ). Cada cuenta pasa por tres etapas, y cada etapa tiene su propia regla de riesgo por día:

- **EVAL (examen)**: arranca en el balance inicial (por defecto $50,000). Cada día ganado suma el TP del día (por defecto **+$1,100**). Cada día perdido pierde el drawdown completo (por defecto **−$2,000**), lo que **quema la cuenta** ese mismo día: en eval **un solo mal día = X**. Se pasa el examen al tocar `inicial + objetivo` (por defecto **$53,000**, es decir 3 días ganados).
- **FUNDED · BUFFER**: al pasar, la cuenta fondeada arranca de nuevo en el inicial ($50,000). Cada día ganado **+$200**, cada día perdido **−$500**. Se quema al tocar `inicial − drawdown` (**$48,000**, es decir **4 malos días**). El objetivo de esta etapa es construir el **buffer** (`inicial + 2,100 = $52,100`).
- **PAYOUTS**: arranca en el buffer ($52,100). Cada día ganado **+$200**, cada día perdido **−$250**. Se quema al tocar `buffer − drawdown` (**$50,100**, es decir **8 malos días**). Se **cobra** al tocar `buffer + tope` (tope por retiro por defecto **$1,000** → **$53,100**); el retiro paga `tope × split` (split por defecto 90 % → $900) y el balance vuelve al buffer. La cuenta concluye al llegar al número máximo de retiros (por defecto 5).

La idea central que debe transmitir el dibujo: **el chiste es empezar en la eval y llegar a cobrar un payout sin quemar la cuenta antes**.

## 2. Parámetros (panel arriba, todos editables, con estos valores por defecto)

| clave | etiqueta | default |
|---|---|---|
| inicial | Cuenta inicial ($) | 50000 |
| objetivo | Objetivo eval ($, sobre el inicial) | 3000 |
| buffer | Buffer ($, sobre el inicial) | 2100 |
| tope | Tope por retiro ($) | 1000 |
| maxPagos | Retiros máximos | 5 |
| split | Split (%) | 90 |
| quema | Drawdown ($): se quema a inicial − quema (y en payouts a buffer − quema) | 2000 |
| evalTP | Eval · TP por día ($) | 1100 |
| evalLoss | Eval · riesgo por día ($) | 2000 |
| fondTP | Funded · TP por día ($) | 200 |
| fondLoss | Buffer · riesgo por día ($) | 500 |
| payLoss | Payouts · riesgo por día ($) | 250 |
| winRate | Win rate por día (%) | 60 |
| prof | Niveles de profundidad de la parte fondeada | 6 |

Muestra también, calculado: R:R de cada etapa (TP / riesgo), cuántos malos días aguanta cada etapa (`quema / riesgo`), y guarda los parámetros en `localStorage` para que persistan. Botón «valores por defecto».

## 3. El árbol (estructura de datos)

Árbol binario que **empieza en un solo recuadro** (el balance inicial, fase eval) y **cada recuadro abre en dos**: rama **WIN a la izquierda** (verde) y rama **LOSS a la derecha** (roja). Reglas de transición, aplicadas al construir cada hijo:

```
nodo = { d (profundidad/día), bal (balance), fase: 'eval'|'fund'|'pay', hito: null|'X'|'PASAS'|'BUFFER'|'COBRAS', hijos: [] }

hijoWIN:
  eval: bal + evalTP; si >= inicial + objetivo → hito PASAS (y desde ahí la MISMA rama sigue como fase 'fund' con bal = inicial)
  fund: bal + fondTP;  si >= inicial + buffer  → hito BUFFER (y la rama sigue como fase 'pay')
  pay : bal + fondTP;  si >= inicial + buffer + tope → hito COBRAS (hoja: meta alcanzada)
hijoLOSS:
  eval: siempre X (bal mostrado = inicial − quema)                      ← 1 mal día y pierdes
  fund: max(inicial − quema, bal − fondLoss); si <= inicial − quema → X   ← 4 malos días
  pay : max(buffer − quema, bal − payLoss);  si <= buffer − quema   → X   ← 8 malos días
```

Las hojas son X (quemada) y COBRAS (meta). PASAS y BUFFER **no** son hojas: la rama continúa. La profundidad total es `ceil(objetivo/evalTP) + prof` (con defaults: 3 + 6 = 9 días). Los nodos X no se expanden. Muestra en la cabecera cuántos recuadros tiene el árbol.

## 4. Layout (muy importante: que no explote ni se corte)

- Usa **tidy tree**: el ancho de cada nodo es el número de hojas de su subárbol; los hijos se colocan de izquierda a derecha por hojas acumuladas y el padre se centra sobre ellos. **No** uses posiciones por `2^profundidad` (con 9 niveles eso da 512 columnas aunque casi todas estén vacías y el SVG deja de renderizar por tamaño).
- Columna de hoja: ~78 px; separación vertical entre días: ~82 px. Recuadros redondeados (pill) de 22 px de alto con el balance en tipografía monoespaciada de 9.5 px; el ancho del recuadro se adapta al texto (máximo 190 px).
- Todo se dibuja en **un solo `<svg>`** con su ancho y alto reales, dentro de un lienzo (`div.lienzo`) posicionado con `transform: translate(tx, ty) scale(esc)`.

## 5. El pizarrón (interacción)

- Contenedor de 72 vh de alto con fondo de cuadrícula tenue (líneas cada 40 px), `overflow: hidden`, cursor `grab`/`grabbing`.
- **Arrastrar** con el mouse (mousedown/mousemove/mouseup) mueve el lienzo (tx, ty).
- **Rueda / trackpad** mueve el lienzo (deltaX/deltaY). **Ctrl+rueda o pellizco** hace zoom alrededor del cursor (factor 1.12 por paso, límites 0.08–3).
- Botones: **−**, **+** (zoom al centro), **centrar** (raíz arriba al centro con escala que quepa ~1,400 px de ancho), **− raíces / + raíces** (prof entre 3 y 9, se guarda).
- Al cambiar cualquier parámetro se reconstruye el árbol y se vuelve a centrar.
- Debe seguir fluido con 1,000–3,000 recuadros (usa strings de SVG concatenados y un solo `innerHTML`, no crees nodos uno por uno).

## 6. Estética

- Tema oscuro tipo glassmorphism: fondo #0a0d14, tarjetas con `rgba(255,255,255,.05)` y borde `rgba(255,255,255,.1)`, radios de 14–22 px, tipografía Inter para texto y JetBrains Mono para números.
- Colores: eval azul #4F8CFF, buffer rojo #FF4D5A, payouts amarillo #FFD54A (color del borde/texto del recuadro según la fase); ramas WIN verde #6FCF97, LOSS rojo #F07C8A; hitos PASAS/BUFFER/COBRAS con fondo verde translúcido y texto verde; X con fondo rojo translúcido y texto rojo.
- Etiquetas «WIN +$1,100» / «LOSS −$2,000» solo en la raíz y en los nodos PASAS y BUFFER (donde cambian los montos), para no saturar.
- Nada de animaciones. Leyenda de colores debajo de la cabecera.

## 7. Extra opcional (si sobra tiempo): la canica

Un botón «Soltar una canica» simula UNA vida con `winRate`: día a día decide WIN/LOSS al azar, aplica las reglas de la fase, cobra al tocar `buffer + tope` (el balance vuelve al buffer), y termina al quemar o al llegar a `maxPagos`. Resalta en el árbol el camino de los primeros días y muestra el resultado: fin (quemada en eval / buffer / payouts, o cuenta concluida), días vividos, retiros y dinero cobrado. Otro botón «1,000 canicas» reporta % que pasan la eval, % que llegan al buffer, % que cobran al menos una vez, retiros promedio y cobrado promedio.

## 8. Criterios de aceptación

1. Con los defaults, la raíz dice `50,000`; su hijo WIN `51,100`, su hijo LOSS `X 48,000`; a los 3 wins aparece `PASAS → FUNDED 50,000` y la rama sigue con `50,200 / 49,500`.
2. En la parte fondeada ningún recuadro muestra un balance menor a `48,000`; en payouts ninguno menor a `50,100`.
3. Al tocar `52,100` aparece `BUFFER 52,100` y la rama continúa con pérdidas de `−250`; al tocar `53,100` aparece `COBRAS +$900` y esa rama termina.
4. El árbol completo cabe en el pizarrón sin cortarse: se puede arrastrar hasta cualquier hoja y hacer zoom para leer cualquier balance.
5. Cambiar `evalTP` a 1,000 hace que la eval necesite 3 días igual (3,000/1,000) y cambiar `objetivo` a 4,000 la alarga a 4; cambiar `fondLoss` a 1,000 hace que el buffer se queme en 2 malos días.
6. Sin errores en consola; funciona abriendo el archivo `.html` directamente.
