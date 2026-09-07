/* NORTHPOINT para Windows — Electron. Mismo puente que la app de Mac (fetch sin CORS, guardar archivos,
   carpeta vigilada de CSV de Tradovate, notificaciones, abrir links, Tradovate/TradingView embebidos). */
const { app, BrowserWindow, BrowserView, ipcMain, dialog, shell, Notification, net, session } = require('electron');
const fs = require('fs'), path = require('path');
let win = null, plat = null, carpeta = null, timer = null;
const estadoPath = () => path.join(app.getPath('userData'), 'carpeta.json');
const js = (code) => { if(win && !win.isDestroyed()) win.webContents.executeJavaScript(code).catch(() => {}); };
const esc = s => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
function crea(){
  win = new BrowserWindow({ width: 1440, height: 900, minWidth: 980, minHeight: 640, backgroundColor: '#0a0d14', title: 'NORTHPOINT', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: false, nodeIntegration: false, sandbox: false } });
  win.loadFile(path.join(__dirname, 'web', 'index.html'));
  win.webContents.setWindowOpenHandler(({url}) => { shell.openExternal(url); return {action: 'deny'}; });
  win.on('closed', () => { win = null; });
  try{ const e = JSON.parse(fs.readFileSync(estadoPath(), 'utf8')); if(e.carpeta && fs.existsSync(e.carpeta)){ carpeta = e.carpeta; arrancar(); } }catch(e){}
}
app.whenReady().then(crea);
app.on('window-all-closed', () => app.quit());
/* ---- carpeta vigilada (CSV de Tradovate) */
function estado(){ js(`window.__npCarpeta && window.__npCarpeta(${timer ? 'true' : 'false'}, "${esc(carpeta ? path.basename(carpeta) : '')}")`); }
function arrancar(){ if(timer) clearInterval(timer); timer = setInterval(barrer, 4000); barrer(); estado(); }
function barrer(){
  if(!carpeta) return; let vistos = {}; const vp = path.join(app.getPath('userData'), 'csvVistos.json'); try{ vistos = JSON.parse(fs.readFileSync(vp, 'utf8')); }catch(e){}
  let items = []; try{ items = fs.readdirSync(carpeta); }catch(e){ return; }
  for(const f of items){ if(!/\.(csv|tsv|txt)$/i.test(f)) continue; const p = path.join(carpeta, f); let st; try{ st = fs.statSync(p); }catch(e){ continue; }
    const clave = `${f}|${Math.floor(st.mtimeMs/1000)}|${st.size}`; if(vistos[clave]) continue; vistos[clave] = true;
    if(Date.now() - st.mtimeMs > 3*86400000) continue;
    try{ const b64 = Buffer.from(fs.readFileSync(p, 'utf8'), 'utf8').toString('base64'); js(`window.__npCsv && window.__npCsv("${esc(f)}", "${b64}")`); }catch(e){} }
  try{ fs.writeFileSync(vp, JSON.stringify(vistos)); }catch(e){}
  estado();
}
/* ---- plataforma embebida (Tradovate / TradingView) */
function colocaPlataforma(url, x, y, w, h){
  if(!win) return;
  if(!plat){ plat = new BrowserView({ webPreferences: { partition: 'persist:plataforma' } }); win.setBrowserView(plat); }
  plat.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) });
  if(plat.webContents.getURL() !== url) plat.webContents.loadURL(url);
}
/* ---- el puente */
ipcMain.on('np', async (e, d) => {
  if(!d || !d.cmd) return;
  switch(d.cmd){
    case 'fetch': {
      try{ const r = await net.fetch(d.url, { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0', 'Cache-Control': 'no-cache' } }); const buf = Buffer.from(await r.arrayBuffer());
        js(`window.__npFetch && window.__npFetch("${esc(d.id)}", "${buf.toString('base64')}", "")`); }
      catch(err){ js(`window.__npFetch && window.__npFetch("${esc(d.id)}", "", "${esc(err.message)}")`); }
      break; }
    case 'guardarPng': case 'guardar': {
      const ext = d.cmd === 'guardarPng' ? 'png' : (d.ext || 'pdf');
      const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('downloads'), d.nombre || ('northpoint.' + ext)), filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
      if(!r.canceled && r.filePath) try{ fs.writeFileSync(r.filePath, Buffer.from(d.b64 || '', 'base64')); }catch(err){}
      break; }
    case 'elegirImagen': {
      const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Imagen', extensions: ['png','jpg','jpeg','gif','webp','bmp'] }] });
      let b64 = '';
      if(!r.canceled && r.filePaths[0]) try{ b64 = fs.readFileSync(r.filePaths[0]).toString('base64'); }catch(err){}
      js(`window.__npImagen && window.__npImagen("${esc(d.id)}", "${b64}", "image/jpeg")`);
      break; }
    case 'abrir': if(d.url) shell.openExternal(d.url); break;
    case 'notificar': try{ new Notification({ title: d.titulo || 'NORTHPOINT', body: d.texto || '' }).show(); }catch(err){} break;
    case 'elegirCarpeta': {
      const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'], defaultPath: app.getPath('downloads') });
      if(!r.canceled && r.filePaths[0]){ carpeta = r.filePaths[0]; try{ fs.writeFileSync(estadoPath(), JSON.stringify({carpeta})); }catch(err){} arrancar(); }
      break; }
    case 'detenerCarpeta': if(timer) clearInterval(timer); timer = null; carpeta = null; try{ fs.unlinkSync(estadoPath()); }catch(err){} estado(); break;
    case 'barrer': barrer(); break;
    case 'plataforma': if(d.url) colocaPlataforma(d.url, d.x || 0, d.y || 0, d.w || 0, d.h || 0); break;
    case 'plataformaOcultar': if(plat) plat.setBounds({x:0, y:0, width:0, height:0}); break;
    case 'trading': shell.openExternal('https://trader.tradovate.com'); break;
  }
});
