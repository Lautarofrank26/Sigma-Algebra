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


EMAE_SECTORS = [
    ('emae_s_agro', 'Agro (agricultura, ganadería, caza y silvicultura)', '11.3_ISOM_2004_M_39'),
    ('emae_s_pesca', 'Pesca', '11.3_VIPAA_2004_M_5'),
    ('emae_s_minas', 'Minas y canteras', '11.3_ISD_2004_M_26'),
    ('emae_s_industria', 'Industria manufacturera', '11.3_VMASD_2004_M_23'),
    ('emae_s_electricidad', 'Electricidad, gas y agua', '11.3_ITC_2004_M_21'),
    ('emae_s_construccion', 'Construcción', '11.3_VMATC_2004_M_12'),
    ('emae_s_comercio', 'Comercio', '11.3_AGCS_2004_M_41'),
    ('emae_s_hoteles', 'Hoteles y restaurantes', '11.3_P_2004_M_20'),
    ('emae_s_transporte', 'Transporte y comunicaciones', '11.3_EMC_2004_M_25'),
    ('emae_s_financiero', 'Intermediación financiera', '11.3_IM_2004_M_25'),
    ('emae_s_inmobiliario', 'Inmobiliarias, empresariales y alquiler', '11.3_SEGA_2004_M_48'),
    ('emae_s_admin', 'Administración pública', '11.3_C_2004_M_60'),
    ('emae_s_ensenanza', 'Enseñanza', '11.3_CMMR_2004_M_10'),
    ('emae_s_salud', 'Salud', '11.3_HR_2004_M_24'),
]


def splice(old, new, at):
    """Empalme hacia atrás: antes de `at`, la serie vieja reescalada para coincidir con la nueva en `at` (mismo crecimiento)"""
    if at not in old or at not in new or not old[at]:
        raise RuntimeError(f'No hay mes en común ({at}) para empalmar')
    k = new[at] / old[at]
    out = {p: v * k for p, v in old.items() if p < at}
    out.update(new)
    return out


def activity(add):
    # La API devuelve todas las series de una consulta en la frecuencia más baja: mensuales y trimestrales van por separado
    monthly = ['143.3_NO_PR_2004_A_31', '143.3_NO_PR_2004_A_21', '10.3_ISD_1993_M_31', '10.3_ISOM_1993_M_29',
               '33.2_ISAC_SIN_EDAD_0_M_23_56', '32.3_ISE_2004_M_23', '31.3_UNG_2004_M_18', '29.3_UNG_2006_M_18'] + [s[2] for s in EMAE_SECTORS]
    quarterly = ['4.2_OGP_2004_T_17', '2.2_OGP_1993_T_17', '3.2_OGP_D_2004_T_17']
    d = {}
    for group in (monthly, quarterly):
        try:
            d.update(datos(group))
        except RuntimeError as e:
            log(f'  aviso actividad: {e}')
            d.update({i: {} for i in group})

    def safe(iid, label, unit, freq, source, fn, **extra):
        try:
            add(iid, label, unit, freq, source, pts(fn()), **extra)
        except (RuntimeError, KeyError) as e:
            log(f'  ERROR {iid}: {e}')
            add(iid, '', '', freq, '', [])

    # EMAE empalmado: base 1993 hasta dic-2003, base 2004 desde ene-2004 (antes de la intervención del INDEC)
    safe('emae_long', 'EMAE desestacionalizado, empalmado', 'índice 2004=100', 'M',
         'INDEC · EMAE base 1993 (hasta 2003) empalmado con base 2004',
         lambda: splice(d['10.3_ISD_1993_M_31'], d['143.3_NO_PR_2004_A_31'], '2004-01'))
    safe('emae_orig_long', 'EMAE serie original, empalmado', 'índice 2004=100', 'M',
         'INDEC · EMAE base 1993 (hasta 2003) empalmado con base 2004, serie original',
         lambda: splice(d['10.3_ISOM_1993_M_29'], d['143.3_NO_PR_2004_A_21'], '2004-01'))
    # PBI trimestral a precios constantes: base 1993 hasta 2003, base 2004 desde 2004
    safe('gdp_long', 'PBI a precios constantes, empalmado', 'millones de $ de 2004', 'Q',
         'INDEC · PBI base 1993 (hasta 2003) empalmado con base 2004',
         lambda: splice(d['2.2_OGP_1993_T_17'], d['4.2_OGP_2004_T_17'], '2004-01'))
    safe('gdp_sa', 'PBI desestacionalizado', 'millones de $ de 2004', 'Q',
         'INDEC · Oferta y demanda globales, PBI desestacionalizado base 2004', lambda: d['3.2_OGP_D_2004_T_17'])
    # ISAC sin estacionalidad: serie anterior (1993-2015) empalmada con la actual en ene-2012
    safe('isac_long', 'ISAC sin estacionalidad, empalmado', 'índice', 'M',
         'INDEC · ISAC serie anterior (hasta 2011) empalmada con la serie actual (desde 2012)',
         lambda: splice(d['32.3_ISE_2004_M_23'], d['33.2_ISAC_SIN_EDAD_0_M_23_56'], '2012-01'))
    # Capacidad instalada: dos metodologías sin mes en común, se muestran como series separadas
    safe('ucii', 'Utilización de la capacidad instalada (desde 2016)', '% de la capacidad', 'M',
         'INDEC · UCII, metodología actual', lambda: d['31.3_UNG_2004_M_18'])
    safe('ucii_old', 'Utilización de la capacidad instalada (2002-2015)', '% de la capacidad', 'M',
         'INDEC · UCII, metodología anterior', lambda: d['29.3_UNG_2006_M_18'])
    for iid, label, sid in EMAE_SECTORS:
        add(iid, label, 'índice 2004=100', 'M', 'INDEC · EMAE por sector, serie original', pts(d[sid]))


