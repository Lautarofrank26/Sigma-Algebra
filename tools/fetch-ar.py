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

Dinero y tasas (BCRA, API de estadísticas monetarias; las series diarias se promedian por mes, solo meses completos):
  rate_policy / rate_badlar / rate_tamar / rate_pf30 / rate_caucion   tasas nominales anuales (política monetaria: la serie
             oficial termina el 10-jul-2025; plazo fijo a 30 días desde abr-1991; caución = pases entre terceros a 1 día)
  rate_real_exante  BADLAR efectiva anual (capitalización a 30 días) deflactada por el REM a 12 meses (mediana)
  base_*, m2p_*, loans_total_*, loans_<tipo>_*, dep_pesos_*   nivel en miles de millones de pesos, `_nom` (corrientes) y
             `_real` (pesos del último mes con IPC, con el IPC empalmado). M2 privado: serie `m2` de data/argentina.json
  dep_usd_nom  depósitos en dólares del sector privado, millones de USD

Frente fiscal (Secretaría de Hacienda, esquema ahorro-inversión-financiamiento, trimestral; ArgentinaDatos; FMI):
  fis_ing_*, fis_gas_*, fis_g_<rubro>_*  ingresos totales, gastos primarios (= ingresos - resultado primario) y rubros, `_nom` y `_real`
  fis_primario_pbi / fis_financiero_pbi  % del PBI, 4 trimestres (el PIB corriente trimestral del INDEC viene anualizado: se promedia)
  rec_total_* / rec_dgi_* / rec_dga_*  recaudación mensual desde 1997;  riesgo_pais  EMBI mensual;  debt_gdp  deuda bruta, FMI
Tipo de cambio (BCRA): fx_mayorista, itcrm (planilla ITCRMSerie.xlsx), reserves_bcra, bcra_compras, band_floor / band_ceiling /
  band_mayorista (bandas desde abr-2025, variables 1187 y 1188)

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
UA = 'pulso-macro-data/1.0 (+https://github.com/Lautarofrank26/Sigma-Algebra)'
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


def bcra_daily(var, start='1990-01-01'):
    """[(YYYY-MM-DD, valor)] ordenado, de una variable diaria de la API de estadísticas del BCRA"""
    d = get_json(f'{BCRA}/{var}?desde={start}&hasta={dt.date.today().isoformat()}&limit=3000')
    det = d['results'][0]['detalle']
    out = sorted((x['fecha'], float(x['valor'])) for x in det if x.get('valor') is not None)
    if len(det) >= 3000:  # la API pagina: se sigue hasta traer todo el historial
        got = {f for f, _ in out}
        first = out[0][0]
        while True:
            d = get_json(f'{BCRA}/{var}?desde={start}&hasta={shift_day(first, -1)}&limit=3000')
            more = [(x['fecha'], float(x['valor'])) for x in d['results'][0]['detalle'] if x.get('valor') is not None and x['fecha'] not in got]
            if not more:
                break
            out = sorted(more + out)
            got |= {f for f, _ in more}
            first = out[0][0]
            if len(d['results'][0]['detalle']) < 3000:
                break
    return out


def shift_day(day, n):
    return (dt.date.fromisoformat(day) + dt.timedelta(days=n)).isoformat()


def monthly(daily, how='avg'):
    """Serie diaria -> mensual: 'avg' promedio, 'last' valor del último día del mes, 'sum' suma. Solo meses completos: nunca el mes
    en curso y, si la serie dejó de publicarse, tampoco el último mes si cortó antes del día 25 (un dato de pocos días no
    representa al mes)."""
    if not daily:
        return {}
    cur = dt.date.today().isoformat()[:7]
    last_day = daily[-1][0]
    acc = {}
    for day, v in daily:
        acc.setdefault(day[:7], []).append(v)
    fn = {'avg': lambda vs: sum(vs) / len(vs), 'last': lambda vs: vs[-1], 'sum': sum}[how]
    out = {p: fn(vs) for p, vs in acc.items() if p < cur}
    if int(last_day[8:10]) < 25:
        out.pop(last_day[:7], None)
    return out


def monthly_avg(daily):
    return monthly(daily, 'avg')


NS_X = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'


