#!/usr/bin/env python3
"""
fetch-mapa.py — datos del mapa mundial de la portada (capas por variable, con historia larga).

Genera, en data/mapa/:
  index.json         variables disponibles, años, fuentes, códigos ISO2 (para los nombres en español) y qué
                     frecuencias altas (mensual / trimestral) tiene cada país
  <variable>.json    serie ANUAL de cada país (lo que pinta el mapa y el gráfico anual del país)
  pais/<ISO3>.json   series mensuales o trimestrales de ese país, si existen (solo para el gráfico del país)

Fuentes (todas oficiales o académicas, sin inventar ni interpolar valores):
  FMI WEO (API SDMX de api.imf.org)  crecimiento real, deuda, resultado fiscal, cuenta corriente, desempleo
                                      (sin proyecciones: se corta en el último año efectivo de cada serie)
  FMI Historical Public Debt          deuda/PBI antes de que empiece el WEO
  FMI CPI / LS / QNEA                 inflación mensual, desempleo trimestral, PBI trimestral (gráfico del país)
  Maddison Project Database 2023      PBI per cápita y población históricos; crecimiento antes de 1980
  Banco Mundial (API v2)              PBI per cápita PPA (extensión después de Maddison), inflación, peso en el
                                      PBI mundial, desempleo de respaldo, apertura comercial, población, Gini
  BIS WS_CBPOL                        tasas de política monetaria
  PNUD, Human Development Reports    IDH

Si una fuente falla, se conserva el archivo anterior de esa variable (nunca se escribe un archivo vacío).
Uso: python3 tools/fetch-mapa.py            (todas las variables)
     python3 tools/fetch-mapa.py gini hdi   (solo esas)
Solo usa la biblioteca estándar de Python 3.
"""
import csv
import datetime as dt
import io
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.request
import zipfile
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'mapa')
PAIS = os.path.join(OUT, 'pais')
TODAY = dt.date.today()
THIS_YEAR = TODAY.year
UA = 'pulso-macro-data/1.0 (+https://github.com/Lautarofrank26/pulso-macro)'

IMF = 'https://api.imf.org/external/sdmx/3.0/data/dataflow'
WB = 'https://api.worldbank.org/v2'
MADDISON = 'https://dataverse.nl/api/access/datafile/421302?format=original'  # mpd2023_web.xlsx (doi:10.34894/INZBF2)
HDR = 'https://hdr.undp.org/sites/default/files/2025_HDR/HDR25_Composite_indices_complete_time_series.csv'
BIS = 'https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/M?format=csv'

# Países de la zona euro y año de ingreso: desde ese año su tasa de política es la del BCE (BIS: XM)
EURO = {'AUT': 1999, 'BEL': 1999, 'FIN': 1999, 'FRA': 1999, 'DEU': 1999, 'IRL': 1999, 'ITA': 1999, 'LUX': 1999,
        'NLD': 1999, 'PRT': 1999, 'ESP': 1999, 'GRC': 2001, 'SVN': 2007, 'CYP': 2008, 'MLT': 2008, 'SVK': 2009,
        'EST': 2011, 'LVA': 2014, 'LTU': 2015, 'HRV': 2023, 'BGR': 2026}


def log(*a):
    print(*a, flush=True)


def get(url, accept=None, timeout=300, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, **({'Accept': accept} if accept else {})})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            last = e
            time.sleep(5 * (i + 1))
    raise RuntimeError(f'No se pudo descargar {url}: {last}')


def num(s):
    try:
        v = float(s)
        return v if math.isfinite(v) else None
    except (TypeError, ValueError):
        return None


def rnd(v, d=3):
    return None if v is None else round(v, d)


# ---------------------------------------------------------------- fuentes

def shapes_iso():
    with open(os.path.join(ROOT, 'data', 'paises.json'), encoding='utf-8') as f:
        return set(json.load(f).keys())


