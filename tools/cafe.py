"""
COFFEE MORNING · datos para la pantalla Coffee Morning de la app (NQ y ES, sesión de NY)

Lo corre el workflow .github/workflows/cafe.yml antes de la campana y escribe data/cafe.json:
  · overnight de NQ y ES en velas de 5m (futuros CME de Yahoo) para que la app dibuje la gráfica
  · liquidez: PDH/PDL, cierre de ayer (gap), alto/bajo y 0.5 del overnight, Asia, Londres, semana pasada,
    swings de 1H sin tomar e iguales (EQH/EQL), cada uno con si ya lo tomaron en la noche y a qué hora
  · lectura automática + escenario alcista y bajista con objetivos de liquidez (condiciones, no señales)
  · noticias rojas de Forex Factory, squawk de FinancialJuice, Google News, Polymarket y la cinta de mercados (el Mirador)
Uso: python3 tools/cafe.py   (desde la raíz del repo)
"""
from __future__ import annotations
import os, re, json, html, time, datetime as dt
import urllib.request, urllib.parse
from email.utils import parsedate_to_datetime
from zoneinfo import ZoneInfo
import xml.etree.ElementTree as XML
import numpy as np
import pandas as pd

ET, MX = ZoneInfo("America/New_York"), ZoneInfo("America/Mexico_City")
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Safari/537.36"}
MERCADOS = {"NQ": "NQ=F", "ES": "ES=F"}
TOL_EQ = {"NQ": 6.0, "ES": 1.5}                      # puntos para llamar "iguales" a dos swings
CINTA = [("NQ", "NQ=F"), ("ES", "ES=F"), ("YM", "YM=F"), ("RTY", "RTY=F"), ("VIX", "^VIX"), ("DXY", "DX-Y.NYB"),
         ("10 años", "^TNX"), ("Oro", "GC=F"), ("Petróleo", "CL=F"), ("BTC", "BTC-USD")]
DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]
CLAVE = re.compile(r"\b(fed|fomc|powell|cpi|pce|nfp|payrolls|jobs|inflation|tariffs?|trump|nasdaq|s&p|nvidia|apple|microsoft|"
                   r"treasury|yields?|rates?|recession|gdp|ism|pmi|china|iran|israel|opec|earnings|guidance|shutdown)\b", re.I)


def traer(url, timeout=25, intentos=3):
    for k in range(intentos):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read()
        except Exception:
            if k == intentos - 1: raise
            time.sleep(3 * (k + 1))


def yahoo(sim, intervalo="5m", rango="1mo"):
    ult = None
    for k, host in enumerate(("query2", "query1", "query2", "query1")):    # Yahoo a veces responde 429 a un host y al otro no
        try:
            d = json.loads(traer(f"https://{host}.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sim)}?interval={intervalo}&range={rango}", intentos=1))
            break
        except Exception as e:
            ult = e; time.sleep(2 + 3 * k)
    else:
        raise ult
    r = d["chart"]["result"][0]
    q = r["indicators"]["quote"][0]
    df = pd.DataFrame({k: q[k] for k in ("open", "high", "low", "close")},
                      index=pd.to_datetime(r["timestamp"], unit="s", utc=True).tz_convert(ET)).dropna()
    return df, r["meta"]


def dia_de_trading(ahora):
    """El día de NY que se prepara: después de las 18:00 ET o en fin de semana, el siguiente día hábil."""
    d = ahora.date() + dt.timedelta(days=1 if ahora.time() >= dt.time(18) else 0)
    while d.weekday() >= 5: d += dt.timedelta(days=1)
    return d


def sesion(df, a, b):
    s = df[(df.index >= a) & (df.index < b)]
    return (float(s.high.max()), float(s.low.min())) if len(s) else (None, None)


def tomado(df, precio, desde, lado):
    s = df[df.index >= desde]
    m = s.high >= precio if lado == "arriba" else s.low <= precio
    return s.index[m.to_numpy().argmax()] if m.any() else None


