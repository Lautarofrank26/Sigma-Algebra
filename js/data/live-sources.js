/**
 * live-sources.js — catálogo de series que pueden actualizarse en vivo desde el navegador.
 * Cada entrada dice de dónde sale el dato más reciente. Los ids deben coincidir con los
 * de data/*.json (generados por tools/fetch-data.ps1, que usa las mismas series).
 *
 * kind:
 *   datosgob → API de series de datos.gob.ar (ref = id de la serie)
 *   bls      → BLS (GET de una serie; ref = id de la serie)
 *   treasury → curva de rendimientos del Tesoro de EE.UU. (field = columna del XML)
 *   nyfed    → tasas de la NY Fed (path = tasa)
 *   debt     → deuda pública total (Debt to the Penny)
 */

/** Argentina */
export const LIVE_AR = [
  { id: 'ipc', kind: 'datosgob', ref: '148.3_INIVELNAL_DICI_M_26', freq: 'M' },
  { id: 'core', kind: 'datosgob', ref: '148.3_INUCLEONAL_DICI_M_19', freq: 'M' },
  { id: 'regulated', kind: 'datosgob', ref: '148.3_IREGULANAL_DICI_M_22', freq: 'M' },
  { id: 'emae', kind: 'datosgob', ref: '143.3_NO_PR_2004_A_31', freq: 'M' },
  { id: 'ipi', kind: 'datosgob', ref: '453.1_SERIE_DESEADA_0_0_24_58', freq: 'M' },
  { id: 'gdp_level', kind: 'datosgob', ref: '9.2_PP2_2004_T_16', freq: 'Q' },
  { id: 'unemp', kind: 'datosgob', ref: '45.2_ECTDT_0_T_33', freq: 'Q', scale: 100 },
  { id: 'activity_rate', kind: 'datosgob', ref: '43.2_ECTAT_0_T_33', freq: 'Q', scale: 100 },
  { id: 'employment_rate', kind: 'datosgob', ref: '42.3_EPH_PUNTUATAL_0_M_24', freq: 'Q', scale: 100 },
  { id: 'wages', kind: 'datosgob', ref: '149.1_TL_INDIIOS_OCTU_0_21', freq: 'M' },
  { id: 'wages_priv', kind: 'datosgob', ref: '149.1_SOR_PRIADO_OCTU_0_25', freq: 'M' },
  { id: 'wages_pub', kind: 'datosgob', ref: '149.1_SOR_PUBICO_OCTU_0_14', freq: 'M' },
  { id: 'poverty_line', kind: 'datosgob', ref: '150.1_LA_POBREZA_0_D_13', freq: 'M' },
  { id: 'indigence_line', kind: 'datosgob', ref: '150.1_LA_INDICIA_0_D_16', freq: 'M' },
  { id: 'exports', kind: 'datosgob', ref: '74.3_IET_0_M_16', freq: 'M' },
  { id: 'imports', kind: 'datosgob', ref: '74.3_IIT_0_M_25', freq: 'M' },
  { id: 'trade_balance', kind: 'datosgob', ref: '74.3_ISC_0_M_19', freq: 'M' },
  { id: 'fx', kind: 'datosgob', ref: '168.1_T_CAMBIOR_D_0_0_26', freq: 'M', collapse: 'month', agg: 'avg' },
  { id: 'reserves', kind: 'datosgob', ref: '174.1_RRVAS_IDOS_0_0_36', freq: 'M', collapse: 'month', agg: 'end_of_period' },
  { id: 'm2', kind: 'datosgob', ref: '90.1_AMTMA_0_0_39', freq: 'M' },
  { id: 'loans', kind: 'datosgob', ref: '91.1_DETALLE_PRPOT_0_0_25', freq: 'M' },
  { id: 'time_deposits', kind: 'datosgob', ref: '90.1_DET_DESAGRTAL_0_0_44', freq: 'M' },
  { id: 'badlar', kind: 'datosgob', ref: '89.1_TIB_0_0_20', freq: 'M' },
  { id: 'primary_balance', kind: 'datosgob', ref: '452.3_RESULTADO_RIO_0_M_18_54', freq: 'M' },
  { id: 'financial_balance', kind: 'datosgob', ref: '379.9_RESULTADO_017__18_38', freq: 'M' },
];

/** Estados Unidos */
export const LIVE_US = [
  { id: 'cpi', kind: 'bls', ref: 'CUSR0000SA0', freq: 'M' },
  { id: 'corecpi', kind: 'bls', ref: 'CUSR0000SA0L1E', freq: 'M' },
  { id: 'cpi_energy', kind: 'bls', ref: 'CUSR0000SA0E', freq: 'M' },
  { id: 'cpi_food', kind: 'bls', ref: 'CUSR0000SAF1', freq: 'M' },
  { id: 'cpi_shelter', kind: 'bls', ref: 'CUSR0000SAH1', freq: 'M' },
  { id: 'cpi_services', kind: 'bls', ref: 'CUSR0000SASLE', freq: 'M' },
  { id: 'ppi', kind: 'bls', ref: 'WPSFD4', freq: 'M' },
  { id: 'unemp', kind: 'bls', ref: 'LNS14000000', freq: 'M' },
  { id: 'u6', kind: 'bls', ref: 'LNS13327709', freq: 'M' },
  { id: 'participation', kind: 'bls', ref: 'LNS11300000', freq: 'M' },
  { id: 'epop', kind: 'bls', ref: 'LNS12300000', freq: 'M' },
  { id: 'payrolls', kind: 'bls', ref: 'CES0000000001', freq: 'M' },
  { id: 'ahe', kind: 'bls', ref: 'CES0500000003', freq: 'M' },
  { id: 'hours', kind: 'bls', ref: 'CES0500000002', freq: 'M' },
  { id: 'jolts_openings', kind: 'bls', ref: 'JTS000000000000000JOL', freq: 'M' },
  { id: 'y3m', kind: 'treasury', field: 'BC_3MONTH', freq: 'M' },
  { id: 'y2', kind: 'treasury', field: 'BC_2YEAR', freq: 'M' },
  { id: 'y10', kind: 'treasury', field: 'BC_10YEAR', freq: 'M' },
  { id: 'y30', kind: 'treasury', field: 'BC_30YEAR', freq: 'M' },
  { id: 'fedfunds', kind: 'nyfed', path: 'unsecured/effr', freq: 'M' },
  { id: 'sofr', kind: 'nyfed', path: 'secured/sofr', freq: 'M' },
  { id: 'debt', kind: 'debt', freq: 'M' },
];

/**
 * Series derivadas: se recalculan en el navegador cuando llegan datos nuevos.
 *   real → nominal / deflactor × 100        diff → a − b
 */
export const DERIVED = {
  ar: [
    { id: 'wages_real', type: 'real', nominal: 'wages', deflator: 'ipc' },
    { id: 'wages_priv_real', type: 'real', nominal: 'wages_priv', deflator: 'ipc' },
    { id: 'wages_pub_real', type: 'real', nominal: 'wages_pub', deflator: 'ipc' },
    { id: 'loans_real', type: 'real', nominal: 'loans', deflator: 'ipc' },
    { id: 'm2_real', type: 'real', nominal: 'm2', deflator: 'ipc' },
  ],
  us: [{ id: 'curve', type: 'diff', a: 'y10', b: 'y2' }],
};