def wb_countries():
    """ISO3 -> ISO2 según el Banco Mundial (solo países, sin agregados)"""
    d = json.loads(get(f'{WB}/country?format=json&per_page=400'))
    return {c['id']: c['iso2Code'] for c in d[1] if c.get('region', {}).get('id') != 'NA'}


def wb_indicator(code, start=1960):
    """{ISO3: {año: valor}} de un indicador del Banco Mundial, todas las páginas"""
    out, page, pages = {}, 1, 1
    while page <= pages:
        d = json.loads(get(f'{WB}/country/all/indicator/{code}?format=json&per_page=20000&date={start}:{THIS_YEAR}&page={page}'))
        if not isinstance(d, list) or len(d) < 2 or d[1] is None:
            raise RuntimeError(f'Banco Mundial sin datos para {code}: {str(d)[:200]}')
        pages = d[0]['pages']
        for x in d[1]:
            v = num(x['value'])
            if v is not None and x['countryiso3code']:
                out.setdefault(x['countryiso3code'], {})[int(x['date'])] = v
        page += 1
    return out


def imf_csv(flow, key, params=''):
    raw = get(f'{IMF}/{flow}/+/{key}{params}', accept='application/vnd.sdmx.data+csv;version=2.0.0;labels=id', timeout=900)
    return list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))


def weo(indicator):
    """{ISO3: {año: valor}} del WEO, solo años efectivos (sin proyecciones). Devuelve también el año de la edición."""
    rows = imf_csv('IMF.RES/WEO', f'*.{indicator}.A', '?attributes=all')
    latest = {}
    for r in rows:
        r['_v'] = num(r.get('OBS_VALUE'))
        # "2025", o "FY2024/25" en países con año fiscal: se toma el primer año, para no dejar pasar una proyección
        m = re.search(r'(\d{4})', r.get('LATEST_ACTUAL_ANNUAL_DATA') or '')
        if m and r.get('INDICATOR') == indicator:
            latest[r['COUNTRY']] = int(m.group(1))
    # El FMI informa el "último año efectivo" solo para algunos países; para el resto se usa el más frecuente entre
    # los informados en esta edición (en la de octubre suele ser el año anterior). Así nunca entra una proyección.
    counts = {}
    for y in latest.values():
        counts[y] = counts.get(y, 0) + 1
    default_last = max(counts, key=counts.get) if counts else THIS_YEAR - 1
    out, dropped, no_latest = {}, 0, set()
    for r in rows:
        if r.get('INDICATOR') != indicator:  # la API puede devolver otros indicadores además del pedido
            continue
        if not re.match(r'\d{4}', r.get('TIME_PERIOD') or ''):
            continue
        iso, y, v = r['COUNTRY'], int(r['TIME_PERIOD'][:4]), r['_v']
        if v is None:
            continue
        last = latest.get(iso)
        if last is None:
            no_latest.add(iso)
            last = default_last
        if y > last:
            dropped += 1
            continue
        out.setdefault(iso, {})[y] = v
    log(f'  WEO {indicator}: {len(out)} países, {dropped} proyecciones descartadas, {len(no_latest)} con el último año efectivo de la edición ({default_last})')
    return out


def xlsx_sheet(blob, wanted):
    """Lee una hoja de un .xlsx (biblioteca estándar): lista de filas (listas de celdas)"""
    z = zipfile.ZipFile(io.BytesIO(blob))
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
          'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', ns):
            shared.append(''.join(t.text or '' for t in si.iter(f'{{{ns["m"]}}}t')))
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    target = None
    for s in wb.find('m:sheets', ns):
        if s.get('name') == wanted:
            rid = s.get(f'{{{ns["r"]}}}id')
            for rel in rels:
                if rel.get('Id') == rid:
                    target = 'xl/' + rel.get('Target').lstrip('/').replace('xl/', '')
    if not target:
        raise RuntimeError(f'No está la hoja {wanted}')
    rows = []
    for row in ET.fromstring(z.read(target)).iter(f'{{{ns["m"]}}}row'):
        cells = {}
        for c in row.findall('m:c', ns):
            col = re.match(r'[A-Z]+', c.get('r')).group(0)
            ci = 0
            for ch in col:
                ci = ci * 26 + ord(ch) - 64
            v = c.find('m:v', ns)
            val = v.text if v is not None else None
            if c.get('t') == 's' and val is not None:
                val = shared[int(val)]
            cells[ci - 1] = val
        rows.append([cells.get(i) for i in range(max(cells) + 1)] if cells else [])
    return rows