def pivotes(h, n):
    H, L = h.high.to_numpy(), h.low.to_numpy()
    out = []
    for i in range(n, len(h) - n):
        if H[i] >= H[i - n:i + n + 1].max(): out.append(("H", float(H[i]), h.index[i], h.index[i + n]))
        if L[i] <= L[i - n:i + n + 1].min(): out.append(("L", float(L[i]), h.index[i], h.index[i + n]))
    return out


def hora_mx(t):
    return f"{DIAS[t.astimezone(MX).weekday()]} {t.astimezone(MX):%H:%M}"


def analizar(mer, df, ahora, hoy):
    on0 = pd.Timestamp(dt.datetime.combine(hoy - dt.timedelta(days=3 if hoy.weekday() == 0 else 1), dt.time(18)), tz=ET)
    rth = df[(df.index.time >= dt.time(9, 30)) & (df.index.time < dt.time(16)) & (df.index.date < hoy)]
    ayer = rth.index.date.max()
    r_ayer = rth[rth.index.date == ayer]
    pdh, pdl, pdc = float(r_ayer.high.max()), float(r_ayer.low.min()), float(r_ayer.close.iloc[-1])
    on = df[(df.index >= on0) & (df.index <= ahora)]
    onh, onl, ultimo = float(on.high.max()), float(on.low.min()), float(on.close.iloc[-1])
    asia = sesion(df, on0 + pd.Timedelta(hours=2), on0 + pd.Timedelta(hours=6))      # 20:00–00:00 ET
    lon = sesion(df, on0 + pd.Timedelta(hours=8), on0 + pd.Timedelta(hours=11))      # 02:00–05:00 ET
    lunes = pd.Timestamp(dt.datetime.combine(hoy - dt.timedelta(days=hoy.weekday()), dt.time()), tz=ET)
    sem = df[(df.index >= lunes - pd.Timedelta(days=7)) & (df.index < lunes - pd.Timedelta(hours=6))]
    rangos = []
    for d in sorted(set(df.index.date)):
        if d >= hoy or d.weekday() >= 5: continue
        a = pd.Timestamp(dt.datetime.combine(d - dt.timedelta(days=3 if d.weekday() == 0 else 1), dt.time(18)), tz=ET)
        h, l = sesion(df, a, pd.Timestamp(dt.datetime.combine(d, dt.time(9, 30)), tz=ET))
        if h: rangos.append(h - l)
    prom = float(np.mean(rangos[-15:])) if rangos else None

    niv = []
    def nivel(nom, p, desde, lado, peso):
        if p is None: return
        t = tomado(df, p, desde, lado)
        niv.append(dict(n=nom, p=round(p, 2), lado=lado, peso=peso, tomado=t.astimezone(MX).strftime("%H:%M") if t is not None else None))
    fin_ayer = pd.Timestamp(dt.datetime.combine(ayer, dt.time(16)), tz=ET)
    nivel("PDH", pdh, fin_ayer, "arriba", 3)
    nivel("PDL", pdl, fin_ayer, "abajo", 3)
    if len(sem):
        nivel("Alto semana pasada", float(sem.high.max()), lunes - pd.Timedelta(hours=6), "arriba", 3)
        nivel("Bajo semana pasada", float(sem.low.min()), lunes - pd.Timedelta(hours=6), "abajo", 3)
    niv.append(dict(n="Alto overnight", p=round(onh, 2), lado="arriba", peso=2, tomado=None))
    niv.append(dict(n="Bajo overnight", p=round(onl, 2), lado="abajo", peso=2, tomado=None))
    nivel("Alto Asia", asia[0], on0 + pd.Timedelta(hours=6), "arriba", 2)
    nivel("Bajo Asia", asia[1], on0 + pd.Timedelta(hours=6), "abajo", 2)
    nivel("Alto Londres", lon[0], on0 + pd.Timedelta(hours=11), "arriba", 2)
    nivel("Bajo Londres", lon[1], on0 + pd.Timedelta(hours=11), "abajo", 2)
    h1 = df[df.index >= ahora - pd.Timedelta(days=8)].resample("1h").agg(dict(open="first", high="max", low="min", close="last")).dropna()
    sw = [(t, p, t0, t1) for t, p, t0, t1 in pivotes(h1, 3) if t1 < on0 and t0 >= ahora - pd.Timedelta(days=6)]
    vivos = [(t, p, t0) for t, p, t0, t1 in sw if tomado(df, p, t1, "arriba" if t == "H" else "abajo") is None]
    usados = set()
    for i, (t, p, t0) in enumerate(vivos):
        par = [j for j, (u, q, _) in enumerate(vivos) if j != i and u == t and abs(q - p) <= TOL_EQ[mer]]
        if par and i not in usados:
            usados.update([i, *par])
            ps = [p] + [vivos[j][1] for j in par]
            niv.append(dict(n="Altos iguales (EQH)" if t == "H" else "Bajos iguales (EQL)", p=round(max(ps) if t == "H" else min(ps), 2),
                            lado="arriba" if t == "H" else "abajo", peso=3, tomado=None))
    for p, t0 in sorted([(p, t0) for i, (t, p, t0) in enumerate(vivos) if t == "H" and i not in usados and p > ultimo])[:3]:
        niv.append(dict(n=f"Swing alto 1H ({hora_mx(t0)})", p=round(p, 2), lado="arriba", peso=1, tomado=None))
    for p, t0 in sorted([(p, t0) for i, (t, p, t0) in enumerate(vivos) if t == "L" and i not in usados and p < ultimo], reverse=True)[:3]:
        niv.append(dict(n=f"Swing bajo 1H ({hora_mx(t0)})", p=round(p, 2), lado="abajo", peso=1, tomado=None))
    # el mismo precio con varios nombres (PDH = alto de la semana) es UN nivel, con más peso
    juntos = []
    for x in sorted(niv, key=lambda x: -x["p"]):
        y = next((j for j in juntos if abs(j["p"] - x["p"]) < 0.01 and j["lado"] == x["lado"]), None)
        if y: y["n"] += " · " + x["n"].split(" (")[0]; y["peso"] = max(y["peso"], x["peso"]) + 1; y["tomado"] = y["tomado"] or x["tomado"]
        else: juntos.append(dict(x))
    niv = juntos
    for x in niv: x["dist"] = round(x["p"] - ultimo, 2)

    mid = (onh + onl) / 2
    gap = ultimo - pdc
    lectura = [f"Gap contra el cierre de ayer ({pdc:,.2f}): {gap:+,.2f} pts ({gap / pdc * 100:+.2f}%)."]
    if prom:
        r = (onh - onl) / prom
        lectura.append(f"Rango del overnight {onh - onl:,.2f} pts = {r:.1f}× el promedio de 15 días ({prom:,.0f}). "
                       + ("Noche amplia: parte del movimiento del día ya se gastó." if r > 1.3 else
                          "Noche apretada: la liquidez de los dos lados quedó cerca y la apertura suele expandir." if r < 0.7 else "Noche normal."))
    lectura.append(f"Precio {ultimo:,.2f} {'arriba' if ultimo > mid else 'abajo'} del 0.5 del overnight ({mid:,.2f}): "
                   + ("premium, caro para comprar." if ultimo > mid else "descuento, barato para comprar."))
    tom = [f"{x['n']} ({x['tomado']})" for x in niv if x["tomado"]]
    if tom: lectura.append("Ya tomados en la noche: " + ", ".join(tom) + ".")
    if asia[1] is not None and lon[1] is not None and lon[1] < asia[1] and ultimo > asia[1]:
        lectura.append("Londres barrió el bajo de Asia y el precio volvió arriba: posible Judas alcista.")
    if asia[0] is not None and lon[0] is not None and lon[0] > asia[0] and ultimo < asia[0]:
        lectura.append("Londres barrió el alto de Asia y el precio volvió abajo: posible Judas bajista.")

    arr = sorted([x for x in niv if x["lado"] == "arriba" and not x["tomado"] and x["p"] > ultimo], key=lambda x: x["p"])
    aba = sorted([x for x in niv if x["lado"] == "abajo" and not x["tomado"] and x["p"] < ultimo], key=lambda x: -x["p"])
    if ultimo > mid:
        alc = dict(gatillo=f"Que sostenga arriba del 0.5 del overnight ({mid:,.2f}) y rompa el ORB de 5 min hacia arriba", invalida=f"Cierre de 5m abajo de {mid:,.2f}")
        baj = dict(gatillo=f"Que pierda el 0.5 del overnight ({mid:,.2f}) con desplazamiento y rompa el ORB hacia abajo", invalida=f"Recupera {onh:,.2f} (alto del overnight)")
    else:
        alc = dict(gatillo=f"Que recupere el 0.5 del overnight ({mid:,.2f}) con desplazamiento y rompa el ORB hacia arriba", invalida=f"Pierde {onl:,.2f} (bajo del overnight)")
        baj = dict(gatillo=f"Que se quede abajo del 0.5 del overnight ({mid:,.2f}) y rompa el ORB de 5 min hacia abajo", invalida=f"Cierre de 5m arriba de {mid:,.2f}")
    alc["objetivos"] = [dict(n=x["n"], p=x["p"], dist=x["dist"]) for x in arr[:3]]
    baj["objetivos"] = [dict(n=x["n"], p=x["p"], dist=x["dist"]) for x in aba[:3]]
    iman = min(arr[:1] + aba[:1], key=lambda x: abs(x["dist"]) / x["peso"], default=None)
    if iman: lectura.append(f"Imán más cercano (distancia contra peso): {iman['n']} en {iman['p']:,.2f} ({iman['dist']:+,.2f} pts).")

    s = df[(df.index >= on0 - pd.Timedelta(hours=2)) & (df.index <= ahora)]
    velas = [[int(t.timestamp()), round(o, 2), round(h, 2), round(l, 2), round(c, 2)] for t, o, h, l, c in
             zip(s.index, s.open, s.high, s.low, s.close)]
    zonas = [dict(n="Asia", a=int((on0 + pd.Timedelta(hours=2)).timestamp()), b=int((on0 + pd.Timedelta(hours=6)).timestamp())),
             dict(n="Londres", a=int((on0 + pd.Timedelta(hours=8)).timestamp()), b=int((on0 + pd.Timedelta(hours=11)).timestamp()))]
    niv.sort(key=lambda x: -x["p"])
    return dict(ultimo=ultimo, pdc=pdc, onh=onh, onl=onl, mid=round(mid, 2), on_rango=round(onh - onl, 2),
                on_prom=round(prom, 2) if prom else None, gap=round(gap, 2), niveles=niv, lectura=lectura,
                alcista=alc, bajista=baj, velas=velas, zonas=zonas)


