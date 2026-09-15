/* ============================================================================
   NORTHPOINT — JARDÍN SAKURA: el paisaje detrás de la app, con sus colores de verdad.
   De arriba abajo: cielo azul → montañas con los picos nevados → laderas de pinos →
   acantilados con cascadas → el río → el puente → la orilla con pasto y rocas.
   Encima: pájaros, mariposas, koi y los pétalos del cerezo.
   Lo que no se mueve se pinta UNA vez en un lienzo aparte y se estampa cada cuadro.
   ========================================================================= */
window.Jardin = (function(){
  let cache = null, cacheW = 0, cacheH = 0;
  const semilla = s => () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let rnd = semilla(20260915);

  /* alturas del paisaje, en fracción del alto */
  const Y = {lejos:0.44, medio:0.555, ladera:0.645, rio:0.775, orilla:0.865};
  const CAIDAS = [{x:0.735, w:0.017, y0:0.585, y1:0.775}, {x:0.865, w:0.011, y0:0.625, y1:0.775}, {x:0.205, w:0.009, y0:0.645, y1:0.775}];
  const ROCAS  = [{x:0.05,y:0.055,s:0.019,rot:0.2},{x:0.29,y:0.082,s:0.026,rot:-0.3},{x:0.46,y:0.042,s:0.015,rot:0.5},
                  {x:0.62,y:0.092,s:0.031,rot:0.1},{x:0.79,y:0.058,s:0.021,rot:-0.2},{x:0.94,y:0.098,s:0.028,rot:0.4}];

  const cresta = (W, base, amp, s) => x => {
    const u = x / W;
    return base - amp * (0.55*Math.sin(u*6.1 + s) + 0.3*Math.sin(u*13.7 + s*2.3) + 0.15*Math.sin(u*27.3 + s*4.1) + 0.5);
  };
  function silueta(c, W, H, f, color){
    c.beginPath(); c.moveTo(0, H);
    for(let x = 0; x <= W; x += Math.max(2, W/300)) c.lineTo(x, f(x));
    c.lineTo(W, H); c.closePath(); c.fillStyle = color; c.fill();
  }

  /* ------------------------------------------------------------ el paisaje quieto */
  function estatico(W, H){
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    rnd = semilla(20260915);

    // ---- cielo
    const cielo = c.createLinearGradient(0, 0, 0, H*Y.medio);
    cielo.addColorStop(0, '#3F8FD0'); cielo.addColorStop(.55, '#84BFE4'); cielo.addColorStop(1, '#D2E7F3');
    c.fillStyle = cielo; c.fillRect(0, 0, W, H*Y.medio + 2);
    for(let i = 0; i < 7; i++){                                                  // nubes largas y planas
      const x = rnd()*W, y = H*(0.06 + rnd()*0.22), w = W*(0.10 + rnd()*0.16), h = H*(0.008 + rnd()*0.012);
      const g = c.createLinearGradient(0, y-h, 0, y+h);
      g.addColorStop(0, 'rgba(255,255,255,.62)'); g.addColorStop(1, 'rgba(255,255,255,.18)');
      c.fillStyle = g; c.beginPath(); c.ellipse(x, y, w, h, 0, 0, Math.PI*2); c.fill();
    }

    // ---- montañas lejanas CON NIEVE: se recorta la silueta y se pinta blanco arriba de la cota
    const fLejos = cresta(W, H*Y.lejos, H*0.135, 1.7);
    c.save(); c.beginPath(); c.moveTo(0, H);
    for(let x = 0; x <= W; x += Math.max(2, W/300)) c.lineTo(x, fLejos(x));
    c.lineTo(W, H); c.closePath(); c.clip();
    const roca = c.createLinearGradient(0, H*0.30, 0, H*Y.medio);
    roca.addColorStop(0, '#7B95B6'); roca.addColorStop(1, '#5A7599');
    c.fillStyle = roca; c.fillRect(0, 0, W, H);
    const cota = H*Y.lejos - H*0.055;                                            // la cota de nieve
    c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0);
    for(let x = W; x >= 0; x -= Math.max(2, W/300)) c.lineTo(x, cota + H*0.012*Math.sin(x/W*22) + H*0.006*Math.sin(x/W*57));
    c.closePath();
    const nieve = c.createLinearGradient(0, H*0.24, 0, cota);
    nieve.addColorStop(0, '#FFFFFF'); nieve.addColorStop(1, '#E4F0F8');
    c.fillStyle = nieve; c.fill();
    c.restore();
    c.fillStyle = 'rgba(214,234,246,.16)'; c.fillRect(0, H*0.40, W, H*0.14);      // bruma que las separa

    // ---- montañas de en medio, verdes
    silueta(c, W, H, cresta(W, H*Y.medio, H*0.075, 4.2), '#3F6F5E');
    c.fillStyle = 'rgba(214,234,246,.10)'; c.fillRect(0, H*0.50, W, H*0.12);

    // ---- laderas con pinos
    const fLad = cresta(W, H*Y.ladera, H*0.05, 9.1);
    silueta(c, W, H, fLad, '#2F5C42');
    for(let i = 0; i < 90; i++){                                                 // el bosque de la ladera
      const x = rnd()*W, y = fLad(x) + rnd()*H*0.07, s = H*(0.012 + rnd()*0.022);
      pino(c, x, y, s, rnd() < .5 ? '#22452F' : '#2A5138');
    }

    // ---- acantiladoss de las cascadas
    CAIDAS.forEach(f => {
      const x = f.x*W, w = f.w*W;
      c.beginPath(); c.moveTo(x - w*2.0, H*Y.rio); c.lineTo(x - w*1.25, H*f.y0);
      c.lineTo(x + w*1.25, H*f.y0); c.lineTo(x + w*2.2, H*Y.rio); c.closePath();
      const g = c.createLinearGradient(x - w*2, 0, x + w*2, 0);
      g.addColorStop(0, '#5A636E'); g.addColorStop(.5, '#7A838E'); g.addColorStop(1, '#565F6A');
      c.fillStyle = g; c.fill();
    });

    // ---- el río
    const agua = c.createLinearGradient(0, H*Y.rio, 0, H*Y.orilla);
    agua.addColorStop(0, '#3FA6BB'); agua.addColorStop(.6, '#2A86A0'); agua.addColorStop(1, '#1E6A84');
    c.fillStyle = agua; c.fillRect(0, H*Y.rio, W, H*(Y.orilla - Y.rio) + 2);

    // ---- el cerezo entra por las dos esquinas de arriba
    rama(c, W, H, -W*0.04, -H*0.03, 1);
    rama(c, W, H, W*1.04, -H*0.05, -1);

    // ---- orilla de pasto
    const suelo = H*Y.orilla;
    c.beginPath(); c.moveTo(0, H);
    for(let x = 0; x <= W; x += Math.max(2, W/200)) c.lineTo(x, suelo + H*0.016*Math.sin(x/W*7.3 + 2.1) + H*0.007*Math.sin(x/W*19 + 5.5));
    c.lineTo(W, H); c.closePath();
    const g2 = c.createLinearGradient(0, suelo, 0, H);
    g2.addColorStop(0, '#5E9E51'); g2.addColorStop(.5, '#4A8342'); g2.addColorStop(1, '#2F5B30');
    c.fillStyle = g2; c.fill();

    // ---- rocas con musgo
    ROCAS.forEach(r => {
      const x = r.x*W, y = suelo + r.y*H, s = r.s*H;
      c.beginPath(); c.ellipse(x, y, s*1.5, s, r.rot, 0, Math.PI*2);
      const gr = c.createLinearGradient(x, y - s, x, y + s);
      gr.addColorStop(0, '#8B939C'); gr.addColorStop(1, '#5E666F');
      c.fillStyle = gr; c.fill();
      c.beginPath(); c.ellipse(x - s*0.22, y - s*0.45, s*0.9, s*0.3, r.rot, Math.PI, Math.PI*2);
      c.fillStyle = 'rgba(94,155,74,.58)'; c.fill();
    });

    // ---- puente de madera sobre el río
    puente(c, W*0.10, H*Y.rio + H*0.012, W*0.28, H*0.05);

    // ---- pasto
    for(let i = 0; i < 260; i++){
      const x = rnd()*W, y = suelo + rnd()*H*0.05, h = H*(0.008 + rnd()*0.018), inc = (rnd()-.5)*H*0.012;
      c.strokeStyle = rnd() < .5 ? 'rgba(126,186,96,.55)' : 'rgba(58,110,58,.5)';
      c.lineWidth = Math.max(1, H*0.0016);
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + inc*0.5, y - h*0.6, x + inc, y - h); c.stroke();
    }
    return cv;
  }

  function pino(c, x, y, s, col){
    c.fillStyle = col;
    c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s*0.34, y); c.lineTo(x - s*0.34, y); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(x, y - s*1.5); c.lineTo(x + s*0.26, y - s*0.55); c.lineTo(x - s*0.26, y - s*0.55); c.closePath(); c.fill();
  }

  /* rama de cerezo: tronco café, flor rosa */
  function rama(c, W, H, x0, y0, dir){
    c.save(); c.strokeStyle = '#4A3026'; c.lineCap = 'round';
    c.lineWidth = H*0.018; c.beginPath(); c.moveTo(x0, y0);
    c.bezierCurveTo(x0 + dir*W*0.16, H*0.06, x0 + dir*W*0.34, H*0.04, x0 + dir*W*0.52, H*0.11); c.stroke();
    for(let i = 0; i < 7; i++){
      const u = 0.15 + i*0.12, bx = x0 + dir*W*0.52*u, by = H*(0.02 + u*0.10);
      c.lineWidth = H*0.006*(1 - u*0.5); c.beginPath(); c.moveTo(bx, by);
      c.quadraticCurveTo(bx + dir*W*0.04, by + H*0.05, bx + dir*W*0.02*(i%2?1:-1), by + H*0.10); c.stroke();
    }
    for(let i = 0; i < 80; i++){                                                 // masas de flor
      const u = rnd(), bx = x0 + dir*W*(0.02 + u*0.56) + (rnd()-.5)*W*0.07;
      const by = H*(0.005 + u*0.11) + rnd()*H*0.09;
      const s = H*(0.008 + rnd()*0.022), a = 0.30 + rnd()*0.35;
      c.beginPath(); c.ellipse(bx, by, s*1.35, s, rnd()*3, 0, Math.PI*2);
      c.fillStyle = `rgba(255,${160 + rnd()*55|0},200,${a})`; c.fill();
    }
    for(let i = 0; i < 22; i++){
      const u = rnd(), fx = x0 + dir*W*(0.03 + u*0.54) + (rnd()-.5)*W*0.06, fy = H*(0.01 + u*0.10) + rnd()*H*0.085;
      flor(c, fx, fy, H*(0.004 + rnd()*0.004), 0.75 + rnd()*0.25);
    }
    c.restore();
  }
  function flor(c, x, y, s, a){
    c.save(); c.translate(x, y); c.rotate(rnd()*3);
    for(let p = 0; p < 5; p++){
      c.rotate(Math.PI*2/5);
      c.beginPath(); c.ellipse(0, -s*1.1, s*0.62, s*1.1, 0, 0, Math.PI*2);
      c.fillStyle = `rgba(255,${180 + rnd()*40|0},214,${a})`; c.fill();
    }
    c.beginPath(); c.arc(0, 0, s*0.4, 0, Math.PI*2); c.fillStyle = `rgba(255,228,150,${a})`; c.fill();
    c.restore();
  }

  function puente(c, x, y, w, alto){
    c.save();
    const arco = u => y - alto*Math.sin(u*Math.PI)*0.75;
    c.beginPath(); c.moveTo(x, arco(0));
    for(let u = 0; u <= 1.001; u += 0.02) c.lineTo(x + w*u, arco(u));
    for(let u = 1; u >= -0.001; u -= 0.02) c.lineTo(x + w*u, arco(u) + alto*0.30);
    c.closePath(); c.fillStyle = '#9A5C3A'; c.fill();
    c.strokeStyle = '#6E3F26'; c.lineWidth = Math.max(1, alto*0.06);
    for(let u = 0; u <= 1.001; u += 0.055){ c.beginPath(); c.moveTo(x + w*u, arco(u)); c.lineTo(x + w*u, arco(u) + alto*0.30); c.stroke(); }
    c.strokeStyle = '#7A4428'; c.lineWidth = Math.max(1, alto*0.07);
    for(let u = 0.06; u <= 0.95; u += 0.11){ c.beginPath(); c.moveTo(x + w*u, arco(u)); c.lineTo(x + w*u, arco(u) - alto*0.42); c.stroke(); }
    c.beginPath(); c.moveTo(x, arco(0) - alto*0.42);
    for(let u = 0; u <= 1.001; u += 0.02) c.lineTo(x + w*u, arco(u) - alto*0.42);
    c.stroke(); c.restore();
  }

  /* ------------------------------------------------------------ lo que se mueve */
  const PAJAROS = [], MARIPOSAS = [], KOI = [];
  function pobla(W, H){
    PAJAROS.length = 0; MARIPOSAS.length = 0; KOI.length = 0;
    for(let i = 0; i < 5; i++) PAJAROS.push({x: rnd()*W, y: H*(0.12 + rnd()*0.22), v: (0.10 + rnd()*0.16)*(rnd() < .5 ? 1 : -1), s: H*(0.006 + rnd()*0.006), f: rnd()*6});
    for(let i = 0; i < 9; i++)  MARIPOSAS.push({x: rnd()*W, y: H*(0.80 + rnd()*0.18), f: rnd()*6.28, r: H*(0.03 + rnd()*0.06), s: H*(0.004 + rnd()*0.003), col: rnd() < .5 ? '255,248,220' : '255,214,120'});
    for(let i = 0; i < 4; i++)  KOI.push({x: rnd()*W, y: H*(Y.rio + 0.02 + rnd()*0.06), v: (0.05 + rnd()*0.07)*(rnd() < .5 ? 1 : -1), s: H*(0.009 + rnd()*0.007), f: rnd()*6});
  }

  function cascadas(c, W, H, t){
    CAIDAS.forEach((f, k) => {
      const x = f.x*W, w = f.w*W, y0 = f.y0*H, y1 = f.y1*H, alto = y1 - y0;
      const g = c.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, 'rgba(240,252,255,.92)'); g.addColorStop(.7, 'rgba(214,242,250,.72)'); g.addColorStop(1, 'rgba(198,235,246,.45)');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(x - w, y0); c.lineTo(x + w, y0); c.lineTo(x + w*1.35, y1); c.lineTo(x - w*1.35, y1); c.closePath(); c.fill();
      c.save(); c.clip();
      for(let i = 0; i < 6; i++){
        const vel = 0.30 + ((i*7 + k*3) % 5) * 0.10;
        const y = y0 + ((t*vel + i*alto/6) % alto), lar = alto*(0.12 + (i%3)*0.05);
        const ex = x + Math.sin(i*2.1 + k) * w*0.5;
        const gg = c.createLinearGradient(0, y, 0, y + lar);
        gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(.5, 'rgba(255,255,255,.85)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = gg; c.fillRect(ex - w*0.18, y, w*0.36, lar);
      }
      c.restore();
      const esp = 0.30 + 0.12*Math.sin(t*0.0012 + k*2);                          // espuma donde pega el agua
      c.beginPath(); c.ellipse(x, y1, w*2.6, alto*0.05, 0, 0, Math.PI*2);
      c.fillStyle = `rgba(255,255,255,${esp})`; c.fill();
    });
  }

  function rio(c, W, H, t){
    for(let i = 0; i < 9; i++){                                                  // brillos que corren con la corriente
      const y = H*Y.rio + H*0.008 + i*H*0.010, a = 0.10 + 0.07*Math.sin(t*0.0009 + i);
      const w = W*(0.08 + 0.06*Math.sin(t*0.0005 + i*1.7));
      c.fillStyle = `rgba(226,248,255,${a})`;
      c.fillRect((W*0.5 + Math.sin(t*0.00034 + i*2.2)*W*0.36) - w/2, y, w, Math.max(1, H*0.0022));
    }
    KOI.forEach(k => {
      k.x += k.v * devicePixelRatio; if(k.x < -W*0.1) k.x = W*1.1; if(k.x > W*1.1) k.x = -W*0.1;
      const on = 0.5 + 0.12*Math.sin(t*0.0016 + k.f);
      c.save(); c.translate(k.x, k.y + Math.sin(t*0.0011 + k.f)*H*0.004); c.scale(k.v > 0 ? 1 : -1, 1);
      c.beginPath(); c.ellipse(0, 0, k.s*2.1, k.s*0.7, 0, 0, Math.PI*2);
      c.fillStyle = `rgba(247,118,38,${on})`; c.fill();
      c.beginPath(); c.moveTo(-k.s*2, 0); c.lineTo(-k.s*3.1, -k.s*0.55); c.lineTo(-k.s*3.1, k.s*0.55); c.closePath();
      c.fillStyle = `rgba(247,118,38,${on*0.6})`; c.fill();
      c.beginPath(); c.ellipse(k.s*0.5, -k.s*0.15, k.s*0.6, k.s*0.28, 0, 0, Math.PI*2);
      c.fillStyle = `rgba(255,255,255,${on*0.7})`; c.fill(); c.restore();
    });
  }

  function fauna(c, W, H, t){
    PAJAROS.forEach(p => {
      p.x += p.v * devicePixelRatio; if(p.x < -W*0.08) p.x = W*1.08; if(p.x > W*1.08) p.x = -W*0.08;
      const al = Math.sin(t*0.006 + p.f) * 0.55;
      c.save(); c.translate(p.x, p.y + Math.sin(t*0.0009 + p.f)*H*0.006); c.scale(p.v > 0 ? 1 : -1, 1);
      c.strokeStyle = 'rgba(38,52,66,.62)'; c.lineWidth = Math.max(1, p.s*0.22); c.lineCap = 'round';
      c.beginPath(); c.moveTo(-p.s*1.6, al*p.s);
      c.quadraticCurveTo(-p.s*0.6, -p.s*0.5 + al*p.s*0.4, 0, 0);
      c.quadraticCurveTo(p.s*0.6, -p.s*0.5 + al*p.s*0.4, p.s*1.6, al*p.s); c.stroke(); c.restore();
    });
    MARIPOSAS.forEach(m => {                                                      // de día son mariposas, no luciérnagas
      const x = m.x + Math.cos(t*0.00050 + m.f)*m.r, y = m.y + Math.sin(t*0.00082 + m.f*1.7)*m.r*0.55;
      const ala = Math.abs(Math.sin(t*0.010 + m.f));
      c.save(); c.translate(x, y);
      c.fillStyle = `rgba(${m.col},.92)`;
      c.beginPath(); c.ellipse(-m.s*0.9, 0, m.s*0.9*ala + m.s*0.15, m.s*1.25, -0.3, 0, Math.PI*2); c.fill();
      c.beginPath(); c.ellipse( m.s*0.9, 0, m.s*0.9*ala + m.s*0.15, m.s*1.25,  0.3, 0, Math.PI*2); c.fill();
      c.fillStyle = 'rgba(58,44,30,.8)'; c.beginPath(); c.ellipse(0, 0, m.s*0.22, m.s*0.8, 0, 0, Math.PI*2); c.fill();
      c.restore();
    });
  }

  function pinta(c, W, H, t){
    if(!cache || cacheW !== W || cacheH !== H){ cache = estatico(W, H); cacheW = W; cacheH = H; pobla(W, H); }
    c.drawImage(cache, 0, 0);
    cascadas(c, W, H, t);
    rio(c, W, H, t);
    fauna(c, W, H, t);
  }
  return { pinta, invalida(){ cache = null; } };
})();
