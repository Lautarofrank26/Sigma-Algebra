#!/usr/bin/env python3
"""
fetch-ar.py — series adicionales de Argentina para las secciones temáticas (complementa tools/fetch-data.ps1).

Escribe data/ar-extra.json con el mismo formato que data/argentina.json ({country, updated, indicators[]});
la página lo suma a los datos de cada sección que lo pida (campo `extraUrl` de la config, ver js/data/loader.js).
Los ids no se pisan con los de argentina.json.

Series (todas oficiales; nada se interpola ni se inventa):
  ipc_long   IPC empalmado, índice dic-2016 = 100, desde 1943:
               · 1943 a 2006 y mayo-nov 2016: inflación mensual del BCRA (variable 27, IPC del INDEC)
               · ene-2007 a abr-2016: IPC de la Provincia de San Luis (Dirección Provincial de Estadística y Censos),
                 serie alternativa usada en la literatura durante la intervención del INDEC
               · desde dic-2016: IPC nacional del INDEC (el mismo índice que usa la página)
  seasonal   IPC estacionales, nacional (INDEC)
  div_*      IPC por división (12), nacional (INDEC)
  ipim_yoy   IPIM, variación % interanual (INDEC): base 1993 hasta oct-2015 y base dic-2015 desde dic-2016.
             Entre nov-2015 y nov-2016 no hay dato: las dos bases no se pueden empalmar (no hay un mes en común).
  rem_12m    Expectativa de inflación de los próximos 12 meses, mediana del REM (BCRA, variable 29)
  rem_12m_target  la misma expectativa ubicada en el mes en que termina el período esperado (12 meses después),
             para compararla con la inflación que efectivamente ocurrió

Uso: python3 tools/fetch-ar.py
Si una fuente falla, se conserva la serie anterior de ese id (nunca se escribe una serie vacía).
"""
import datetime as dt
import json
import os
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'ar-extra.json')
UA = 'pulso-macro-data/1.0 (+https://github.com/Lautarofrank26/pulso-macro)'
DATOS = 'https://apis.datos.gob.ar/series/api/series/'
BCRA = 'https://api.bcra.gob.ar/estadisticas/v4.0/monetarias'

ALT_FROM, ALT_TO = '2007-01', '2016-04'  # tramo reemplazado por el IPC de San Luis

DIVISIONS = [
    ('div_alimentos', 'Alimentos y bebidas no alcohólicas', '146.3_IALIMENNAL_DICI_M_45'),
    ('div_bebidas', 'Bebidas alcohólicas y tabaco', '146.3_IBEBIDANAL_DICI_M_39'),
    ('div_prendas', 'Prendas de vestir y calzado', '146.3_IPRENDANAL_DICI_M_35'),
    ('div_vivienda', 'Vivienda, agua, electricidad y combustibles', '146.3_IVIVIENNAL_DICI_M_52'),
    ('div_equipamiento', 'Equipamiento y mantenimiento del hogar', '146.3_IEQUIPANAL_DICI_M_46'),
    ('div_salud', 'Salud', '146.3_ISALUDNAL_DICI_M_18'),
    ('div_transporte', 'Transporte', '146.3_ITRANSPNAL_DICI_M_23'),
    ('div_comunicacion', 'Comunicación', '146.3_ICOMUNINAL_DICI_M_27'),
    ('div_recreacion', 'Recreación y cultura', '146.3_IRECREANAL_DICI_M_31'),
    ('div_educacion', 'Educación', '146.3_IEDUCACNAL_DICI_M_22'),
    ('div_restaurantes', 'Restaurantes y hoteles', '146.3_IRESTAUNAL_DICI_M_33'),
    ('div_varios', 'Bienes y servicios varios', '146.3_IBIENESNAL_DICI_M_36'),
]


def log(*a):
    print(*a, flush=True)