_maddison = None


def maddison():
    """{ISO3: {año: (pbi_pc, poblacion_en_miles)}} de la Maddison Project Database 2023"""
    global _maddison
    if _maddison is None:
        rows = xlsx_sheet(get(MADDISON), 'Full data')
        head = [str(h).strip() for h in rows[0]]
        ic, iy, ig, ip = head.index('countrycode'), head.index('year'), head.index('gdppc'), head.index('pop')
        out = {}
        for r in rows[1:]:
            if len(r) <= max(ic, iy, ig, ip) or not r[ic]:
                continue
            y = int(float(r[iy]))
            out.setdefault(r[ic], {})[y] = (num(r[ig]), num(r[ip]))
        _maddison = out
        log(f'  Maddison: {len(out)} países')
    return _maddison


# ---------------------------------------------------------------- armado de capas

def pack(key, series, segs, sources, unit, decimals=3, world=None, world_src=None, start=None, note=None):
    """Escribe data/mapa/<key>.json con arreglos alineados por año"""
    years = [y for s in series.values() for y in s]
    if not years:
        raise RuntimeError(f'{key}: sin datos')
    y0 = max(min(years), start) if start else min(years)
    y1 = max(years)
    arr = lambda s: [rnd(s.get(y), decimals) for y in range(y0, y1 + 1)]
    c = {iso: arr(s) for iso, s in sorted(series.items()) if any(s.get(y) is not None for y in range(y0, y1 + 1))}
    if len(c) < 30:
        raise RuntimeError(f'{key}: muy pocos países ({len(c)}), se conserva el archivo anterior')
    # año por defecto: el último con buena cobertura (al menos el 70 % de los países del año de mayor cobertura),
    # así el mapa no arranca casi gris por un año que solo publicaron unos pocos países
    cover = [sum(1 for a in c.values() if a[i] is not None) for i in range(y1 - y0 + 1)]
    best = max(cover)
    last = y0 + max(i for i, n in enumerate(cover) if n >= best * 0.7)
    data = {'key': key, 'updated': TODAY.isoformat(), 'unit': unit, 'from': y0, 'to': y1, 'last': last,
            'sources': sources, 'c': c, 'seg': {iso: segs[iso] for iso in c if iso in segs}}
    if note:
        data['note'] = note
    if world:
        data['world'] = arr(world)
        data['worldSrc'] = world_src
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, f'{key}.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    log(f'  -> {key}.json: {len(c)} países, {y0}-{y1}, año por defecto {last}')
    return {'from': y0, 'to': y1, 'last': last, 'updated': TODAY.isoformat()}


def only(d, valid):
    return {k: v for k, v in d.items() if k in valid}


def layer_gdppc(valid):
    md = maddison()
    wb = wb_indicator('NY.GDP.PCAP.PP.KD', 1990)
    series, segs = {}, {}
    for iso in valid:
        m = {y: g for y, (g, _) in md.get(iso, {}).items() if g is not None and y >= 1820}
        if not m:
            continue
        s = dict(m)
        last = max(m)
        w = wb.get(iso, {})
        seg = [[min(m), 'mad']]
        # Después del último año de Maddison se extiende con la variación del PBI per cápita PPA del Banco Mundial
        # (encadenamiento: mismo crecimiento, misma unidad de Maddison). Solo si el Banco Mundial tiene el año base.
        if last in w and any(y > last for y in w):
            for y in sorted(y for y in w if y > last):
                s[y] = m[last] * w[y] / w[last]
            seg.append([last + 1, 'wbx'])
        series[iso], segs[iso] = s, seg
    wld = wb.get('WLD', {})
    return pack('gdppc', series, segs, {
        'mad': 'Maddison Project Database 2023 (Bolt y van Zanden), US$ internacionales de 2011',
        'wbx': 'Extensión propia: Maddison encadenado con la variación del PBI per cápita PPA del Banco Mundial (NY.GDP.PCAP.PP.KD)',
    }, 'US$ internacionales de 2011 (PPA)', decimals=0,
        note='Hasta el último año de Maddison, dato de Maddison; después, ese valor movido con el crecimiento que publica el Banco Mundial.')