def read_xlsx(url):
    """{hoja: [{columna: valor}]} de un .xlsx publicado (solo biblioteca estándar; los números quedan como texto)"""
    import io
    import re
    import zipfile
    import xml.etree.ElementTree as ET
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=120) as r:
        z = zipfile.ZipFile(io.BytesIO(r.read()))
    ss = [''.join(t.text or '' for t in si.iter(NS_X + 't')) for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall(NS_X + 'si')]
    names = [s.get('name') for s in ET.fromstring(z.read('xl/workbook.xml')).find(NS_X + 'sheets')]
    out = {}
    for k, name in enumerate(names, 1):
        rows = []
        for row in ET.fromstring(z.read(f'xl/worksheets/sheet{k}.xml')).find(NS_X + 'sheetData').findall(NS_X + 'row'):
            d = {}
            for c in row.findall(NS_X + 'c'):
                v = c.find(NS_X + 'v')
                if v is not None:
                    d[re.match(r'[A-Z]+', c.get('r')).group()] = ss[int(v.text)] if c.get('t') == 's' else v.text
            rows.append(d)
        out[name] = rows
    return out


def excel_day(serial):
    return (dt.date(1899, 12, 30) + dt.timedelta(days=int(float(serial)))).isoformat()


def monetary(add, ipc):
    """Dinero y tasas: tasas (BCRA), base monetaria, M2, préstamos por tipo y depósitos, en pesos corrientes y en términos reales.
    Las series del BCRA son diarias: se promedian por mes (solo meses completos). `ipc` es el IPC empalmado {YYYY-MM: nivel}."""
    src = 'BCRA · Estadísticas monetarias'
    cache = {}

    def mm(var, start='1990-01-01'):
        if var not in cache:
            cache[var] = monthly_avg(bcra_daily(var, start))
        return cache[var]

    def real(s):
        """Pesos del último mes con IPC; devuelve (serie, mes base)"""
        have = [p for p in s if p in ipc]
        if not have:
            return {}, None
        last = max(have)
        return {p: v * ipc[last] / ipc[p] for p, v in s.items() if p in ipc}, last

    def level(iid, label, unit, var, start='1990-01-01', scale=1e-3, with_real=True):
        try:
            s = {p: v * scale for p, v in mm(var, start).items()}
        except RuntimeError as e:
            log(f'  aviso {iid}: {e}')
            s = {}
        add(iid + '_nom', f'{label} (nominal)', unit, 'M', f'{src} · promedio mensual de datos diarios', pts(s))
        if with_real:
            r, base = real(s)
            add(iid + '_real', f'{label} (real)', 'miles de millones de pesos del último mes con IPC', 'M',
                f'Cálculo propio: {src} (promedio mensual) deflactado por el IPC empalmado', pts(r), base_month=base)

    # Tasas nominales anuales, % (promedio mensual de datos diarios)
    for iid, label, var, start, note in (
        ('rate_policy', 'Tasa de política monetaria', 160, '2015-12-01', 'BCRA · Tasa de política monetaria (serie discontinuada el 10-jul-2025)'),
        ('rate_badlar', 'BADLAR bancos privados', 7, '1999-01-01', 'BCRA · BADLAR bancos privados, TNA'),
        ('rate_tamar', 'TAMAR bancos privados', 44, '2024-10-01', 'BCRA · TAMAR bancos privados, TNA'),
        # desde abril de 1991 (Convertibilidad): antes, en la hiperinflación, la serie no es comparable con el resto
        ('rate_pf30', 'Plazo fijo a 30 días', 12, '1991-04-01', 'BCRA · Depósitos a 30 días de plazo, TNA (desde abr-1991)'),
        ('rate_caucion', 'Caución (pases entre terceros a 1 día)', 150, '2008-01-01', 'BCRA · Pases entre terceros a 1 día, TNA'),
    ):
        try:
            add(iid, label, '% anual (TNA)', 'M', f'{note} · promedio mensual', pts(mm(var, start), 4))
        except RuntimeError as e:
            log(f'  aviso {iid}: {e}')
            add(iid, '', '', 'M', '', [])

    # Tasa real ex ante: BADLAR efectiva anual (capitalización a 30 días) frente a la inflación esperada a 12 meses (REM, mediana)
    try:
        rem = bcra(29)
        bad = mm(7, '1999-01-01')
        ex = {p: ((1 + bad[p] / 100 * 30 / 365) ** (365 / 30) / (1 + rem[p] / 100) - 1) * 100 for p in bad if p in rem}
        add('rate_real_exante', 'Tasa real ex ante (BADLAR efectiva vs. REM 12 meses)', '%', 'M',
            'Cálculo propio: BADLAR bancos privados (BCRA) convertida a tasa efectiva anual y deflactada por la inflación esperada a 12 meses (REM, BCRA)', pts(ex, 4))
    except (RuntimeError, KeyError) as e:
        log(f'  aviso tasa real ex ante: {e}')
        add('rate_real_exante', '', '', 'M', '', [])

    # Agregados monetarios y crédito, millones de pesos
    level('base', 'Base monetaria', 'miles de millones de pesos', 15)
    # M2 privado: el BCRA publica por variable solo la variación interanual (var. 25) y el nivel de M2 total (var. 109, incluye el sector
    # público). El nivel de M2 privado es la serie `m2` de data/argentina.json (promedio mensual, desde 2010), cuya variación interanual
    # coincide con la variable 25 del BCRA (dif. de 1 a 2 puntos por usar promedio mensual en vez de móvil de 30 días).
    try:
        with open(os.path.join(ROOT, 'data', 'argentina.json'), encoding='utf-8') as f:
            m2p = {p[0][:7]: p[1] for i in json.load(f)['indicators'] if i['id'] == 'm2' for p in i['points']}
    except (OSError, ValueError, KeyError) as e:
        log(f'  aviso M2 privado: {e}')
        m2p = {}
    m2p = {p: v * 1e-3 for p, v in m2p.items()}
    add('m2p_nom', 'M2 privado (nominal)', 'miles de millones de pesos', 'M', f'{src} · M2 privado, promedio mensual (datos.gob.ar)', pts(m2p))
    m2r, m2base = real(m2p)
    add('m2p_real', 'M2 privado (real)', 'miles de millones de pesos del último mes con IPC', 'M',
        f'Cálculo propio: {src} · M2 privado deflactado por el IPC empalmado', pts(m2r), base_month=m2base)
    level('loans_total', 'Préstamos al sector privado', 'miles de millones de pesos', 117, '2002-01-01')
    for key, label, var in (('personal', 'Personales', 114), ('tarjeta', 'Tarjetas de crédito', 115), ('hipot', 'Hipotecarios', 112),
                            ('prend', 'Prendarios', 113), ('doc', 'Documentos', 111), ('adel', 'Adelantos en cuenta corriente', 110), ('otros', 'Otros', 116)):
        level(f'loans_{key}', f'Préstamos {label.lower()}', 'miles de millones de pesos', var, '2002-01-01')

    # Depósitos del sector privado no financiero
    level('dep_pesos', 'Depósitos en pesos del sector privado', 'miles de millones de pesos', 100, '2002-01-01')
    level('dep_usd', 'Depósitos en dólares del sector privado', 'millones de USD', 108, '2002-01-01', scale=1.0, with_real=False)