def forexfactory():
    ev = json.loads(traer("https://nfs.faireconomy.media/ff_calendar_thisweek.json"))
    return sorted([dict(t=e["date"], pais=e["country"], titulo=e["title"], pronostico=e.get("forecast") or "", previo=e.get("previous") or "")
                   for e in ev if e.get("impact") == "High"], key=lambda x: x["t"])


def squawk(horas=16, maximo=30):
    raiz = XML.fromstring(traer("https://www.financialjuice.com/feed.ashx?xy=rss"))
    lim = pd.Timestamp.now(tz=MX) - pd.Timedelta(horas, "h")
    out = []
    for it in raiz.iter("item"):
        t = pd.Timestamp(parsedate_to_datetime(it.findtext("pubDate"))).tz_convert(MX)
        if t < lim: continue
        tit = re.sub(r"^FinancialJuice:\s*", "", html.unescape(it.findtext("title") or "")).strip()
        out.append(dict(t=t.isoformat(), titulo=tit, link=it.findtext("link"), clave=bool(CLAVE.search(tit))))
    return out[:maximo]


def google_news(q="stock futures Nasdaq when:1d", n=6):
    raiz = XML.fromstring(traer("https://news.google.com/rss/search?q=" + urllib.parse.quote(q) + "&hl=en-US&gl=US&ceid=US:en"))
    out = []
    for it in list(raiz.iter("item"))[:n]:
        tit = html.unescape(it.findtext("title") or "").rsplit(" - ", 1)
        out.append(dict(titulo=tit[0], fuente=tit[1] if len(tit) > 1 else "", link=it.findtext("link")))
    return out


