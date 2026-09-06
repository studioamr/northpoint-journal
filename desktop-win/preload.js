// Puente igual al de la app de Mac: la web habla con window.webkit.messageHandlers.np.postMessage({cmd, ...})
const { ipcRenderer } = require('electron');
window.__npNativo = true;
window.webkit = { messageHandlers: { np: { postMessage: (m) => ipcRenderer.send('np', m) } } };
