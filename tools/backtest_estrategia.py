# Backtest de la estrategia NORTHPOINT (condición FVG 9:35–9:45 → continuación 0.705 → TP interno, 1%, if W fuera, máx 2).
# Datos: nq5m.json = respuesta de Yahoo chart NQ=F interval=5m range=60d (bájala con tools/proxy.py). Uso: python3 tools/backtest_estrategia.py
import json, datetime, statistics, sys
d=json.load(open('nq5m.json'))['chart']['result'][0]; ts=d['timestamp']; q=d['indicators']['quote'][0]
tz=datetime.timezone(datetime.timedelta(hours=-4))
V=[]
for i,t in enumerate(ts):
    if q['high'][i] is None or q['low'][i] is None: continue
    dt=datetime.datetime.fromtimestamp(t,tz)
    if dt.second==59: continue                     # vela sintética de liquidación
    V.append(dict(d=dt.strftime('%Y-%m-%d'), m=dt.hour*60+dt.minute, o=q['open'][i], h=q['high'][i], l=q['low'][i], c=q['close'][i]))
# quitar el print de settlement en la vela de 16:55 del viernes: si close salta >0.06% del open y es la última del día, close=open
dias={}
for v in V: dias.setdefault(v['d'],[]).append(v)
PUNTO=2.0; CUENTA=50000; RIESGO_PCT=0.01; MAX_C=10; MAX_TRADES=2; PARAR_TRAS_GANADA=True; PARAR_TRAS_PERDIDAS=2; RANGO_MIN=12
def fvg_condicion(vs):
    cands=[]
    for i in range(2,len(vs)):
        if vs[i]['m']<9*60+35 or vs[i]['m']>9*60+45: continue
        alc=vs[i]['l']>vs[i-2]['h']; baj=vs[i]['h']<vs[i-2]['l']
        if not(alc or baj): continue
        f=dict(i=i,alc=alc,a=vs[i-2]['h'] if alc else vs[i]['h'], b=vs[i]['l'] if alc else vs[i-2]['l'], t=vs[i]['m'])
        if f['b']-f['a'] < vs[i]['c']*0.00015: continue
        desp=vs[i+1:]; alto=f['b']-f['a']
        iT=next((k for k,v in enumerate(desp) if v['l']<=f['b'] and v['h']>=f['a']),-1)
        iI=next((k for k,v in enumerate(desp) if (v['c']<f['a'] if alc else v['c']>f['b'])),-1)
        if iI>=0: f['estado']='invertido'; f['k']=iI
        elif iT>=0 and any((v['c']>f['b']+alto if alc else v['c']<f['a']-alto) for v in desp[iT+1:]): f['estado']='respetado'; f['k']=iT+1+next(k for k,v in enumerate(desp[iT+1:]) if (v['c']>f['b']+alto if alc else v['c']<f['a']-alto))
        else: f['estado']='sin resolver'; f['k']=None
        cands.append(f)
    if not cands: return None
    v945=next((v for v in vs if v['m']>=9*60+45), vs[-1]); p=v945['c']
    for f in cands: f['dist']= p-f['b'] if p>f['b'] else (f['a']-p if p<f['a'] else 0)
    return sorted(cands,key=lambda f:f['dist'])[0]