# Esquema ahorro-inversión-financiamiento (IMIG, Secretaría de Hacienda): versión trimestral de cada rubro. Las versiones
# mensuales de varios rubros (combustibles, derechos de importación, subsidios a la energía, FGS...) vienen vacías en la API.
IMIG_ING = ['452.1_BIENES_PERLES_0_A_17_92', '452.1_COMBUSTIBLLES_0_A_12_22', '452.1_INGRESOS_CTAL_0_A_16_68', '452.1_GANANCIASIAS_0_A_9_40',
            '452.1_IMPUESTOS_NOS_0_A_18_32', '452.1_DEBITOS_CRTOS_0_A_16_94', '452.1_DERECHOS_IION_0_A_20_41', '452.1_RESTO_INGRTES_0_A_25_63',
            '452.1_TRANSFERENTES_0_A_25_23', '452.1_INGRESOS_NIOS_0_A_23_61', '452.1_DERECHOS_EION_0_A_20_86', '452.1_IVA_NETO_RROS_0_A_19_89',
            '452.1_RESTO_TRIBIOS_0_A_17_88', '452.1_FGS_COBRADERO_0_A_53_62', '452.1_APORTES_COIAL_0_A_39_80', '452.1_RESTO_RENTDAD_0_A_22_48']
IMIG_G = {
    'jub': ['452.1_JUBILACIONVAS_0_A_36_30'],
    'prest': ['452.2_OTROS_PROGMAS_0_T_15_7', '452.2_ASIGNACIONIJO_0_T_26_195', '452.2_PRESTACIONSJP_0_T_19_19', '452.2_PENSIONES_VAS_0_T_26_93'],
    'subs': ['452.2_ENERGIAGIA_0_T_7_79', '452.2_TRANSPORTERTE_0_T_10_81', '452.2_OTRAS_FUNCNES_0_T_15_27'],
    'prov': ['452.2_TRANSFERENRAS_0_T_42_54', '452.2_TRANSFERENION_0_T_46_39', '452.2_TRANSFERENLUD_0_T_42_99', '452.2_TRANSFERENIAL_0_T_54_18', '452.2_TRANSFERENIAL_0_T_53_76'],
    'func': ['452.2_SALARIOSIOS_0_T_8_28', '452.2_OTROS_GASTNTO_0_T_27_58'],
    'cap': ['452.2_CAPITAL_ENION_0_T_22_25', '452.2_CAPITAL_VIION_0_T_23_91', '452.2_CAPITAL_EDION_0_T_24_98', '452.2_CAPITAL_OTION_0_T_20_97',
            '452.2_FONDO_FEDERIO_0_T_23_1', '452.2_CAPITAL_TRION_0_T_25_18', '452.2_CAPITAL_AGION_0_T_41_79', '452.2_CAPITAL_OTIAS_0_T_38_17',
            '452.2_CAPITAL_EDIAS_0_T_42_72', '452.2_CAPITAL_ENIAS_0_T_40_14', '452.2_CAPITAL_VIIAS_0_T_41_33', '452.2_CAPITAL_TRIAS_0_T_43_2',
            '452.2_CAPITAL_AGIAS_0_T_59_85'],
}
IMIG_PR, IMIG_FI = '452.2_RESULTADO_RIO_0_T_18_21', '452.2_RESULTADO_ERO_0_T_20_32'
PBI_CORRIENTE = '9.2_PPC_2004_T_22'  # PIB a precios corrientes, millones de pesos, trimestral (INDEC)
RECAUDACION = [('rec_total', 'Recaudación tributaria total', '172.3_TL_RECAION_M_0_0_17'), ('rec_dgi', 'Recaudación DGI (impuestos nacionales)', '172.3_SOTAL_DDGI_M_0_0_12'),
               ('rec_dga', 'Recaudación DGA (comercio exterior)', '172.3_SOTAL_DDGA_M_0_0_12'), ('rec_ss', 'Recaudación de la seguridad social', '172.3_SRIDAD_IAL_M_0_0_16')]