def layer_gdp(valid):
    w = weo('NGDP_RPCH')
    md = maddison()
    wbw = wb_indicator('NY.GDP.MKTP.KD.ZG', 1961).get('WLD', {})
    series, segs = {}, {}
    for iso in valid:
        s, seg = {}, []
        first_weo = min(w[iso]) if iso in w else None
        m = md.get(iso, {})
        # Antes del WEO: crecimiento del PBI real de Maddison (PBI per cápita × población), solo entre años consecutivos
        for y in sorted(m):
            if y < 1821 or (first_weo and y >= first_weo):
                continue
            a, b = m.get(y - 1), m.get(y)
            if a and b and None not in a and None not in b and a[0] * a[1] > 0:
                s[y] = (b[0] * b[1] / (a[0] * a[1]) - 1) * 100
        if s:
            seg.append([min(s), 'mad'])
        if iso in w:
            s.update(w[iso])
            seg.append([first_weo, 'weo'])
        if s:
            series[iso], segs[iso] = s, seg
    return pack('gdp', series, segs, {
        'weo': 'FMI, World Economic Outlook (NGDP_RPCH)',
        'mad': 'Cálculo propio sobre Maddison Project Database 2023 (PBI per cápita × población)',
    }, '% anual', decimals=2, world=wbw, world_src='Banco Mundial, mundo (NY.GDP.MKTP.KD.ZG)', start=1900)


def layer_infl(valid):
    wb = wb_indicator('FP.CPI.TOTL.ZG', 1960)
    series = only(wb, valid)
    segs = {iso: [[min(s), 'wb']] for iso, s in series.items()}
    # Igual que antes en el mapa: si el Banco Mundial todavía no publicó el último año de Argentina o EE.UU.,
    # se calcula con la misma definición (promedio anual del índice de precios) sobre nuestras propias series.
    for iso, fname, sid in (('ARG', 'argentina', 'ipc'), ('USA', 'usa', 'cpi')):
        try:
            with open(os.path.join(ROOT, 'data', f'{fname}.json'), encoding='utf-8') as f:
                j = json.load(f)
            pts = next(i for i in j['indicators'] if i['id'] == sid)['points']
            by = {}
            for d, v in pts:
                by.setdefault(int(d[:4]), {})[int(d[5:7])] = float(v)
            for y in sorted(by, reverse=True):
                if y >= THIS_YEAR or (y - 1) not in by:
                    continue
                common = [mo for mo in by[y] if mo in by[y - 1]]
                if len(common) < 10:
                    continue
                own = (sum(by[y][mo] for mo in common) / sum(by[y - 1][mo] for mo in common) - 1) * 100
                cur = max(series.get(iso, {}) or [0])
                if y > cur:
                    series.setdefault(iso, {})[y] = own
                    segs.setdefault(iso, [[y, 'wb']]).append([y, 'own'])
                break
        except Exception as e:  # noqa: BLE001
            log(f'  aviso: inflación propia {iso}: {e}')
    return pack('infl', series, segs, {
        'wb': 'Banco Mundial (FP.CPI.TOTL.ZG), promedio anual de precios al consumidor',
        'own': 'Cálculo propio con el IPC del INDEC / CPI del BLS (misma definición), hasta que publique el Banco Mundial',
    }, '% anual (promedio)', decimals=2, world=wb.get('WLD'), world_src='Banco Mundial, mundo (FP.CPI.TOTL.ZG)')