def employment(add, ipc):
    """Empleo e ingresos. `ipc` es el IPC empalmado {YYYY-MM: nivel} para deflactar (salarios y haber mínimo)."""
    monthly = ['152.1_TL_SIN_EST_2009_M_13', '151.1_AARIADODAD_2012_M_30',
               '149.1_SOR_PRIADO_OCTU_0_25', '149.1_SOR_PUBICO_OCTU_0_14', '149.1_SOR_PRIADO_OCTU_0_28', '58.1_MP_0_M_24']
    quarterly = ['45.2_ECTDT_0_T_33', '43.2_ECTAT_0_T_33', '42.3_EPH_PUNTUATAL_0_M_24', '65.1_CGI_0_0_21']
    semester = ['60.1_PP_0_0_15', '60.1_IP_0_0_20']
    annual = ['42.1_EPDT_0_A_30', '42.1_EPAT_0_A_27', '42.1_EPET_0_A_24']
    d = {}
    for group in (monthly, quarterly, semester, annual):
        try:
            d.update(datos(group))
        except RuntimeError as e:
            log(f'  aviso empleo: {e}')
            d.update({i: {} for i in group})
    pct = lambda s: {p: v * 100 for p, v in s.items()}  # las tasas vienen como proporción

    add('unemp_long', 'Tasa de desocupación (EPH continua)', '%', 'Q', 'INDEC · EPH continua, total aglomerados', pts(pct(d['45.2_ECTDT_0_T_33']), 4))
    add('activity_long', 'Tasa de actividad (EPH continua)', '%', 'Q', 'INDEC · EPH continua, total aglomerados', pts(pct(d['43.2_ECTAT_0_T_33']), 4))
    add('employment_long', 'Tasa de empleo (EPH continua)', '%', 'Q', 'INDEC · EPH continua, total aglomerados', pts(pct(d['42.3_EPH_PUNTUATAL_0_M_24']), 4))
    add('unemp_annual', 'Tasa de desocupación, anual', '%', 'A', 'INDEC · EPH puntual (1982-2002) y continua (desde 2003), promedio anual', pts(pct(d['42.1_EPDT_0_A_30']), 4))
    add('activity_annual', 'Tasa de actividad, anual', '%', 'A', 'INDEC · EPH puntual (1982-2002) y continua (desde 2003), promedio anual', pts(pct(d['42.1_EPAT_0_A_27']), 4))
    add('employment_annual', 'Tasa de empleo, anual', '%', 'A', 'INDEC · EPH puntual (1982-2002) y continua (desde 2003), promedio anual', pts(pct(d['42.1_EPET_0_A_24']), 4))
    add('gini', 'Coeficiente de Gini del ingreso per cápita familiar', 'índice 0-1', 'Q', 'INDEC · EPH, distribución del ingreso', pts(d['65.1_CGI_0_0_21'], 4))
    add('poverty_puntual', 'Pobreza, personas (EPH puntual, GBA)', '%', 'S', 'INDEC · EPH puntual, Gran Buenos Aires (mayo y octubre)', pts(pct(d['60.1_PP_0_0_15']), 4))
    add('indigence_puntual', 'Indigencia, personas (EPH puntual, GBA)', '%', 'S', 'INDEC · EPH puntual, Gran Buenos Aires (mayo y octubre)', pts(pct(d['60.1_IP_0_0_20']), 4))
    try:
        wb = json.loads(urllib.request.urlopen(urllib.request.Request(
            'https://api.worldbank.org/v2/country/ARG/indicator/SI.POV.NAHC?format=json&per_page=80', headers={'User-Agent': UA}), timeout=60).read())
        add('poverty_wb', 'Pobreza, personas (dato anual)', '%', 'A', 'Banco Mundial (SI.POV.NAHC), a partir de la EPH del INDEC',
            [[f"{x['date']}-01-01", x['value']] for x in sorted(wb[1], key=lambda x: x['date']) if x['value'] is not None])
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError, IndexError) as e:
        log(f'  aviso pobreza Banco Mundial: {e}')
        add('poverty_wb', '', '', 'A', '', [])

    # SIPA: la serie privada sin estacionalidad empieza en 2009; la pública solo se publica con estacionalidad
    # (la desestacionalizada está vacía en la API)
    add('sipa_priv', 'Asalariados registrados, sector privado', 'miles de personas', 'M', 'SIPA, sin estacionalidad (datos.gob.ar)', pts(d['152.1_TL_SIN_EST_2009_M_13']))
    add('sipa_pub', 'Asalariados registrados, sector público', 'miles de personas', 'M', 'SIPA, con estacionalidad (datos.gob.ar)', pts(d['151.1_AARIADODAD_2012_M_30']))

    # Salarios: nominales (índice oct-2016 = 100) y reales (deflactados por el IPC empalmado, oct-2016 = 100)
    def real_index(s, base='2016-10'):
        if base not in s or base not in ipc:
            return {}
        return {p: (v / ipc[p]) / (s[base] / ipc[base]) * 100 for p, v in s.items() if p in ipc}
    for iid, label, sid in (('w_priv', 'Salarios registrados, sector privado', '149.1_SOR_PRIADO_OCTU_0_25'),
                            ('w_pub', 'Salarios registrados, sector público', '149.1_SOR_PUBICO_OCTU_0_14'),
                            ('w_noreg', 'Salarios no registrados, sector privado', '149.1_SOR_PRIADO_OCTU_0_28')):
        add(f'{iid}_nom', f'{label} (nominal)', 'índice oct-16=100', 'M', 'INDEC · Índice de salarios', pts(d[sid]))
        add(f'{iid}_real', f'{label} (real)', 'índice oct-16=100, a precios constantes', 'M', 'Cálculo propio: INDEC índice de salarios deflactado por el IPC empalmado', pts(real_index(d[sid])))
    # Haber mínimo jubilatorio desde 1992 (antes la serie cambia de moneda): nominal y en pesos del último mes con IPC
    hm = {p: v for p, v in d['58.1_MP_0_M_24'].items() if p >= '1992-01'}
    last = max(p for p in hm if p in ipc) if any(p in ipc for p in hm) else None
    add('haber_min_nom', 'Haber mínimo jubilatorio (nominal)', 'pesos corrientes', 'M', 'ANSES / Secretaría de Seguridad Social (datos.gob.ar)', pts(hm))
    add('haber_min_real', 'Haber mínimo jubilatorio (real)', 'pesos del último mes con IPC', 'M', 'Cálculo propio: haber mínimo deflactado por el IPC empalmado',
        pts({p: v * ipc[last] / ipc[p] for p, v in hm.items() if p in ipc}) if last else [], base_month=last)


