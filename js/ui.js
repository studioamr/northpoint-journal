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

  function kpi(k, v, nota, clase, ayuda){
    return `<div class="kpi ${clase||''}"><div class="k">${h(k)}${ayuda?`<span class="ayuda" title="${h(ayuda)}">?</span>`:''}</div>
      <div class="v">${v}</div>${nota ? `<div class="n">${nota}</div>` : ''}</div>`;
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

  window.UI = { h, fmt, pct, signo, masMenos, MESES, DOW, fechaLarga, fechaCorta, kpi, opciones, modal, cerrar, aviso, vacio, toast };
})();
