import type {
  HallazgoSeguridad,
  NivelRiesgo,
  SeveridadHallazgoSeguridad,
} from './tipos'

/** Orden de importancia de las severidades, sin convertirlas en una puntuación. */
const ORDEN_SEVERIDAD: Readonly<Record<SeveridadHallazgoSeguridad, number>> = {
  informativa: 1,
  baja: 1,
  media: 2,
  alta: 3,
}

/**
 * Clasifica el informe por la característica más sensible que se haya encontrado.
 *
 * Es deliberadamente una regla categórica y comprobable, no una puntuación:
 *
 * - sin hallazgos: `sin-indicios`;
 * - informativos o de severidad baja: `bajo`;
 * - al menos uno de severidad media: `precaucion`;
 * - al menos uno de severidad alta: `elevado`.
 */
export function clasificarRiesgo(
  hallazgos: readonly Pick<HallazgoSeguridad, 'severidad'>[],
): NivelRiesgo {
  let maxima = 0

  for (const hallazgo of hallazgos) {
    maxima = Math.max(maxima, ORDEN_SEVERIDAD[hallazgo.severidad])
  }

  if (maxima === 0) {
    return 'sin-indicios'
  }

  if (maxima === 1) {
    return 'bajo'
  }

  return maxima === 2 ? 'precaucion' : 'elevado'
}