def external(add):
    """Sector externo: comercio (ICA) desde 1992, rubros, balanza energética, términos de intercambio y cuenta corriente."""
    # Rubros y combustibles: las versiones mensuales están vacías o cortadas en la API (datos.gob.ar); las trimestrales
    # del mismo ICA cubren de 1992 en adelante, así que estos gráficos son trimestrales
    monthly = ['74.3_IET_0_M_16', '74.3_IIT_0_M_25', '74.3_ISC_0_M_19']
    quarterly = ['74.2_IEPP_0_T_35', '75.2_ITMOA_0_T_13', '75.2_ITM_0_T_13', '74.2_IECE_0_T_35', '74.2_IICL_0_T_42', '82.2_ITI_2004_T_27']
    d = {}
    for group in (monthly, quarterly):
        try:
            d.update(datos(group, '1990-01-01'))
        except RuntimeError as e:
            log(f'  aviso externo: {e}')
            d.update({i: {} for i in group})
    ica = 'INDEC · Intercambio comercial argentino (ICA), en millones de dólares'
    add('expo_long', 'Exportaciones', 'USD millones', 'M', ica, pts(d['74.3_IET_0_M_16']))
    add('impo_long', 'Importaciones', 'USD millones', 'M', ica, pts(d['74.3_IIT_0_M_25']))
    add('saldo_long', 'Saldo comercial', 'USD millones', 'M', ica, pts(d['74.3_ISC_0_M_19']))
    add('expo_pp', 'Productos primarios', 'USD millones', 'Q', ica, pts(d['74.2_IEPP_0_T_35']))
    add('expo_moa', 'Manufacturas de origen agropecuario (MOA)', 'USD millones', 'Q', ica, pts(d['75.2_ITMOA_0_T_13']))
    add('expo_moi', 'Manufacturas de origen industrial (MOI)', 'USD millones', 'Q', ica, pts(d['75.2_ITM_0_T_13']))
    add('expo_cye', 'Combustibles y energía', 'USD millones', 'Q', ica, pts(d['74.2_IECE_0_T_35']))
    add('impo_comb', 'Importaciones de combustibles y lubricantes', 'USD millones', 'Q', ica, pts(d['74.2_IICL_0_T_42']))
    # Balanza energética: exportaciones de combustibles y energía menos importaciones de combustibles y lubricantes
    ce, ic = d['74.2_IECE_0_T_35'], d['74.2_IICL_0_T_42']
    add('energy_balance', 'Saldo energético', 'USD millones', 'Q', 'Cálculo propio sobre INDEC · ICA (exportaciones de combustibles y energía menos importaciones de combustibles y lubricantes)',
        pts({p: ce[p] - ic[p] for p in ce if p in ic}))
    add('tot', 'Términos del intercambio', 'índice 2004=100', 'Q', 'INDEC · Índice de términos del intercambio, base 2004', pts(d['82.2_ITI_2004_T_27']))
    # Cuenta corriente en % del PBI: FMI, World Economic Outlook (la misma serie que el mapa mundial, sin proyecciones)
    try:
        with open(os.path.join(ROOT, 'data', 'mapa', 'ca.json'), encoding='utf-8') as f:
            ca = json.load(f)
        arr = ca['c']['ARG']
        add('ca_gdp', 'Cuenta corriente', '% del PBI', 'A', 'FMI · World Economic Outlook (BCA_NGDPD)',
            [[f'{ca["from"] + i}-01-01', v] for i, v in enumerate(arr) if v is not None])
    except (OSError, KeyError, ValueError) as e:
        log(f'  aviso cuenta corriente: {e}')
        add('ca_gdp', '', '', 'A', '', [])


def main():
    try:
        with open(OUT, encoding='utf-8') as f:
            old = {i['id']: i for i in json.load(f)['indicators']}
    except (OSError, ValueError, KeyError):
        old = {}
    inds = []

    def add(iid, label, unit, freq, source, points, **extra):
        # Control: una serie mensual que llega solo con meses de inicio de trimestre vino colapsada por la API
        if freq == 'M' and len(points) > 24 and all(int(p[0][5:7]) in (1, 4, 7, 10) for p in points):
            log(f'  {iid}: llegó con frecuencia trimestral, se descarta')
            points = []
        if not points and iid in old and not (freq == 'M' and len(old[iid]['points']) > 24 and all(int(p[0][5:7]) in (1, 4, 7, 10) for p in old[iid]['points'])):
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

    # --- actividad ---
    activity(add)

    # --- empleo e ingresos (deflactado con el IPC empalmado recién armado, o el anterior si falló) ---
    ipc_ind = next((i for i in inds if i['id'] == 'ipc_long'), None)
    employment(add, {p[0][:7]: p[1] for p in ipc_ind['points']} if ipc_ind else {})

    # --- sector externo ---
    external(add)

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
