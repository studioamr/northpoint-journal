#!/usr/bin/env python3
"""Proxy local mínimo para desarrollo: añade CORS a JSON públicos sin CORS (Forex Factory).
Uso:  python3 tools/proxy.py   →  http://localhost:4357/?url=<url>
Solo permite dominios de la lista blanca. La app de escritorio no lo necesita."""
import http.server, urllib.request, urllib.parse, json, time
CACHE = {}   # url -> (ts, datos); Forex Factory limita peticiones: se sirve la copia hasta 15 min y, si falla, la última buena
PERMITIDOS = ("nfs.faireconomy.media", "query1.finance.yahoo.com", "query2.finance.yahoo.com")
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        u = (q.get("url") or [""])[0]
        host = urllib.parse.urlparse(u).hostname or ""
        if host not in PERMITIDOS:
            self.send_response(403); self.send_header("Access-Control-Allow-Origin", "*"); self.end_headers(); return
        c = CACHE.get(u)
        if c and time.time() - c[0] < 900:
            datos = c[1]
        else:
            try:
                with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 (NORTHPOINT JOURNAL)", "Accept": "application/json"}), timeout=15) as r:
                    datos = r.read(); CACHE[u] = (time.time(), datos)
            except Exception as e:
                if c: datos = c[1]
                else:
                    self.send_response(502); self.send_header("Access-Control-Allow-Origin", "*"); self.end_headers(); self.wfile.write(str(e).encode()); return
        self.send_response(200)
        self.send_header("Content-Type", "application/json"); self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers(); self.wfile.write(datos)
    def log_message(self, *a): pass
print("proxy en http://localhost:4357  (Forex Factory con CORS)")
http.server.HTTPServer(("127.0.0.1", 4357), H).serve_forever()