def fiscal(add, ipc):
    """Frente fiscal: ingresos, gastos primarios y su composición (trimestral, IMIG), resultados en % del PBI, recaudación (mensual),
    riesgo país y deuda. `ipc` es el IPC empalmado {YYYY-MM: nivel}."""
    src = 'Secretaría de Hacienda · Esquema ahorro-inversión-financiamiento, base caja (datos.gob.ar)'
    ids = IMIG_ING + [i for v in IMIG_G.values() for i in v] + [IMIG_PR, IMIG_FI]
    try:
        d = datos(ids, '2016-01-01')
        pbi = datos([PBI_CORRIENTE], '2004-01-01')[PBI_CORRIENTE]
    except RuntimeError as e:
        log(f'  aviso fiscal IMIG: {e}')
        d, pbi = {}, {}

    def qipc(p):
        v = [ipc.get(m) for m in (p, shift(p, 1), shift(p, 2))]
        return sum(v) / 3 if all(x is not None for x in v) else None

    def put(iid, label, nom, base_note='trimestral'):
        """Serie trimestral en pesos corrientes y en pesos del último trimestre con IPC, en miles de millones"""
        nom = {p: v * 1e-3 for p, v in nom.items()}
        add(iid + '_nom', f'{label} (nominal)', 'miles de millones de pesos', 'Q', src, pts(nom))
        have = [p for p in nom if qipc(p)]
        if have:
            base = max(have)
            add(iid + '_real', f'{label} (real)', 'miles de millones de pesos del último trimestre con IPC', 'Q',
                f'Cálculo propio: {src}, deflactado por el IPC empalmado', pts({p: v * qipc(base) / qipc(p) for p, v in nom.items() if qipc(p)}), base_month=base)

    prim = d.get(IMIG_PR, {})
    if prim:
        quarters = [p for p in sorted(prim) if all(p in d[i] for i in IMIG_ING)]
        ing = {p: sum(d[i][p] for i in IMIG_ING) for p in quarters}
        gas = {p: ing[p] - prim[p] for p in quarters}  # gastos primarios = ingresos totales - resultado primario (identidad del esquema)
        cats = {k: {p: sum(d[i].get(p, 0) for i in v) for p in quarters} for k, v in IMIG_G.items()}
        cats['otros'] = {p: gas[p] - sum(c[p] for c in cats.values()) for p in quarters}
        share = [cats['otros'][p] / gas[p] for p in quarters[-8:]]
        log(f'  fiscal: "otros gastos" (resto sin apertura) = {min(share) * 100:.1f}% a {max(share) * 100:.1f}% del gasto primario en los últimos 8 trimestres')
        put('fis_ing', 'Ingresos totales', ing)
        put('fis_gas', 'Gastos primarios', gas)
        for k, label in (('jub', 'Jubilaciones y pensiones contributivas'), ('prest', 'Otras prestaciones sociales'), ('subs', 'Subsidios económicos'),
                         ('prov', 'Transferencias corrientes a provincias'), ('func', 'Salarios y gastos de funcionamiento'),
                         ('cap', 'Gastos de capital'), ('otros', 'Otros gastos primarios')):
            put(f'fis_g_{k}', label, cats[k])
        # Resultado primario y financiero en % del PBI: suma de cuatro trimestres sobre el PIB corriente anual. El INDEC publica el PIB
        # trimestral en valores anualizados, así que el PIB de un año es el promedio de sus cuatro trimestres (no la suma).
        # Control: 2024 da superávit primario de 1,8% del PBI y financiero de 0,3%, los valores oficiales.
        fin = d.get(IMIG_FI, {})
        for iid, label, s in (('fis_primario_pbi', 'Resultado primario', prim), ('fis_financiero_pbi', 'Resultado financiero', fin)):
            out = {}
            for p in sorted(s):
                qs = [shift(p, -3 * k) for k in range(4)]
                if all(q in s and q in pbi for q in qs):
                    out[p] = sum(s[q] for q in qs) / (sum(pbi[q] for q in qs) / 4) * 100
            add(iid, f'{label} (acumulado de 4 trimestres)', '% del PBI', 'Q',
                f'Cálculo propio: {src} sobre PIB a precios corrientes (INDEC)', pts(out, 4))
    else:
        for iid in ('fis_ing', 'fis_gas'):
            add(iid + '_nom', '', '', 'Q', '', [])

    # Recaudación tributaria nacional mensual (Secretaría de Hacienda / ARCA), desde 1997
    try:
        rd = datos([r[2] for r in RECAUDACION], '1997-01-01')
    except RuntimeError as e:
        log(f'  aviso recaudación: {e}')
        rd = {r[2]: {} for r in RECAUDACION}
    for iid, label, sid in RECAUDACION:
        s = {p: v * 1e-3 for p, v in rd[sid].items()}
        have = [p for p in s if p in ipc]
        add(iid + '_nom', f'{label} (nominal)', 'miles de millones de pesos', 'M', 'Secretaría de Hacienda / ARCA · Recaudación tributaria (datos.gob.ar)', pts(s))
        if have:
            base = max(have)
            add(iid + '_real', f'{label} (real)', 'miles de millones de pesos del último mes con IPC', 'M',
                'Cálculo propio: recaudación (Secretaría de Hacienda / ARCA) deflactada por el IPC empalmado',
                pts({p: v * ipc[base] / ipc[p] for p, v in s.items() if p in ipc}), base_month=base)

    # Riesgo país (EMBI de JP Morgan, vía ArgentinaDatos): promedio mensual de los datos diarios
    try:
        rp = get_json('https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais')
        add('riesgo_pais', 'Riesgo país (EMBI)', 'puntos básicos', 'M', 'JP Morgan (EMBI Argentina), vía ArgentinaDatos · promedio mensual de datos diarios',
            pts(monthly(sorted((x['fecha'], float(x['valor'])) for x in rp), 'avg'), 5))
    except (RuntimeError, KeyError, ValueError) as e:
        log(f'  aviso riesgo país: {e}')
        add('riesgo_pais', '', '', 'M', '', [])

    # Deuda del gobierno general, bruta, % del PBI: FMI, World Economic Outlook (la misma serie que el mapa mundial)
    try:
        with open(os.path.join(ROOT, 'data', 'mapa', 'debt.json'), encoding='utf-8') as f:
            debt = json.load(f)
        add('debt_gdp', 'Deuda bruta del gobierno general', '% del PBI', 'A', 'FMI · World Economic Outlook (GGXWDG_NGDP)',
            [[f'{debt["from"] + i}-01-01', v] for i, v in enumerate(debt['c']['ARG']) if v is not None and debt['from'] + i <= debt['last']])
    except (OSError, KeyError, ValueError) as e:
        log(f'  aviso deuda: {e}')
        add('debt_gdp', '', '', 'A', '', [])


