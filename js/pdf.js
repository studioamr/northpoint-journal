/* ============================================================================
   NORTHPOINT — PDF sin librerías: reporte de un trade (A4, Helvetica, screenshot)
   ========================================================================= */
(function(){
  const {fmt, masMenos} = UI;
  const W = 595, H = 842, M = 48;
  /* texto → bytes WinAnsi (Latin-1); lo que no cabe se cambia por ASCII */
  const MAPA = {'→':'->','←':'<-','✓':'OK','✗':'X','—':'-','–':'-','“':'"','”':'"','‘':"'",'’':"'",'…':'...','₿':'BTC','▲':'^','▼':'v','◆':'*','■':'#','💎':'','🥇':'','💵':'','💚':'','⚪':''};
  function latin(s){ let o = ''; for(const ch of String(s == null ? '' : s)){ const c = ch.codePointAt(0); if(c < 256) o += ch; else o += MAPA[ch] != null ? MAPA[ch] : '?'; } return o; }
  const esc = s => latin(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  const ancho = (s, size) => latin(s).length * size * 0.52;
  function envuelve(s, size, max){ const out = []; let l = ''; String(s||'').split(/\s+/).forEach(w => { const t = l ? l + ' ' + w : w; if(ancho(t, size) > max && l){ out.push(l); l = w; } else l = t; }); if(l) out.push(l); return out; }

  function Doc(){ this.ops = []; this.imgs = []; }
  Doc.prototype.color = function(r,g,b){ this.ops.push(`${r} ${g} ${b} rg`); return this; };
  Doc.prototype.txt = function(x, y, s, size, bold, col){ if(col) this.color(...col); this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(1)} ${(H - y).toFixed(1)} Td (${esc(s)}) Tj ET`); return this; };
  Doc.prototype.txtDer = function(x, y, s, size, bold, col){ return this.txt(x - ancho(s, size), y, s, size, bold, col); };
  Doc.prototype.rect = function(x, y, w, h, col, stroke){ if(col) this.color(...col); this.ops.push(`${x.toFixed(1)} ${(H - y - h).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re ${stroke ? 'S' : 'f'}`); return this; };
  Doc.prototype.linea = function(x1, y1, x2, y2, col, ancho){ this.ops.push(`${col ? col.join(' ') + ' RG' : ''} ${ancho||0.5} w ${x1} ${(H-y1).toFixed(1)} m ${x2} ${(H-y2).toFixed(1)} l S`); return this; };
  Doc.prototype.img = function(bytes, w, h, x, y, dw, dh){ const n = this.imgs.length + 1; this.imgs.push({bytes, w, h}); this.ops.push(`q ${dw.toFixed(1)} 0 0 ${dh.toFixed(1)} ${x.toFixed(1)} ${(H - y - dh).toFixed(1)} cm /Im${n} Do Q`); return this; };
  Doc.prototype.bytes = function(){
    const enc = s => { const u = new Uint8Array(s.length); for(let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
    const partes = []; const offs = []; let pos = 0;
    const add = u => { partes.push(u); pos += u.length; };
    const obj = (n, cuerpo, stream) => { offs[n] = pos; add(enc(`${n} 0 obj\n${cuerpo}\n`)); if(stream){ add(enc(`stream\n`)); add(stream); add(enc(`\nendstream\n`)); } add(enc(`endobj\n`)); };
    add(enc('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'));
    const contenido = enc(this.ops.join('\n'));
    const xo = this.imgs.map((_, i) => `/Im${i+1} ${7+i} 0 R`).join(' ');
    obj(1, `<< /Type /Catalog /Pages 2 0 R >>`);
    obj(2, `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`);
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << ${xo} >> >> >>`);
    obj(4, `<< /Length ${contenido.length} >>`, contenido);
    obj(5, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
    obj(6, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);
    this.imgs.forEach((im, i) => obj(7+i, `<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>`, im.bytes));
    const n = 7 + this.imgs.length; const xref = pos;
    let tabla = `xref\n0 ${n}\n0000000000 65535 f \n`; for(let i = 1; i < n; i++) tabla += String(offs[i]).padStart(10,'0') + ' 00000 n \n';
    add(enc(tabla + `trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
    const total = new Uint8Array(pos); let p = 0; partes.forEach(u => { total.set(u, p); p += u.length; }); return total;
  };

  async function jpeg(src, maxW){ const im = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); if(!im) return null;
    const esc2 = Math.min(1, maxW / im.width); const cv = document.createElement('canvas'); cv.width = Math.round(im.width*esc2); cv.height = Math.round(im.height*esc2);
    const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0,0,cv.width,cv.height); c.drawImage(im, 0, 0, cv.width, cv.height);
    const b64 = cv.toDataURL('image/jpeg', 0.86).split(',')[1]; const bin = atob(b64); const u = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return {bytes:u, w:cv.width, h:cv.height}; }

  /* ---------------------------------------------------------- reporte de un trade */
  async function trade(id){
    const t = Store.estado.trades.find(x => x.id === id); if(!t) return null;
    const cta = Store.cuenta(t.cuentaId), P = Tema.perfil(), a = Motor.adherencia(t), n = Motor.neto(t);
    const ins = (window.INSTRUMENTOS||{})[t.instrumento] || {}; const pUSD = ins.puntoUSD || null;
    const puntos = (t.entrada != null && t.salida != null) ? (t.direccion === 'long' ? t.salida - t.entrada : t.entrada - t.salida) : null;
    const riesgoUSD = (t.entrada != null && t.sl != null && pUSD) ? Math.abs(t.entrada - t.sl) * pUSD * (t.contratos||1) : null;
    const r = t.r != null ? +t.r : (riesgoUSD ? n / riesgoUSD : null);
    const clave = x => x.fecha + (x.hora||'');
    const balance = cta ? cta.inicial + Store.estado.trades.filter(x => x.cuentaId === cta.id && clave(x) <= clave(t)).reduce((s,x) => s + Motor.neto(x), 0) : null;
    const num = (v, d) => v == null || isNaN(v) ? '—' : (+v).toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});
    const NEG = [0.07,0.08,0.1], GRIS = [0.45,0.47,0.52], VERDE = [0.13,0.6,0.35], ROJO = [0.8,0.2,0.28], LINEA = [0.85,0.86,0.88];
    const d = new Doc();
    /* cabecera */
    d.rect(0, 0, W, 86, [0.04,0.05,0.08]);
    d.txt(M, 40, 'NORTHPOINT', 16, true, [1,1,1]);
    d.txt(M, 60, 'Reporte de trade · ' + UI.fechaLarga(t.fecha) + (t.hora ? ' · ' + t.hora : '') + (cta ? ' · ' + (cta.alias || cta.firma) : t.modo === 'backtest' ? ' · backtest' : ''), 9, false, [0.7,0.72,0.78]);
    d.txtDer(W - M, 40, (P.nombre || 'André'), 10, true, [1,1,1]);
    d.txtDer(W - M, 60, 'generado ' + new Date().toLocaleString('es-MX'), 8, false, [0.6,0.62,0.68]);
    /* resultado */
    let y = 130;
    d.txt(M, y, (t.direccion === 'long' ? 'LARGO' : 'CORTO') + '  ' + t.instrumento + '  x' + (t.contratos||1) + (t.estrategia ? '   ·   ' + t.estrategia : '') + '   ·   ' + (t.modo === 'backtest' ? 'BACKTEST' : 'REAL'), 9, true, t.direccion === 'long' ? VERDE : ROJO);
    d.txt(M, y + 44, masMenos(Math.round(n)), 40, true, n > 0 ? VERDE : n < 0 ? ROJO : NEG);
    d.txtDer(W - M, y + 8, 'BALANCE DESPUÉS', 7, false, GRIS); d.txtDer(W - M, y + 26, balance != null ? fmt(balance) : '—', 15, true, NEG);
    d.txtDer(W - M, y + 42, 'R  ·  % DE LA CUENTA', 7, false, GRIS); d.txtDer(W - M, y + 58, (r != null ? (r >= 0 ? '+' : '') + r.toFixed(2) + 'R' : '—') + '   ' + (cta ? (n >= 0 ? '+' : '') + (n / cta.inicial * 100).toFixed(2) + '%' : ''), 12, true, n >= 0 ? VERDE : ROJO);
    y += 78;
    /* tabla de datos */
    const filas = [
      ['Entrada', num(t.entrada, 2)], ['Salida', num(t.salida, 2)], ['Stop', num(t.sl, 2)], ['Take profit', num(t.tp, 2)],
      ['Puntos', puntos != null ? (puntos >= 0 ? '+' : '') + num(puntos, 2) : '—'], ['Riesgo $', riesgoUSD != null ? fmt(riesgoUSD) : '—'], ['Comisión', t.comision ? fmt(t.comision) : '$0'], ['Bruto', masMenos(t.pnl||0)],
      ['Tipo', t.tipo === 'continuacion' ? 'Continuación' : 'Reversión'], ['Take profit a', t.tpTipo === 'interno' ? 'Liquidez interna' : 'Liquidez externa'], ['Confluencias', (t.confluencias||[]).length ? t.confluencias.join(' + ') : '—'], ['Disciplina', a.puntos + ' / 100']
    ];
    const cw = (W - 2*M) / 4, rh = 34;
    filas.forEach((f, i) => { const col = i % 4, fila = Math.floor(i/4); const x = M + col*cw, yy = y + fila*rh;
      d.rect(x, yy, cw - 6, rh - 6, [0.96,0.965,0.975]); d.txt(x + 8, yy + 11, f[0].toUpperCase(), 6.5, false, GRIS); d.txt(x + 8, yy + 24, f[1], 10, true, NEG); });
    y += 3*rh + 10;
    /* 4 reglas */
    d.txt(M, y, 'LAS 4 REGLAS', 7, false, GRIS); y += 8;
    a.det.forEach((rg, i) => { const x = M + i*cw; d.rect(x, y, cw - 6, 30, rg.ok ? [0.9,0.97,0.93] : [0.99,0.92,0.93]); d.txt(x + 8, y + 12, rg.ok ? 'OK' : 'X', 9, true, rg.ok ? VERDE : ROJO); d.txt(x + 26, y + 12, envuelve(rg.titulo, 7.5, cw - 40)[0] || '', 7.5, true, NEG); const l2 = envuelve(rg.titulo, 7.5, cw - 40)[1]; if(l2) d.txt(x + 26, y + 22, l2, 7.5, true, NEG); });
    y += 44;
    /* condición · errores · notas */
    const bloque = (titulo, texto, col) => { if(!texto) return; d.txt(M, y, titulo, 7, false, col || GRIS); y += 12; envuelve(texto, 10, W - 2*M).forEach(l => { d.txt(M, y, l, 10, false, NEG); y += 13; }); y += 8; };
    bloque('CONDICIÓN' + (t.condicionCumplida === false ? ' · NO SE CUMPLIÓ' : ''), t.condicion || 'Sin condición escrita');
    bloque('PDA · OBJETIVO', [t.condicionPDA, t.objetivo].filter(Boolean).join('  ·  '));
    bloque('ERRORES', (t.errores||[]).join('  ·  '), ROJO);
    bloque('NOTAS', t.notas);
    /* screenshot */
    const src = t.img ? await Img.get(t.id) : null; const im = src ? await jpeg(src, 1400) : null;
    if(im){ const dispo = H - 40 - y - 14; const escI = Math.min((W - 2*M) / im.w, dispo / im.h); if(escI > 0.05){ const dw = im.w*escI, dh = im.h*escI; d.img(im.bytes, im.w, im.h, M, y, dw, dh); d.rect(M, y, dw, dh, LINEA, true); } }
    d.linea(M, H - 30, W - M, H - 30, LINEA, 0.5);
    d.txt(M, H - 18, 'Condición · Continuación · Equilibrio + FVG · TP interno', 7, false, GRIS); d.txtDer(W - M, H - 18, 'northpoint', 7, false, GRIS);
    return d.bytes();
  }
  function guarda(bytes, nombre){
    let b64 = ''; const CH = 0x8000; for(let i = 0; i < bytes.length; i += CH) b64 += String.fromCharCode.apply(null, bytes.subarray(i, i + CH)); b64 = btoa(b64);
    if(window.__npNativo){ try{ window.webkit.messageHandlers.np.postMessage({cmd:'guardar', nombre, ext:'pdf', b64}); return; }catch(e){} }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], {type:'application/pdf'})); a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function descargaTrade(id){ const b = await trade(id); if(!b) return; const t = Store.estado.trades.find(x => x.id === id); guarda(b, 'northpoint-trade-' + t.fecha + '-' + (t.hora||'').replace(':','') + '.pdf'); }
  window.PDF = { trade, descargaTrade, guarda };
})();