def get_json(url, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read())
        except (urllib.error.URLError, TimeoutError, ConnectionError, ValueError) as e:
            last = e
            time.sleep(4 * (i + 1))
    raise RuntimeError(f'No se pudo descargar {url}: {last}')


def datos(ids, start='1900-01-01'):
    """{id: {YYYY-MM: valor}} desde la API de Series de Tiempo (datos.gob.ar), hasta 20 ids por consulta"""
    out = {i: {} for i in ids}
    for k in range(0, len(ids), 20):
        chunk = ids[k:k + 20]
        d = get_json(f'{DATOS}?ids={",".join(chunk)}&limit=5000&sort=asc&start_date={start}&format=json')
        for row in d['data']:
            for j, sid in enumerate(chunk):
                v = row[j + 1]
                if v is not None:
                    out[sid][row[0][:7]] = float(v)
    return out


def bcra(var):
    """{YYYY-MM: valor} de una variable mensual de la API de estadísticas del BCRA"""
    d = get_json(f'{BCRA}/{var}?desde=1940-01-01&hasta={dt.date.today().isoformat()}&limit=3000')
    det = d['results'][0]['detalle']
    return {x['fecha'][:7]: float(x['valor']) for x in det if x.get('valor') is not None}


def months(a, b):
    """Meses de a (incluido) a b (incluido), formato YYYY-MM"""
    y, m = int(a[:4]), int(a[5:7])
    out = []
    while f'{y}-{m:02d}' <= b:
        out.append(f'{y}-{m:02d}')
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


def prev_month(p):
    y, m = int(p[:4]), int(p[5:7])
    return f'{y - 1}-12' if m == 1 else f'{y}-{m - 1:02d}'


def shift(p, n):
    y, m = int(p[:4]), int(p[5:7]) - 1 + n
    return f'{y + m // 12}-{m % 12 + 1:02d}'


def pts(d, nd=6):
    """{YYYY-MM: v} -> [[YYYY-MM-01, v]] ordenado (6 cifras significativas para índices que van de 1e-11 a 1e3)"""
    return [[f'{p}-01', float(f'{v:.{nd}g}')] for p, v in sorted(d.items())]


def ipc_long(ipc_indec):
    """Índice empalmado dic-2016 = 100: hacia atrás con variaciones mensuales (BCRA y, en el tramo intervenido, San Luis)"""
    mom = bcra(27)  # inflación mensual oficial, % (1943 en adelante)
    sl = datos(['197.1_NIVEL_GENERAL_2014_0_13'])['197.1_NIVEL_GENERAL_2014_0_13']
    for p in months(ALT_FROM, ALT_TO):
        a, b = sl.get(prev_month(p)), sl.get(p)
        if a is None or b is None:
            raise RuntimeError(f'Falta el IPC de San Luis de {p}: no se arma la serie larga')
        mom[p] = (b / a - 1) * 100
    base = '2016-12'
    if base not in ipc_indec:
        raise RuntimeError('Falta el IPC nacional de dic-2016')
    level = {p: v / ipc_indec[base] * 100 for p, v in ipc_indec.items() if p >= base}
    p, cur = base, 100.0
    while True:  # hacia atrás: nivel(t-1) = nivel(t) / (1 + inflación(t))
        if p not in mom:
            break
        cur = cur / (1 + mom[p] / 100)
        p = prev_month(p)
        level[p] = cur
    return level


def yoy(level):
    return {p: (v / level[shift(p, -12)] - 1) * 100 for p, v in level.items() if shift(p, -12) in level}