def polymarket():
    vistos, out = set(), []
    for tag in ("fed", "economy", "tariffs", "geopolitics"):
        try: evs = json.loads(traer(f"https://gamma-api.polymarket.com/events?tag_slug={tag}&active=true&closed=false&order=volume24hr&ascending=false&limit=4"))
        except Exception: continue
        for e in evs:
            if e["id"] in vistos: continue
            vistos.add(e["id"])
            ms = []
            for m in e.get("markets", []):
                if m.get("closed"): continue
                try: ms.append(dict(n=m.get("groupItemTitle") or "Sí", p=float(json.loads(m.get("outcomePrices") or "[]")[0])))
                except Exception: pass
            ms.sort(key=lambda m: -m["p"])
            if ms: out.append(dict(t=e["title"], vol=float(e.get("volume") or 0), slug=e.get("slug"), m=ms[:3]))
    return sorted(out, key=lambda e: -e["vol"])[:8]


def cinta():
    out = []
    for nom, sim in CINTA:
        try:
            _, m = yahoo(sim, "5m", "1d")
            p, pc = m.get("regularMarketPrice"), m.get("chartPreviousClose") or m.get("previousClose")
            out.append(dict(n=nom, p=p, ch=round((p / pc - 1) * 100, 3) if p and pc else None))
        except Exception:
            out.append(dict(n=nom, p=None, ch=None))
    return out


