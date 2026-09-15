/* ============================================================================
   NORTHPOINT — JARDÍN SAKURA: el entorno completo detrás de la app.
   Solo se dibuja con el tema Jardín Sakura. Se arma por capas, de lejos a cerca:
     montañas con niebla → cascadas cayendo → dosel del cerezo → orilla, estanque,
     rocas y puente → y encima la fauna (pájaros, luciérnagas, koi) y los pétalos.
   Lo que no se mueve se pinta UNA vez en un lienzo aparte y se estampa cada cuadro;
   solo se animan el agua, la niebla y los bichos. Así no cuesta nada.
   ========================================================================= */
window.Jardin = (function(){
  let cache = null, cacheW = 0, cacheH = 0;
  const rnd = (s => () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)(20260915);

  /* una cresta de montaña: suma de senos, siempre la misma para que no parpadee */
  function cresta(c, W, H, base, amp, semilla, color){
    c.beginPath(); c.moveTo(0, H);
    for(let x = 0; x <= W; x += Math.max(2, W/260)){
      const u = x / W;
      const y = base - amp * (0.55*Math.sin(u*6.1 + semilla) + 0.3*Math.sin(u*13.7 + semilla*2.3)
                            + 0.15*Math.sin(u*27.3 + semilla*4.1) + 0.5);
      c.lineTo(x, y);
    }
    c.lineTo(W, H); c.closePath(); c.fillStyle = color; c.fill();
  }

  /* la roca por donde cae el agua, con su poza abajo */
  function acantilado(c, x, W, H, ancho, arriba, abajo){
    c.beginPath(); c.moveTo(x - ancho*1.9, abajo);
    c.lineTo(x - ancho*1.15, arriba); c.lineTo(x + ancho*1.15, arriba); c.lineTo(x + ancho*2.1, abajo);
    c.closePath(); c.fillStyle = 'rgba(24,13,24,.92)'; c.fill();
  }

  /* ------------------------------------------------------------ lo que no se mueve */
  function estatico(W, H){
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');

    // ---- montañas: la de atrás casi disuelta en niebla, la de enfrente casi negra
    cresta(c, W, H, H*0.50, H*0.10, 1.7, 'rgba(104,68,98,.26)');
    c.fillStyle = 'rgba(255,214,232,.028)'; c.fillRect(0, H*0.40, W, H*0.22);      // banda de niebla
    cresta(c, W, H, H*0.58, H*0.09, 4.2, 'rgba(60,34,58,.50)');
    c.fillStyle = 'rgba(255,214,232,.024)'; c.fillRect(0, H*0.50, W, H*0.20);
    cresta(c, W, H, H*0.66, H*0.075, 9.1, 'rgba(44,24,44,.78)');

    // ---- tres acantilados con cascada
    CAIDAS.forEach(f => acantilado(c, f.x*W, W, H, f.w*W, f.y0*H, f.y1*H));

    // ---- dosel del cerezo: rama oscura y masas de flor en las esquinas de arriba
    rama(c, W, H, -W*0.04, -H*0.03, 1);
    rama(c, W, H, W*1.04, -H*0.05, -1);

    // ---- orilla del jardín y estanque
    const suelo = H*0.845;
    c.beginPath(); c.moveTo(0, H);
    for(let x = 0; x <= W; x += Math.max(2, W/200)){
      const u = x / W;
      c.lineTo(x, suelo + H*0.018*Math.sin(u*7.3 + 2.1) + H*0.008*Math.sin(u*19 + 5.5));
    }
    c.lineTo(W, H); c.closePath();
    const g = c.createLinearGradient(0, suelo, 0, H);
    g.addColorStop(0, 'rgba(34,18,32,.95)'); g.addColorStop(1, 'rgba(14,7,14,.99)');
    c.fillStyle = g; c.fill();

    // ---- rocas con musgo
    ROCAS.forEach(r => {
      const x = r.x*W, y = suelo + r.y*H, s = r.s*H;
      c.beginPath(); c.ellipse(x, y, s*1.5, s, r.rot, 0, Math.PI*2);
      c.fillStyle = 'rgba(52,32,48,.95)'; c.fill();
      c.beginPath(); c.ellipse(x - s*0.25, y - s*0.45, s*0.85, s*0.3, r.rot, Math.PI, Math.PI*2);
      c.fillStyle = 'rgba(106,150,112,.35)'; c.fill();                            // el musgo va arriba
    });

    // ---- puente de tablones, como el del jardín
    puente(c, W*0.115, suelo - H*0.012, W*0.30, H*0.055);

    // ---- pasto en la orilla
    c.strokeStyle = 'rgba(110,148,114,.20)'; c.lineWidth = Math.max(1, H*0.0016);
    for(let i = 0; i < 230; i++){
      const x = rnd()*W, y = suelo + rnd()*H*0.04, h = H*(0.008 + rnd()*0.016), inc = (rnd()-.5)*H*0.012;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + inc*0.5, y - h*0.6, x + inc, y - h); c.stroke();
    }
    return cv;
  }

  /* rama de cerezo que entra por una esquina de arriba */
  function rama(c, W, H, x0, y0, dir){
    c.save(); c.strokeStyle = 'rgba(28,15,26,.95)'; c.lineCap = 'round';
    const tronco = [[x0, y0], [x0 + dir*W*0.16, H*0.06], [x0 + dir*W*0.34, H*0.04], [x0 + dir*W*0.52, H*0.11]];
    c.lineWidth = H*0.018; c.beginPath(); c.moveTo(tronco[0][0], tronco[0][1]);
    c.bezierCurveTo(tronco[1][0], tronco[1][1], tronco[2][0], tronco[2][1], tronco[3][0], tronco[3][1]); c.stroke();
    for(let i = 0; i < 7; i++){                                                   // ramitas que salen del tronco
      const u = 0.15 + i*0.12, bx = x0 + dir*W*0.52*u, by = H*(0.02 + u*0.10);
      c.lineWidth = H*0.006*(1 - u*0.5); c.beginPath(); c.moveTo(bx, by);
      c.quadraticCurveTo(bx + dir*W*0.04, by + H*0.05, bx + dir*W*0.02*(i%2?1:-1), by + H*0.10); c.stroke();
    }
    // masas de flor: manchas suaves, no círculos calcados
    for(let i = 0; i < 70; i++){
      const u = rnd(), bx = x0 + dir*W*(0.02 + u*0.56) + (rnd()-.5)*W*0.07;
      const by = H*(0.005 + u*0.11) + rnd()*H*0.09;
      const s = H*(0.008 + rnd()*0.020), a = 0.07 + rnd()*0.13;
      c.beginPath(); c.ellipse(bx, by, s*1.35, s, rnd()*3, 0, Math.PI*2);
      c.fillStyle = `rgba(${240 + rnd()*15|0},${130 + rnd()*70|0},${175 + rnd()*40|0},${a})`; c.fill();
    }
    for(let i = 0; i < 16; i++){                                                  // unas cuantas flores dibujadas, para que se lean
      const u = rnd(), fx = x0 + dir*W*(0.03 + u*0.54) + (rnd()-.5)*W*0.06, fy = H*(0.01 + u*0.10) + rnd()*H*0.085;
      flor(c, fx, fy, H*(0.004 + rnd()*0.004), 0.22 + rnd()*0.22);
    }
    c.restore();
  }

  /* flor de cerezo de cinco pétalos */
  function flor(c, x, y, s, a){
    c.save(); c.translate(x, y); c.rotate(rnd()*3);
    for(let p = 0; p < 5; p++){
      c.rotate(Math.PI*2/5);
      c.beginPath(); c.ellipse(0, -s*1.1, s*0.62, s*1.1, 0, 0, Math.PI*2);
      c.fillStyle = `rgba(255,${176 + rnd()*40|0},210,${a})`; c.fill();
    }
    c.beginPath(); c.arc(0, 0, s*0.4, 0, Math.PI*2); c.fillStyle = `rgba(255,236,180,${a*1.2})`; c.fill();
    c.restore();
  }

  /* puente de tablones en silueta */
  function puente(c, x, y, w, alto){
    c.save(); c.strokeStyle = 'rgba(30,16,26,.9)'; c.fillStyle = 'rgba(38,21,33,.9)';
    const arco = u => y - alto*Math.sin(u*Math.PI)*0.75;
    c.beginPath(); c.moveTo(x, arco(0));
    for(let u = 0; u <= 1.001; u += 0.02) c.lineTo(x + w*u, arco(u));
    for(let u = 1; u >= -0.001; u -= 0.02) c.lineTo(x + w*u, arco(u) + alto*0.30);
    c.closePath(); c.fill();
    c.lineWidth = Math.max(1, alto*0.06);
    for(let u = 0; u <= 1.001; u += 0.055){                                       // tablones
      c.beginPath(); c.moveTo(x + w*u, arco(u)); c.lineTo(x + w*u, arco(u) + alto*0.30); c.stroke();
    }
    for(let u = 0.06; u <= 0.95; u += 0.11){                                      // barandal
      c.beginPath(); c.moveTo(x + w*u, arco(u)); c.lineTo(x + w*u, arco(u) - alto*0.42); c.stroke();
    }
    c.beginPath(); c.moveTo(x, arco(0) - alto*0.42);
    for(let u = 0; u <= 1.001; u += 0.02) c.lineTo(x + w*u, arco(u) - alto*0.42);
    c.stroke(); c.restore();
  }

  /* ------------------------------------------------------------ lo que sí se mueve */
  const CAIDAS = [{x:0.70, w:0.020, y0:0.545, y1:0.845}, {x:0.845, w:0.014, y0:0.60, y1:0.845}, {x:0.235, w:0.011, y0:0.625, y1:0.845}];
  const ROCAS  = [{x:0.06,y:0.055,s:0.020,rot:0.2},{x:0.30,y:0.085,s:0.028,rot:-0.3},{x:0.47,y:0.045,s:0.016,rot:0.5},
                  {x:0.63,y:0.095,s:0.034,rot:0.1},{x:0.80,y:0.060,s:0.022,rot:-0.2},{x:0.93,y:0.100,s:0.030,rot:0.4}];
  const PAJAROS = [], LUCES = [], KOI = [];
  function pobla(W, H){
    PAJAROS.length = 0; LUCES.length = 0; KOI.length = 0;
    for(let i = 0; i < 5; i++) PAJAROS.push({x: rnd()*W, y: H*(0.14 + rnd()*0.26), v: (0.10 + rnd()*0.16)*(rnd() < .5 ? 1 : -1), s: H*(0.006 + rnd()*0.007), f: rnd()*6});
    for(let i = 0; i < 14; i++) LUCES.push({x: rnd()*W, y: H*(0.72 + rnd()*0.26), f: rnd()*6.28, r: H*(0.02 + rnd()*0.05), s: H*0.0016 + rnd()*H*0.0014});
    for(let i = 0; i < 3; i++) KOI.push({x: rnd()*W, y: H*(0.90 + rnd()*0.07), v: (0.05 + rnd()*0.07)*(rnd() < .5 ? 1 : -1), s: H*(0.010 + rnd()*0.008), f: rnd()*6});
  }

  function agua(c, W, H, t){
    CAIDAS.forEach((f, k) => {
      const x = f.x*W, w = f.w*W, y0 = f.y0*H, y1 = f.y1*H, alto = y1 - y0;
      const g = c.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, 'rgba(222,235,255,.16)'); g.addColorStop(.75, 'rgba(202,222,255,.075)'); g.addColorStop(1, 'rgba(202,222,255,.02)');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(x - w, y0); c.lineTo(x + w, y0); c.lineTo(x + w*1.25, y1); c.lineTo(x - w*1.25, y1); c.closePath(); c.fill();
      c.save(); c.clip();
      for(let i = 0; i < 6; i++){                                                  // hilos de agua que bajan
        const vel = 0.24 + ((i*7 + k*3) % 5) * 0.09;
        const y = y0 + ((t*vel + i*alto/6) % alto);
        const ex = x + Math.sin(i*2.1 + k) * w*0.55, lar = alto*(0.10 + (i%3)*0.05);
        const gg = c.createLinearGradient(0, y, 0, y + lar);
        gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(.5, 'rgba(255,255,255,.13)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = gg; c.fillRect(ex - w*0.16, y, w*0.32, lar);
      }
      c.restore();
      const niebla = 0.045 + 0.022*Math.sin(t*0.0012 + k*2);                         // la bruma de la poza respira
      c.beginPath(); c.ellipse(x, y1, w*2.2, alto*0.04, 0, 0, Math.PI*2);
      c.fillStyle = `rgba(236,226,240,${niebla})`; c.fill();
    });
  }

  function estanque(c, W, H, t){
    const y = H*0.905;
    for(let i = 0; i < 7; i++){                                                    // reflejos que se estiran
      const yy = y + i*H*0.013, a = 0.05 + 0.03*Math.sin(t*0.0007 + i);
      const w = W*(0.10 + 0.07*Math.sin(t*0.0004 + i*1.7));
      c.fillStyle = `rgba(255,196,222,${a})`;
      c.fillRect(W*0.5 + Math.sin(t*0.0003 + i*2.2)*W*0.32 - w/2, yy, w, Math.max(1, H*0.0022));
    }
    KOI.forEach(k => {
      k.x += k.v * devicePixelRatio; if(k.x < -W*0.1) k.x = W*1.1; if(k.x > W*1.1) k.x = -W*0.1;
      const on = 0.13 + 0.05*Math.sin(t*0.0016 + k.f);
      c.save(); c.translate(k.x, k.y + Math.sin(t*0.0011 + k.f)*H*0.004); c.scale(k.v > 0 ? 1 : -1, 1);
      c.beginPath(); c.ellipse(0, 0, k.s*2.1, k.s*0.7, 0, 0, Math.PI*2);
      c.fillStyle = `rgba(255,140,82,${on})`; c.fill();
      c.beginPath(); c.moveTo(-k.s*2, 0); c.lineTo(-k.s*3.1, -k.s*0.55); c.lineTo(-k.s*3.1, k.s*0.55); c.closePath();
      c.fillStyle = `rgba(255,140,82,${on*0.65})`; c.fill(); c.restore();
    });
  }

  function fauna(c, W, H, t){
    PAJAROS.forEach(p => {
      p.x += p.v * devicePixelRatio; if(p.x < -W*0.08) p.x = W*1.08; if(p.x > W*1.08) p.x = -W*0.08;
      const al = Math.sin(t*0.006 + p.f) * 0.55;                                   // aleteo
      c.save(); c.translate(p.x, p.y + Math.sin(t*0.0009 + p.f)*H*0.006); c.scale(p.v > 0 ? 1 : -1, 1);
      c.strokeStyle = 'rgba(28,16,26,.5)'; c.lineWidth = Math.max(1, p.s*0.22); c.lineCap = 'round';
      c.beginPath(); c.moveTo(-p.s*1.6, al*p.s);
      c.quadraticCurveTo(-p.s*0.6, -p.s*0.5 + al*p.s*0.4, 0, 0);
      c.quadraticCurveTo(p.s*0.6, -p.s*0.5 + al*p.s*0.4, p.s*1.6, al*p.s); c.stroke(); c.restore();
    });
    LUCES.forEach(l => {                                                            // luciérnagas
      const br = 0.35 + 0.65*Math.max(0, Math.sin(t*0.0018 + l.f));
      const x = l.x + Math.cos(t*0.00042 + l.f)*l.r, y = l.y + Math.sin(t*0.00061 + l.f*1.7)*l.r*0.6;
      const g = c.createRadialGradient(x, y, 0, x, y, l.s*5);
      g.addColorStop(0, `rgba(255,236,170,${0.38*br})`); g.addColorStop(1, 'rgba(255,220,140,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, l.s*5, 0, Math.PI*2); c.fill();
      c.fillStyle = `rgba(255,248,210,${0.85*br})`; c.beginPath(); c.arc(x, y, l.s, 0, Math.PI*2); c.fill();
    });
  }

  /* ------------------------------------------------------------ cada cuadro */
  function pinta(c, W, H, t){
    c.save(); c.globalAlpha = 0.72;                                                 // es fondo: nunca le gana a la app
    if(!cache || cacheW !== W || cacheH !== H){ cache = estatico(W, H); cacheW = W; cacheH = H; pobla(W, H); }
    c.drawImage(cache, 0, 0);
    agua(c, W, H, t);
    estanque(c, W, H, t);
    fauna(c, W, H, t);
    const n = 0.016 + 0.007*Math.sin(t*0.00035);                                     // la niebla general respira
    const g = c.createLinearGradient(0, H*0.42, 0, H*0.78);
    g.addColorStop(0, `rgba(255,214,232,0)`); g.addColorStop(.5, `rgba(255,214,232,${n})`); g.addColorStop(1, 'rgba(255,214,232,0)');
    c.fillStyle = g; c.fillRect(0, H*0.42, W, H*0.36);
    c.restore();
  }
  return { pinta, invalida(){ cache = null; } };
})();
