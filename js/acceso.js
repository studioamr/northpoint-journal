/* ============================================================================
   NORTHPOINT — pantalla de entrada: PERFILES
   Cada persona entra con su perfil (y su PIN si quiere). Cada perfil guarda lo
   suyo en su propia llave (mesa.v1.<id>), así nada se mezcla ni se pierde.
   Todo local, sin servidor. La lista de perfiles vive en localStorage np.perfiles.
   ========================================================================= */
(function(){
  const el = document.getElementById('acceso'); if(!el) return;
  const lee = () => { try{ return JSON.parse(localStorage.getItem('np.perfiles') || '[]'); }catch(e){ return []; } };
  const escribe = l => localStorage.setItem('np.perfiles', JSON.stringify(l));
  const activo = () => localStorage.getItem('np.perfilActivo') || '';
  const id = () => Math.random().toString(36).slice(2, 10);
  async function hash(s){ const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('np·' + s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join(''); }

  /* migración: si hay datos viejos en mesa.v1 (sin perfil) se vuelven el primer perfil, con el nombre que tenía guardado */
  (function migra(){
    if(lee().length || !localStorage.getItem('mesa.v1')) return;
    let nombre = 'Mi perfil'; try{ const d = JSON.parse(localStorage.getItem('mesa.v1')); nombre = (d.ajustes && d.ajustes.perfil && d.ajustes.perfil.nombre) || (d.ajustes && d.ajustes.acceso && d.ajustes.acceso.nombre) || nombre; }catch(e){}
    const p = {id: id(), nombre, pin: null, creado: Date.now()};
    localStorage.setItem('mesa.v1.' + p.id, localStorage.getItem('mesa.v1'));
    escribe([p]); localStorage.setItem('np.perfilActivo', p.id); sessionStorage.setItem('np.sesion', '1');
    location.reload();
  })();

  function pinta(modo){
    const lista = lee(); const hay = lista.length > 0;
    const crear = modo === 'crear' || !hay;
    el.innerHTML = `
      <div class="acceso-hero">
        <div class="flota"><b>NORTHPOINT</b><span>journal</span></div>
        <form class="acceso-form" id="accesoForm" autocomplete="off">
          ${crear ? `<div class="eti" style="text-align:center">${hay ? 'Nuevo perfil' : 'Crea tu perfil'}</div>
                 <input name="nombre" placeholder="Tu nombre" autofocus maxlength="40">
                 <input type="password" inputmode="numeric" maxlength="8" name="pin" placeholder="PIN (opcional)">
                 <button class="btn acc" type="submit">Entrar a NORTHPOINT</button>
                 <div id="accesoErr" class="down mini" style="min-height:16px;text-align:center"></div>
                 ${hay ? `<button class="btn fantasma chico" type="button" id="accesoVolver">Ya tengo perfil</button>` : ''}
                 <div class="mini tenue" style="text-align:center">Tus cuentas, trades y ajustes se guardan en tu perfil, en esta computadora.</div>`
              : `<div class="eti" style="text-align:center">¿Quién entra?</div>
                 <div class="perfiles">${lista.map(p => `<button type="button" class="perfil-btn" data-id="${p.id}"><span class="av">${UI.h(Tema.iniciales(p.nombre))}</span><span>${UI.h(p.nombre)}</span>${p.pin ? '<i>PIN</i>' : ''}</button>`).join('')}</div>
                 <div id="pinZona" hidden><input type="password" inputmode="numeric" maxlength="8" name="pin" placeholder="PIN"><button class="btn acc" type="submit">Entrar</button></div>
                 <div id="accesoErr" class="down mini" style="min-height:16px;text-align:center"></div>
                 <button class="btn fantasma chico" type="button" id="accesoOtro">Crear otro perfil</button>`}
        </form>
        <div class="acceso-pie mono">DEL EXAMEN AL PAYOUT</div>
      </div>`;
    const f = document.getElementById('accesoForm'); let elegido = null;
    f.querySelectorAll('.perfil-btn').forEach(b => b.addEventListener('click', () => { const p = lista.find(x => x.id === b.dataset.id); if(!p) return;
      f.querySelectorAll('.perfil-btn').forEach(x => x.classList.toggle('on', x === b));
      if(p.pin){ elegido = p; const z = document.getElementById('pinZona'); z.hidden = false; z.querySelector('input').focus(); }
      else entrar(p); }));
    f.addEventListener('submit', async e => { e.preventDefault(); const g = n => (f.querySelector(`[name="${n}"]`) || {}).value || '';
      if(crear){ const nombre = g('nombre').trim(); if(!nombre){ document.getElementById('accesoErr').textContent = 'Ponle nombre a tu perfil'; return; }
        const pin = g('pin').trim(); const p = {id: id(), nombre, pin: pin ? await hash(pin) : null, creado: Date.now()}; escribe(lista.concat([p])); entrar(p); return; }
      if(elegido){ if((await hash(g('pin').trim())) !== elegido.pin){ document.getElementById('accesoErr').textContent = 'PIN incorrecto'; f.querySelector('[name=pin]').value = ''; return; } entrar(elegido); } });
    const otro = document.getElementById('accesoOtro'); if(otro) otro.addEventListener('click', () => pinta('crear'));
    const volver = document.getElementById('accesoVolver'); if(volver) volver.addEventListener('click', () => pinta('lista'));
  }
  function entrar(p){ localStorage.setItem('np.perfilActivo', p.id); sessionStorage.setItem('np.sesion', '1');
    if(p.id !== (window.Store && Store.PERFIL)) { location.reload(); return; }   // la app se recarga para leer la llave de ese perfil
    el.classList.add('fuera'); setTimeout(() => { el.hidden = true; el.style.display = 'none'; el.innerHTML = ''; }, 650); }
  function salir(){ sessionStorage.removeItem('np.sesion'); localStorage.removeItem('np.perfilActivo'); location.reload(); }

  const lista = lee(); const p = lista.find(x => x.id === activo());
  const sesionOk = !!sessionStorage.getItem('np.sesion');
  if(p && (!p.pin || sesionOk)){ el.hidden = true; el.style.display = 'none'; sessionStorage.setItem('np.sesion', '1'); }
  else { el.hidden = false; el.style.display = ''; pinta('lista'); }
  window.Acceso = { salir, pinta, perfiles: lee };
})();