def layer_share(valid):
    wb = wb_indicator('NY.GDP.MKTP.CD', 1960)
    world = wb.get('WLD', {})
    series = {}
    for iso in valid:
        s = {y: v / world[y] * 100 for y, v in wb.get(iso, {}).items() if world.get(y)}
        if s:
            series[iso] = s
    return pack('share', series, {iso: [[min(s), 'wb']] for iso, s in series.items()}, {
        'wb': 'Cálculo propio: PBI en US$ corrientes del país sobre el PBI mundial (Banco Mundial, NY.GDP.MKTP.CD)',
    }, '% del PBI mundial', decimals=3)


def layer_unemp(valid):
    w = weo('LUR')
    wb = wb_indicator('SL.UEM.TOTL.ZS', 1991)
    series, segs = {}, {}
    for iso in valid:
        # Una sola fuente por país (no se mezclan definiciones): FMI WEO; si no la tiene, OIT vía Banco Mundial
        if iso in w:
            series[iso], segs[iso] = w[iso], [[min(w[iso]), 'weo']]
        elif iso in wb:
            series[iso], segs[iso] = wb[iso], [[min(wb[iso]), 'ilo']]
    return pack('unemp', series, segs, {
        'weo': 'FMI, World Economic Outlook (LUR)',
        'ilo': 'OIT, estimación modelada (Banco Mundial, SL.UEM.TOTL.ZS)',
    }, '% de la fuerza laboral', decimals=2, world=wb.get('WLD'), world_src='OIT vía Banco Mundial, mundo (SL.UEM.TOTL.ZS)')


def layer_weo_simple(key, indicator, unit, label):
    w = weo(indicator)
    valid = shapes_iso()
    series = only(w, valid)
    return pack(key, series, {iso: [[min(s), 'weo']] for iso, s in series.items()},
                {'weo': f'FMI, World Economic Outlook ({indicator})'}, unit, decimals=2)


def layer_debt(valid):
    w = weo('GGXWDG_NGDP')
    rows = imf_csv('IMF.FAD/HPD', '*.G63G_S13_POFYGDP.A')
    hpd = {}
    for r in rows:
        v = num(r.get('OBS_VALUE'))
        if v is not None and r.get('INDICATOR') == 'G63G_S13_POFYGDP' and re.match(r'\d{4}', r.get('TIME_PERIOD') or ''):
            hpd.setdefault(r['COUNTRY'], {})[int(r['TIME_PERIOD'][:4])] = v
    log(f'  HPD: {len(hpd)} países')
    series, segs = {}, {}
    for iso in valid:
        s, seg = {}, []
        first_weo = min(w[iso]) if iso in w else None
        h = {y: v for y, v in hpd.get(iso, {}).items() if not first_weo or y < first_weo}
        if h:
            s.update(h)
            seg.append([min(h), 'hpd'])
        if iso in w:
            s.update(w[iso])
            seg.append([first_weo, 'weo'])
        if s:
            series[iso], segs[iso] = s, seg
    return pack('debt', series, segs, {
        'weo': 'FMI, World Economic Outlook (GGXWDG_NGDP), deuda bruta del gobierno general',
        'hpd': 'FMI, Historical Public Debt Database (deuda bruta del gobierno)',
    }, '% del PBI', decimals=2, start=1800)


def layer_pop(valid):
    md = maddison()
    wb = wb_indicator('SP.POP.TOTL', 1960)
    series, segs = {}, {}
    for iso in valid:
        s, seg = {}, []
        w = wb.get(iso, {})
        first_wb = min(w) if w else None
        for y, (_, p) in md.get(iso, {}).items():
            if p is not None and y >= 1820 and (not first_wb or y < first_wb):
                s[y] = p / 1000  # Maddison está en miles
        if s:
            seg.append([min(s), 'mad'])
        if w:
            s.update({y: v / 1e6 for y, v in w.items()})
            seg.append([first_wb, 'wb'])
        if s:
            series[iso], segs[iso] = s, seg
    return pack('pop', series, segs, {
        'mad': 'Maddison Project Database 2023',
        'wb': 'Banco Mundial (SP.POP.TOTL), sobre la base de ONU Población',
    }, 'millones de personas', decimals=3)


