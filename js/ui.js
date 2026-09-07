/* ============================================================================
   MESA — utilería de interfaz
   ========================================================================= */
(function(){
  const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = Motor.fmt;
  const pct = (x, d) => (x*100).toFixed(d == null ? 1 : d) + '%';
  const signo = n => (n > 0 ? 'up' : n < 0 ? 'down' : 'dim');
  const masMenos = n => (n > 0 ? '+' : '') + fmt(n);

  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const DOW = ['dom','lun','mar','mié','jue','vie','sáb'];

  function fechaLarga(iso){
    if(!iso) return '—';
    const [y,m,d] = iso.split('-').map(Number);
    const f = new Date(y, m-1, d);
    return DOW[f.getDay()] + ' ' + d + ' ' + MESES[m-1].slice(0,3) + ' ' + y;
  }
  function fechaCorta(iso){
    if(!iso) return '—';
    const [y,m,d] = iso.split('-').map(Number);
    return String(d).padStart(2,'0') + '/' + String(m).padStart(2,'0');
  }

  function anillo(p, color, s){
    s = s || 46; const r = (s - 6) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, +p || 0));
    return `<svg class="anillo" viewBox="0 0 ${s} ${s}"><circle cx="${s/2}" cy="${s/2}" r="${r}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="5"/>
      <circle cx="${s/2}" cy="${s/2}" r="${r}" fill="none" stroke="${color || 'var(--acc)'}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(c*v).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${s/2} ${s/2})" style="filter:drop-shadow(0 0 6px ${color || 'var(--acc)'})"/></svg>`;
  }
  function kpi(k, v, nota, clase, ayuda, anilloPct, anilloColor){
    return `<div class="kpi ${clase||''}"><div class="k">${h(k)}${ayuda?`<span class="ayuda" title="${h(ayuda)}">?</span>`:''}</div>
      <div class="v">${v}</div>${nota ? `<div class="n">${nota}</div>` : ''}${anilloPct != null ? anillo(anilloPct, anilloColor) : ''}</div>`;
  }

  function opciones(lista, sel){
    return lista.map(o => {
      const v = typeof o === 'object' ? o.v : o, t = typeof o === 'object' ? o.t : o;
      return `<option value="${h(v)}"${String(v) === String(sel) ? ' selected' : ''}>${h(t)}</option>`;
    }).join('');
  }

  let cerrarModal = null;
  function modal(titulo, cuerpo, pie, opt){
    cerrar();
    const velo = document.createElement('div');
    velo.className = 'velo';
    velo.innerHTML = `<div class="modal" style="${opt && opt.ancho ? 'width:min('+opt.ancho+'px,100%)' : ''}">
      <div class="mh"><b>${h(titulo)}</b><button class="x" data-cerrar>✕</button></div>
      <div class="mb">${cuerpo}</div>
      ${pie ? `<div class="mf">${pie}</div>` : ''}</div>`;
    document.body.appendChild(velo);
    velo.addEventListener('click', e => { if(e.target === velo || e.target.hasAttribute('data-cerrar')) cerrar(); });
    cerrarModal = () => { velo.remove(); cerrarModal = null; };
    const primero = velo.querySelector('input,select,textarea');
    if(primero && !(opt && opt.sinFoco)) setTimeout(() => primero.focus(), 40);
    return velo;
  }
  function cerrar(){ if(cerrarModal) cerrarModal(); }
  document.addEventListener('keydown', e => { if(e.key === 'Escape') cerrar(); });

  function aviso(txt){ return `<div class="aviso">${txt}</div>`; }
  function vacio(txt){ return `<div class="vacio">${h(txt)}</div>`; }

  /* selector de archivos. El <input type=file> se mete al DOM mientras el panel está abierto: suelto (sin estar en el documento),
     Safari/WKWebView lo recoge antes de que elijas y el evento change nunca llega (así "no se actualizaba" la foto de perfil en la app de Mac). */
  function elegirArchivos(accept, multiple){
    return new Promise(res => {
      const i = document.createElement('input'); i.type = 'file'; if(accept) i.accept = accept; i.multiple = !!multiple;
      i.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
      i.onchange = () => { const fs = [...i.files]; setTimeout(() => i.remove(), 500); res(fs); };
      document.body.appendChild(i); i.click();
      setTimeout(() => { if(document.body.contains(i) && !i.files.length){ i.remove(); res([]); } }, 10*60000);   // cerró el panel sin elegir
    });
  }
  /* Foto: en la app de escritorio el selector lo abre el sistema (Swift / Electron) y devuelve la imagen ya reducida.
     El <input type=file> de WKWebView no siempre dispara change, por eso la foto "no se actualizaba". */
  const pendImg = {};
  function b64aBlob(b64, mime){ const bin = atob(b64); const u8 = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Blob([u8], {type: mime || 'image/jpeg'}); }
  window.__npImagen = (id, b64, mime) => { const f = pendImg[id]; if(!f) return; delete pendImg[id]; f(b64 ? b64aBlob(b64, mime) : null); };
  function elegirImagen(){
    if(window.__npNativo) return new Promise(res => {
      const id = 'img' + Date.now() + Math.random().toString(36).slice(2, 7); pendImg[id] = res;
      try{ window.webkit.messageHandlers.np.postMessage({cmd:'elegirImagen', id}); }catch(e){ delete pendImg[id]; res(null); }
      setTimeout(() => { if(pendImg[id]){ delete pendImg[id]; res(null); } }, 5*60000);
    });
    return elegirArchivos('image/*').then(fs => fs[0] || null);
  }
  function toast(txt){
    const t = document.createElement('div');
    t.textContent = txt;
    t.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#C6FF3D;'
      + 'border:1px solid #C6FF3D;color:#000;padding:9px 15px;border-radius:10px;z-index:90;'
      + 'font-family:var(--disp);font-weight:700;font-size:12px;letter-spacing:.06em;text-transform:uppercase;box-shadow:0 10px 30px rgba(0,0,0,.5)';
    document.body.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; }, 1900);
    setTimeout(() => t.remove(), 2400);
  }

  window.UI = { elegirArchivos, elegirImagen,  h, fmt, pct, signo, masMenos, MESES, DOW, fechaLarga, fechaCorta, kpi, anillo, opciones, modal, cerrar, aviso, vacio, toast };
})();