def seguro(f, previo=None):
    try: return f()
    except Exception as e:
        print("  aviso:", f.__name__, e); return previo


def main():
    ruta = os.path.join(RAIZ, "data", "cafe.json")
    viejo = json.load(open(ruta)) if os.path.exists(ruta) else {}
    ahora = pd.Timestamp.now(tz=ET).floor("min")
    hoy = dia_de_trading(ahora)
    campana = pd.Timestamp(dt.datetime.combine(hoy, dt.time(9, 30)), tz=ET)
    D = dict(dia=str(hoy), generado=ahora.isoformat(), campana=campana.isoformat(), mercados={})
    for mer, sim in MERCADOS.items():
        try:
            df, _ = yahoo(sim)
            D["mercados"][mer] = analizar(mer, df[df.index <= ahora], ahora, hoy)
            print(f"{mer}: {D['mercados'][mer]['ultimo']:,.2f} · {len(D['mercados'][mer]['niveles'])} niveles")
        except Exception as e:
            print(f"  aviso: {mer} {e}")
            if viejo.get("dia") == str(hoy) and mer in viejo.get("mercados", {}): D["mercados"][mer] = viejo["mercados"][mer]
    D["forexfactory"] = seguro(forexfactory, viejo.get("forexfactory"))
    D["squawk"] = seguro(squawk, viejo.get("squawk"))
    D["google"] = seguro(google_news, viejo.get("google"))
    D["polymarket"] = seguro(polymarket, viejo.get("polymarket"))
    D["cinta"] = seguro(cinta, viejo.get("cinta"))
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, "w") as fh:
        json.dump(D, fh, ensure_ascii=False, separators=(",", ":"), default=str)
    print("listo:", ruta, os.path.getsize(ruta), "bytes")


if __name__ == "__main__":
    main()