def layer_wb_simple(key, code, unit, label, start=1960, world=True):
    wb = wb_indicator(code, start)
    series = only(wb, shapes_iso())
    return pack(key, series, {iso: [[min(s), 'wb']] for iso, s in series.items()},
                {'wb': f'Banco Mundial ({code})'}, unit, decimals=2,
                world=wb.get('WLD') if world else None, world_src=f'Banco Mundial, mundo ({code})' if world else None)


def layer_hdi(valid):
    rows = list(csv.DictReader(io.StringIO(get(HDR).decode('latin-1'))))
    series, world = {}, None
    for r in rows:
        s = {}
        for k, v in r.items():
            m = re.fullmatch(r'hdi_(\d{4})', k or '')
            if m and num(v) is not None:
                s[int(m.group(1))] = num(v)
        if r.get('iso3') == 'ZZK.WORLD':
            world = s
        elif r.get('iso3') in valid and s:
            series[r['iso3']] = s
    return pack('hdi', series, {iso: [[min(s), 'hdr']] for iso, s in series.items()},
                {'hdr': 'PNUD, Human Development Report 2025, serie histórica de índices compuestos'},
                'índice (0 a 1)', decimals=3, world=world, world_src='PNUD, mundo')


def layer_rate(valid, iso2):
    rows = list(csv.DictReader(io.StringIO(get(BIS).decode('utf-8-sig'))))
    to3 = {v: k for k, v in iso2.items()}
    monthly = {}
    for r in rows:
        v = num(r.get('OBS_VALUE'))
        if v is None:
            continue
        monthly.setdefault(r['REF_AREA'], {})[r['TIME_PERIOD']] = v
    log(f'  BIS: {len(monthly)} áreas')
    by_iso = {}
    for a, s in monthly.items():
        iso = to3.get(a)
        if iso:
            by_iso[iso] = dict(s)
    # Zona euro: desde el ingreso, la tasa del BCE (BIS publica la de cada país hasta la víspera del euro)
    ecb = monthly.get('XM', {})
    euro_from = {}
    for iso, y in EURO.items():
        s = by_iso.setdefault(iso, {})
        for p, v in ecb.items():
            if int(p[:4]) >= y:
                s[p] = v
        if any(int(p[:4]) >= y for p in ecb):
            euro_from[iso] = y
    series, segs = {}, {}
    for iso, s in by_iso.items():
        if iso not in valid:
            continue
        # Dato anual del mapa: fin de período (diciembre). Un año sin diciembre publicado no se muestra.
        ann = {int(p[:4]): v for p, v in s.items() if p[5:7] == '12'}
        if ann:
            series[iso] = ann
            segs[iso] = [[min(ann), 'bis']] + ([[euro_from[iso], 'ecb']] if iso in euro_from and euro_from[iso] > min(ann) else [])
            if iso in euro_from and euro_from[iso] <= min(ann):
                segs[iso] = [[min(ann), 'ecb']]
    info = pack('rate', series, segs, {
        'bis': 'BIS, tasas de política de los bancos centrales (WS_CBPOL), fin de período',
        'ecb': 'BIS, tasa del BCE para la zona euro (WS_CBPOL, XM), fin de período',
    }, '% anual, fin de año (diciembre)', decimals=2)
    return info, by_iso


# ---------------------------------------------------------------- frecuencias altas (gráfico del país)

def to_arrays(points, kind):
    """{periodo: valor} -> (primer periodo, arreglo continuo con None en los huecos)"""
    keys = sorted(points)
    if not keys:
        return None, []
    def idx(p):
        y = int(p[:4])
        if kind == 'M':
            return y * 12 + int(p[5:7]) - 1
        return y * 4 + int(p[-1]) - 1
    i0, i1 = idx(keys[0]), idx(keys[-1])
    arr = [None] * (i1 - i0 + 1)
    for p, v in points.items():
        arr[idx(p) - i0] = rnd(v, 3)
    return keys[0], arr


