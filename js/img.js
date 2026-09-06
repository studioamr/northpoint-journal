/* ============================================================================
   NORTHPOINT JOURNAL — screenshots de trades en IndexedDB
   (localStorage no aguanta imágenes; aquí caben cientos)
   ========================================================================= */
(function(){
  const NOMBRE = 'northpoint-img';
  function db(){ return new Promise((res, rej) => { const r = indexedDB.open(NOMBRE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('img'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  async function put(id, data){ const d = await db(); return new Promise((res, rej) => { const tx = d.transaction('img','readwrite'); tx.objectStore('img').put(data, id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
  async function get(id){ const d = await db(); return new Promise(res => { const q = d.transaction('img').objectStore('img').get(id); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); }
  async function del(id){ const d = await db(); return new Promise(res => { const tx = d.transaction('img','readwrite'); tx.objectStore('img').delete(id); tx.oncomplete = res; }); }

  /* Reduce a máx 1600px de ancho y JPEG .85 para que no pese. */
  function comprimir(archivo){
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(archivo); const im = new Image();
      im.onload = () => {
        const esc = Math.min(1, 1600 / im.width);
        const cv = document.createElement('canvas'); cv.width = Math.round(im.width * esc); cv.height = Math.round(im.height * esc);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url); res(cv.toDataURL('image/jpeg', .85));
      };
      im.onerror = rej; im.src = url;
    });
  }
  /* foto de perfil: recorte cuadrado centrado, chico (256 px), JPEG */
  function avatar(archivo, tam){
    tam = tam || 256;
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(archivo); const im = new Image();
      im.onload = () => {
        const lado = Math.min(im.width, im.height), sx = (im.width - lado) / 2, sy = (im.height - lado) / 2;
        const cv = document.createElement('canvas'); cv.width = tam; cv.height = tam;
        cv.getContext('2d').drawImage(im, sx, sy, lado, lado, 0, 0, tam, tam);
        URL.revokeObjectURL(url); res(cv.toDataURL('image/jpeg', .9));
      };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('imagen inválida')); }; im.src = url;
    });
  }
  window.Img = { put, get, del, comprimir, avatar };
})();