def fx(add):
    """Tipo de cambio: mayorista (BCRA), tipo de cambio real multilateral, reservas brutas, compras de divisas y bandas cambiarias."""
    src = 'BCRA · Estadísticas monetarias'
    maya = bcra_daily(5, '2002-01-01')  # mayorista de referencia
    add('fx_mayorista', 'Dólar mayorista de referencia', 'pesos por dólar', 'M', f'{src} · Comunicación A 3500, promedio mensual de datos diarios', pts(monthly(maya, 'avg'), 6))
    try:
        add('reserves_bcra', 'Reservas internacionales brutas', 'USD millones', 'M', f'{src} · fin de mes', pts(monthly(bcra_daily(1, '1996-01-01'), 'last'), 6))
    except RuntimeError as e:
        log(f'  aviso reservas: {e}')
        add('reserves_bcra', '', '', 'M', '', [])
    try:
        add('bcra_compras', 'Compras de divisas del BCRA', 'USD millones', 'M', f'{src} · variación de reservas por compra de divisas, suma mensual',
            pts(monthly(bcra_daily(78, '2003-01-01'), 'sum'), 6))
    except RuntimeError as e:
        log(f'  aviso compras: {e}')
        add('bcra_compras', '', '', 'M', '', [])
    # ITCRM (base 17-12-15 = 100): planilla del BCRA, promedio mensual. Los últimos meses son provisorios (usan expectativas del REM).
    try:
        sheet = read_xlsx('https://www.bcra.gob.ar/Pdfs/PublicacionesEstadisticas/ITCRMSerie.xlsx')['ITCRM y bilaterales prom. mens.']
        s = {}
        for row in sheet:
            a, b = row.get('A', ''), row.get('B', '')
            if a.replace('.', '', 1).isdigit() and b.replace('.', '', 1).isdigit():
                s[excel_day(a)[:7]] = float(b)
        add('itcrm', 'Tipo de cambio real multilateral (ITCRM)', 'índice 17-dic-2015 = 100', 'M',
            'BCRA · Índice de tipo de cambio real multilateral (los últimos meses son provisorios)', pts(s, 6))
    except (OSError, RuntimeError, KeyError, ValueError, urllib.error.URLError) as e:
        log(f'  aviso ITCRM: {e}')
        add('itcrm', '', '', 'M', '', [])
    # Bandas de flotación (desde el 14-abr-2025): variables del BCRA (límite inferior y superior, diarias)
    try:
        bsrc = 'BCRA · Régimen de bandas cambiarias, promedio mensual de datos diarios'
        add('band_floor', 'Piso de la banda cambiaria', 'pesos por dólar', 'M', bsrc, pts(monthly(bcra_daily(1187, '2025-04-01'), 'avg'), 6))
        add('band_ceiling', 'Techo de la banda cambiaria', 'pesos por dólar', 'M', bsrc, pts(monthly(bcra_daily(1188, '2025-04-01'), 'avg'), 6))
        # El mayorista desde que rigen las bandas, para dibujarlo junto al piso y al techo en la misma ventana
        add('band_mayorista', 'Dólar mayorista de referencia', 'pesos por dólar', 'M', f'{src} · promedio mensual de datos diarios',
            pts({p: v for p, v in monthly(maya, 'avg').items() if p >= '2025-04'}, 6))
    except RuntimeError as e:
        log(f'  aviso bandas: {e}')
        add('band_floor', '', '', 'M', '', [])
        add('band_ceiling', '', '', 'M', '', [])

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

    # --- dinero y tasas (deflactado con el IPC empalmado) ---
    ipc_ind = next((i for i in inds if i['id'] == 'ipc_long'), None)
    ipc_d = {p[0][:7]: p[1] for p in ipc_ind['points']} if ipc_ind else {}
    monetary(add, ipc_d)

    # --- frente fiscal y tipo de cambio ---
    fiscal(add, ipc_d)
    fx(add)

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