def high_freq(valid, rate_monthly):
    per = {}

    def put(iso, var, freq, payload):
        per.setdefault(iso, {}).setdefault(var, {})[freq] = payload

    # Inflación mensual: IPC total, variación % mensual e interanual calculadas por el FMI
    try:
        rows = imf_csv('IMF.STA/CPI', '*.CPI._T.POP_PCH_PA_PT%2BYOY_PCH_PA_PT.M')
        acc = {}
        for r in rows:
            v = num(r.get('OBS_VALUE'))
            if v is None or r['COUNTRY'] not in valid or r.get('INDEX_TYPE') != 'CPI' or r.get('COICOP_1999') != '_T' or r.get('FREQUENCY') != 'M':
                continue
            if r.get('TYPE_OF_TRANSFORMATION') not in ('POP_PCH_PA_PT', 'YOY_PCH_PA_PT'):
                continue
            p = r['TIME_PERIOD'].replace('-M', '-')
            t = 'mom' if r['TYPE_OF_TRANSFORMATION'].startswith('POP') else 'yoy'
            acc.setdefault(r['COUNTRY'], {}).setdefault(t, {})[p[:7]] = v
        for iso, d in acc.items():
            allp = sorted(set(d.get('mom', {})) | set(d.get('yoy', {})))
            if len(allp) < 12:
                continue
            f0, yoy = to_arrays({p: d.get('yoy', {}).get(p) for p in allp}, 'M')
            _, mom = to_arrays({p: d.get('mom', {}).get(p) for p in allp}, 'M')
            put(iso, 'infl', 'M', {'from': f0, 'yoy': yoy, 'mom': mom})
        log(f'  CPI mensual: {len(acc)} países')
    except Exception as e:  # noqa: BLE001
        log(f'  aviso: inflación mensual no disponible: {e}')

    # Tasa de política mensual (fin de mes)
    for iso, s in rate_monthly.items():
        if iso in valid and len(s) >= 12:
            f0, arr = to_arrays(s, 'M')
            put(iso, 'rate', 'M', {'from': f0, 'v': arr})

    # Desempleo trimestral (FMI, Labor Statistics: tasa de desocupación)
    try:
        rows = imf_csv('IMF.STA/LS', '*.U.PT.Q')
        acc = {}
        for r in rows:
            v = num(r.get('OBS_VALUE'))
            if v is not None and r['COUNTRY'] in valid and r.get('INDICATOR') == 'U' and r.get('TYPE_OF_TRANSFORMATION') == 'PT' and r.get('FREQUENCY') == 'Q':
                acc.setdefault(r['COUNTRY'], {})[r['TIME_PERIOD']] = v
        for iso, s in acc.items():
            if len(s) >= 8:
                f0, arr = to_arrays(s, 'Q')
                put(iso, 'unemp', 'Q', {'from': f0, 'v': arr})
        log(f'  Desempleo trimestral: {len(acc)} países')
    except Exception as e:  # noqa: BLE001
        log(f'  aviso: desempleo trimestral no disponible: {e}')

    # PBI trimestral: variación % interanual del PBI real (volumen encadenado, moneda local), calculada
    # sobre la serie sin desestacionalizar; si el país solo publica la desestacionalizada, sobre esa.
    try:
        rows = imf_csv('IMF.STA/QNEA', '*.B1GQ.Q.NSA%2BSA.XDC.Q')
        acc = {}
        for r in rows:
            v = num(r.get('OBS_VALUE'))
            if v is not None and r['COUNTRY'] in valid and r.get('INDICATOR') == 'B1GQ' and r.get('PRICE_TYPE') == 'Q' and r.get('TYPE_OF_TRANSFORMATION') == 'XDC' and r.get('FREQUENCY') == 'Q':
                acc.setdefault(r['COUNTRY'], {}).setdefault(r['S_ADJUSTMENT'], {})[r['TIME_PERIOD']] = v
        n = 0
        for iso, by in acc.items():
            s = by.get('NSA') or by.get('SA')
            yoy = {}
            for p, v in s.items():
                prev = f'{int(p[:4]) - 1}{p[4:]}'
                if prev in s and s[prev]:
                    yoy[p] = (v / s[prev] - 1) * 100
            if len(yoy) >= 8:
                f0, arr = to_arrays(yoy, 'Q')
                put(iso, 'gdp', 'Q', {'from': f0, 'v': arr, 'sa': 'NSA' not in by})
                n += 1
        log(f'  PBI trimestral: {n} países')
    except Exception as e:  # noqa: BLE001
        log(f'  aviso: PBI trimestral no disponible: {e}')

    if not per:
        return {}
    os.makedirs(PAIS, exist_ok=True)
    flags = {}
    for iso, d in per.items():
        with open(os.path.join(PAIS, f'{iso}.json'), 'w', encoding='utf-8') as f:
            json.dump(d, f, separators=(',', ':'))
        flags[iso] = {var: sorted(fr) for var, fr in d.items()}
    return flags