def simula_dia(vs, variante):
    pre=[v for v in vs if 9*60<=v['m']<16*60]; ses=[v for v in vs if 9*60+30<=v['m']<16*60]
    c=fvg_condicion(pre)
    if not c or c['estado']=='sin resolver': return dict(cond=c['estado'] if c else 'sin FVG', trades=[])
    dirn = c['alc'] if c['estado']=='respetado' else (not c['alc'])
    mRes = pre[c['i']+1+c['k']]['m']; i0=next((k for k,v in enumerate(ses) if v['m']>mRes), len(ses))  # primera vela después de la resolución
    trades=[]; i=i0; seguidas=0
    while i < len(ses)-3:
        tramo=ses[i:]; A = tramo[0]['l'] if dirn else tramo[0]['h']; B=None; ent=None
        for j in range(1,len(tramo)):
            v=tramo[j]
            if B is not None:
                rango=abs(B-A)
                if rango>=RANGO_MIN:
                    n705 = B-0.705*rango if dirn else B+0.705*rango
                    toca = v['l']<=n705 if dirn else v['h']>=n705
                    if toca and (v['h']<B if dirn else v['l']>B):
                        stop = A-max(2,rango*0.05) if dirn else A+max(2,rango*0.05)
                        tp = B if variante['tp']=='interno' else (n705+(n705-stop)*variante['rr'] if dirn else n705-(stop-n705)*variante['rr'])
                        ent=dict(j=i+j,m=v['m'],px=n705,stop=stop,tp=tp,A=A,B=B); break
            if (v['l']<A if dirn else v['h']>A): A = v['l'] if dirn else v['h']; B=None; continue
            if B is None or (v['h']>B if dirn else v['l']<B): B = v['h'] if dirn else v['l']
        if not ent: break
        if ent['m']>=15*60+30: break
        stopPts=abs(ent['px']-ent['stop']); contratos=max(1,min(MAX_C,int(CUENTA*RIESGO_PCT/(stopPts*PUNTO))))
        res=None; k=ent['j']+1
        while k < len(ses):
            v=ses[k]; sh = v['l']<=ent['stop'] if dirn else v['h']>=ent['stop']; th = v['h']>=ent['tp'] if dirn else v['l']<=ent['tp']
            if sh: res=('stop',ent['stop'],v['m']); break
            if th: res=('tp',ent['tp'],v['m']); break
            k+=1
        if not res: res=('cierre',ses[-1]['c'],ses[-1]['m']); k=len(ses)-1
        pts = res[1]-ent['px'] if dirn else ent['px']-res[1]; usd=pts*PUNTO*contratos; r=pts/stopPts
        trades.append(dict(m=ent['m'],dir='L' if dirn else 'S',px=ent['px'],stop=ent['stop'],tp=ent['tp'],res=res[0],salida=res[2],pts=pts,usd=usd,r=r,c=contratos))
        seguidas = seguidas+1 if usd<0 else 0
        if usd>0 and variante['ifw']: break
        if seguidas>=PARAR_TRAS_PERDIDAS: break
        if len(trades)>=variante['max']: break
        i=k+1
    return dict(cond=c['estado']+(' → '+('largos' if dirn else 'cortos')), trades=trades)
def corre(variante, nombre):
    dias_ok=[dd for dd in sorted(dias) if any(9*60+30<=v['m']<16*60 for v in dias[dd]) and datetime.date.fromisoformat(dd).weekday()<5]
    tot=0; wins=0; n=0; rs=[]; pnl_dias=[]; eq=0; pico=0; mdd=0; sin=0; det=[]
    for dd in dias_ok:
        s=simula_dia(dias[dd], variante); day=sum(t['usd'] for t in s['trades'])
        if not s['trades']: sin+=1
        for t in s['trades']:
            n+=1; tot+=t['usd']; rs.append(t['r']); wins+= 1 if t['usd']>0 else 0
        pnl_dias.append(day); eq+=day; pico=max(pico,eq); mdd=min(mdd,eq-pico)
        det.append((dd,s['cond'],round(day),[(t['m'],t['dir'],t['res'],round(t['r'],2)) for t in s['trades']]))
    g=[x for x in pnl_dias if x>0]; p=[x for x in pnl_dias if x<0]
    print(f"\n=== {nombre} ===")
    print(f"días operables {len(dias_ok)} · días con trade {len(dias_ok)-sin} · trades {n} · win rate {wins/max(1,n)*100:.0f}% · R prom {statistics.mean(rs) if rs else 0:+.2f} · total {tot:+,.0f} USD · mejor día {max(pnl_dias):+,.0f} · peor día {min(pnl_dias):+,.0f} · días verdes {len(g)} / rojos {len(p)} · max drawdown de la curva {mdd:,.0f}")
    pf = sum(t for t in [x for x in pnl_dias if x>0]) / max(1,-sum(x for x in pnl_dias if x<0))
    print(f"profit factor {pf:.2f} · promedio día verde {statistics.mean(g) if g else 0:+.0f} · día rojo {statistics.mean(p) if p else 0:+.0f}")
    return det
base=dict(tp='interno', rr=None, ifw=True, max=2)
det=corre(base, "TU PROTOCOLO · condición 9:35–9:45 → continuación en el 0.705 → TP interno · 1% · if W fuera · máx 2")
corre(dict(tp='interno', rr=None, ifw=False, max=2), "variante · sin 'if W fuera' (hasta 2 trades)")
corre(dict(tp='rr', rr=2.0, ifw=True, max=2), "variante · TP a 2R en vez de interno")
corre(dict(tp='rr', rr=1.0, ifw=True, max=2), "variante · TP a 1R")
print("\nDía a día (protocolo):")
for dd,cond,day,tr in det: print(f"{dd}  {cond:28s} {day:+6d}  {tr}")