def main():
    try:
        with open(OUT, encoding='utf-8') as f:
            old = {i['id']: i for i in json.load(f)['indicators']}
    except (OSError, ValueError, KeyError):
        old = {}
    inds = []

    def add(iid, label, unit, freq, source, points, **extra):
        if not points and iid in old:
            log(f'  {iid}: sin datos nuevos, se conserva la serie anterior')
            inds.append(old[iid])
            return
        if points:
            inds.append({'id': iid, 'label': label, 'unit': unit, 'freq': freq, 'source': source, 'points': points, **extra})
            log(f'  {iid}: {len(points)} puntos, {points[0][0]} a {points[-1][0]}')

    # --- precios ---
    base_ids = ['148.3_INIVELNAL_DICI_M_26', '148.3_IESTACINAL_DICI_M_25'] + [d[2] for d in DIVISIONS]
    try:
        cur = datos(base_ids, '2016-12-01')
    except RuntimeError as e:
        log(f'  aviso: {e}')
        cur = {i: {} for i in base_ids}
    try:
        add('ipc_long', 'IPC empalmado (INDEC / BCRA, con IPC San Luis 2007-2016)', 'índice dic-16=100', 'M',
            'BCRA (inflación mensual, INDEC) · IPC San Luis ene-2007 a abr-2016 · INDEC IPC nacional desde dic-2016',
            pts(ipc_long(cur['148.3_INIVELNAL_DICI_M_26'])),
            segments=[['1943-02-01', 'BCRA, inflación mensual oficial (IPC del INDEC)'],
                      [f'{ALT_FROM}-01', 'IPC de la Provincia de San Luis (serie alternativa durante la intervención del INDEC)'],
                      [f'{shift(ALT_TO, 1)}-01', 'BCRA, inflación mensual oficial (IPC del INDEC)'],
                      ['2016-12-01', 'INDEC, IPC nacional base dic-2016']])
    except RuntimeError as e:
        log(f'  ERROR ipc_long: {e}')
        add('ipc_long', '', '', 'M', '', [])
    add('seasonal', 'IPC estacionales', 'índice dic-16=100', 'M', 'INDEC', pts(cur['148.3_IESTACINAL_DICI_M_25']))
    for iid, label, sid in DIVISIONS:
        add(iid, label, 'índice dic-16=100', 'M', 'INDEC, IPC nacional por división', pts(cur[sid]))

    # IPIM: variación interanual de cada base por separado (no se empalman)
    try:
        ip = datos(['106.3_I1NG_1993_M_23', '448.1_NIVEL_GENERAL_0_0_13_46'], '1994-01-01')
        y = {**yoy(ip['106.3_I1NG_1993_M_23']), **yoy(ip['448.1_NIVEL_GENERAL_0_0_13_46'])}
        add('ipim_yoy', 'IPIM, variación interanual', '%', 'M', 'INDEC, IPIM base 1993 y base dic-2015', pts(y, 4))
    except RuntimeError as e:
        log(f'  aviso IPIM: {e}')
        add('ipim_yoy', '', '', 'M', '', [])

    # Expectativas (REM, BCRA)
    try:
        rem = bcra(29)
        add('rem_12m', 'Expectativa de inflación a 12 meses (REM, mediana)', '%', 'M', 'BCRA, Relevamiento de Expectativas de Mercado', pts(rem, 4))
        add('rem_12m_target', 'Inflación esperada 12 meses antes (REM, mediana)', '%', 'M', 'BCRA, REM (cada expectativa, ubicada en el mes en que termina el período esperado)',
            pts({shift(p, 12): v for p, v in rem.items()}, 4))
    except RuntimeError as e:
        log(f'  aviso REM: {e}')
        add('rem_12m', '', '', 'M', '', [])
        add('rem_12m_target', '', '', 'M', '', [])

    # Las series viejas que no se volvieron a generar se conservan
    ids = {i['id'] for i in inds}
    inds += [v for k, v in old.items() if k not in ids]
    if not inds:
        raise SystemExit('Sin datos: no se escribe el archivo')
    data = {'country': 'ar', 'updated': dt.date.today().isoformat(), 'indicators': inds}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    log(f'ar-extra.json: {len(inds)} series, {os.path.getsize(OUT) // 1024} KB')


if __name__ == '__main__':
    main()