# ---------------------------------------------------------------- principal

def main():
    wanted = set(sys.argv[1:])
    valid = shapes_iso()
    iso2 = wb_countries()
    idx_file = os.path.join(OUT, 'index.json')
    try:
        with open(idx_file, encoding='utf-8') as f:
            index = json.load(f)
    except (OSError, ValueError):
        index = {'vars': {}, 'hf': {}}

    rate_monthly = {}
    jobs = [
        ('gdp', lambda: layer_gdp(valid)),
        ('share', lambda: layer_share(valid)),
        ('gdppc', lambda: layer_gdppc(valid)),
        ('infl', lambda: layer_infl(valid)),
        ('rate', None),
        ('debt', lambda: layer_debt(valid)),
        ('fiscal', lambda: layer_weo_simple('fiscal', 'GGXCNL_NGDP', '% del PBI', 'Resultado fiscal')),
        ('ca', lambda: layer_weo_simple('ca', 'BCA_NGDPD', '% del PBI', 'Cuenta corriente')),
        ('open', lambda: layer_wb_simple('open', 'NE.TRD.GNFS.ZS', '% del PBI', 'Apertura comercial')),
        ('unemp', lambda: layer_unemp(valid)),
        ('pop', lambda: layer_pop(valid)),
        ('gini', lambda: layer_wb_simple('gini', 'SI.POV.GINI', 'índice (0 a 100)', 'Gini', world=False)),
        ('hdi', lambda: layer_hdi(valid)),
    ]
    failed = []
    for key, fn in jobs:
        if wanted and key not in wanted:
            continue
        log(f'{key}…')
        try:
            if key == 'rate':
                info, rate_monthly = layer_rate(valid, iso2)
            else:
                info = fn()
            index['vars'][key] = info
        except Exception as e:  # noqa: BLE001
            failed.append(key)
            log(f'  ERROR {key}: {e} (se conserva el archivo anterior)')

    if not wanted or wanted & {'hf', 'infl', 'rate', 'unemp', 'gdp'}:
        log('frecuencias altas…')
        if not rate_monthly:
            try:
                _, rate_monthly = layer_rate(valid, iso2)
            except Exception as e:  # noqa: BLE001
                log(f'  aviso: BIS mensual: {e}')
        flags = high_freq(valid, rate_monthly)
        if flags:
            index['hf'] = flags

    index['updated'] = TODAY.isoformat()
    index['iso2'] = {k: v for k, v in iso2.items() if k in valid}
    with open(idx_file, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, separators=(',', ':'))
    log(f'index.json listo. Fallaron: {failed or "ninguna"}')
    # Falla solo si no salió nada: así el workflow no sube un estado roto, pero tampoco se frena por una fuente caída
    if failed and len(failed) == len([j for j in jobs if not wanted or j[0] in wanted]):
        sys.exit(1)


if __name__ == '__main__':
    main()
