/**
 * world-mask.js — mapa del mundo como grilla de puntos (tierra / agua).
 * Generado a partir de Natural Earth (world-atlas 110m), proyección equirrectangular,
 * latitudes de 84°N a 58°S, 160 columnas × 62 filas. Cada fila está codificada por tramos:
 * "41o11L" = 41 celdas de agua seguidas de 11 de tierra. Las filas se separan con "|".
 */
export const WORLD = {
  cols: 160,
  rows: 62,
  latTop: 84,
  latBottom: -58,
  rle: '41o11L2o2L1o1L1o11L90o|37o37L13o1L1o3L9o1L19o3L36o|34o1L2o9L2o24L13o5L33o4L33o|26o6L3o10L4o22L34o5L9o12L10o3L1o2L13o|25o5L2o1L2o1L1o2L1o4L11o16L33o2L10o21L23o|9o3L12o10L1o4L1o9L6o15L21o2L10o2L5o41L9o|1L5o29L1o4L2o2L2o4L6o13L18o10L6o1L1o55L|4L2o38L3o5L4o9L21o74L|2o1L3o38L1o6L6o5L8o4L10o76L|6o33L6o6L7o3L21o6L1o70L1o|6o8L1o23L7o4L2o1L8o1L21o6L2o59L2o5L4o|10o2L7o21L5o8L24o2L4o1L1o3L1o53L7o3L8o|21o22L2o9L23o2L4o2L1o1L2o52L8o3L8o|21o23L1o10L21o1L1o3L1o62L5o2L9o|23o32L23o66L16o|24o27L3o3L21o64L1o1L16o|25o28L26o23L1o39L1o1L16o|25o25L1o1L24o10L1o6L4o4L2o37L3o2L15o|24o25L27o5L4o2L1o14L2o34L4o1L17o|25o22L29o4L7o1L1o2L1o10L2o29L1o3L5o1L17o|26o20L30o9L1o1L5o42L2o2L2o3L17o|26o20L31o8L11o37L3o1L1o4L18o|28o17L31o11L2o2L4o39L3o2L21o|28o1L1o14L31o59L26o|29o8L6o1L30o28L1o31L26o|30o7L36o22L1o7L1o1L1o27L27o|32o5L36o23L1o10L3o22L1o1L26o|33o4L3o1L4o2L25o34L5o8L2o9L30o|34o7L7o1L23o25L1o8L6o6L4o5L1o1L31o|35o7L30o26L1o5L8o5L5o6L5o1L26o|39o4L29o30L11o3L7o6L4o2L25o|41o2L4o2L24o26L3o1L10o3L8o5L6o1L24o|42o2L2o7L21o29L11o2L7o1L2o2L6o2L24o|45o9L20o28L13o2L7o1L10o1L24o|45o12L19o4L2o20L20o4L5o2L27o|45o13L26o17L22o3L3o4L27o|44o14L26o16L24o2L2o6L2o1L23o|44o17L23o15L26o2L2o3L1o1L4o2L1o1L18o|44o19L22o13L27o2L6o2L4o6L2o1L12o|44o21L20o13L29o3L11o6L13o|45o20L20o13L31o2L2o1L1o1L6o2L1o1L14o|45o19L22o12L48o1L13o|46o17L22o13L3o1L36o3L2o1L16o|46o17L22o13L2o2L33o6L2o2L9o1L5o|48o15L22o12L2o3L32o11L15o|48o14L24o10L3o3L30o14L14o|48o14L24o10L3o3L29o16L13o|48o11L27o10L3o2L29o18L12o|48o11L28o8L35o18L12o|48o10L29o7L37o17L12o|48o9L31o5L38o17L12o|48o9L31o4L39o4L5o7L13o|47o8L87o5L10o1L2o|47o7L89o3L11o2L1o|47o5L92o2L10o3L1o|47o5L93o1L9o2L3o|47o4L103o2L4o|46o5L109o|46o4L110o|47o3L3o1L106o|48o2L110o|160o',
};

/** Devuelve una lista de [columna, fila] con las celdas de tierra */
export function landCells() {
  const cells = [];
  WORLD.rle.split('|').forEach((row, r) => {
    let c = 0;
    for (const [, n, kind] of row.matchAll(/(\d+)([Lo])/g)) {
      const len = Number(n);
      if (kind === 'L') for (let i = 0; i < len; i += 1) cells.push([c + i, r]);
      c += len;
    }
  });
  return cells;
}

/** Longitud/latitud → posición relativa (0..1) dentro del mapa */
export function project(lon, lat) {
  return [(lon + 180) / 360, (WORLD.latTop - lat) / (WORLD.latTop - WORLD.latBottom)];
}
