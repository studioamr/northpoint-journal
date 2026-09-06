/* ============================================================================
   NORTHPOINT — pantalla de entrada
   Al abrir: NORTHPOINT flotando y abajo el log in. Primera vez: creas tu
   acceso (nombre + PIN de 4 dígitos, opcional). Todo local, sin servidor.
   ========================================================================= */
(function(){
  const el = document.getElementById('acceso'); if(!el) return;
  const acc = () => Store.ajustes.acceso || null;
  async function hash(s){ const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('np·' + s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join(''); }

  function pinta(){
    const a = acc();
    const nombre = (Tema.perfil().nombre || 'André');
    el.innerHTML = `
      <div class="acceso-hero">
        <div class="flota"><b>NORTHPOINT</b><span>journal</span></div>
        <form class="acceso-form" id="accesoForm" autocomplete="off">
          ${a ? `<div class="eti" style="text-align:center">Bienvenido, ${UI.h(a.nombre)}</div>
                 ${a.pin ? `<input type="password" inputmode="numeric" maxlength="8" name="pin" placeholder="PIN" autofocus>` : ''}
                 <label class="check" style="justify-content:center"><input type="checkbox" name="recordar" ${localStorage.getItem('np.recordar') ? 'checked' : ''}> Recordarme en esta Mac</label>
                 <button class="btn acc" type="submit">Iniciar sesión</button>
                 <div id="accesoErr" class="down mini" style="min-height:16px;text-align:center"></div>
                 <button class="btn fantasma chico" type="button" id="accesoOtro">Crear otro acceso</button>`
              : `<div class="eti" style="text-align:center">Crea tu acceso</div>
                 <input name="nombre" placeholder="Tu nombre" value="${UI.h(nombre)}" autofocus>
                 <input type="password" inputmode="numeric" maxlength="8" name="pin" placeholder="PIN de 4 dígitos (opcional)">
                 <button class="btn acc" type="submit">Entrar a NORTHPOINT</button>
                 <div class="mini tenue" style="text-align:center">Todo vive en esta máquina. Sin cuentas en la nube, sin correos.</div>`}
        </form>
        <div class="acceso-pie mono">DEL EXAMEN AL PAYOUT</div>
      </div>`;
    const f = document.getElementById('accesoForm');
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const g = n => (f.querySelector(`[name="${n}"]`) || {}).value || '';
      if(!a){
        const pin = g('pin').trim();
        Store.ajustes.acceso = {nombre: g('nombre').trim() || nombre, pin: pin ? await hash(pin) : null};
        Tema.guardaPerfil({nombre: Store.ajustes.acceso.nombre});
        Store.guardar(); entrar(); return;
      }
      if(a.pin && (await hash(g('pin').trim())) !== a.pin){ document.getElementById('accesoErr').textContent = 'PIN incorrecto'; f.querySelector('[name=pin]').value = ''; return; }
      if(f.querySelector('[name=recordar]') && f.querySelector('[name=recordar]').checked) localStorage.setItem('np.recordar', '1'); else localStorage.removeItem('np.recordar');
      entrar();
    });
    const otro = document.getElementById('accesoOtro');
    if(otro) otro.addEventListener('click', () => { if(confirm('¿Crear un acceso nuevo? Tus datos no se borran.')){ Store.ajustes.acceso = null; Store.guardar(); pinta(); } });
  }
  function entrar(){ sessionStorage.setItem('np.sesion', '1'); el.classList.add('fuera'); setTimeout(() => { el.hidden = true; el.innerHTML = ''; }, 650); }
  function salir(){ sessionStorage.removeItem('np.sesion'); localStorage.removeItem('np.recordar'); el.hidden = false; el.classList.remove('fuera'); pinta(); }

  /* 6-sep-2026: sin PIN ni login — la app abre directo (él lo pidió). El hero de acceso queda en el código por si algún día vuelve. */
  if(Store.ajustes.acceso && Store.ajustes.acceso.pin){ Store.ajustes.acceso.pin = null; Store.guardar(); }
  el.hidden = true; el.style.display = 'none';
  window.Acceso = { salir, pinta };
})();
