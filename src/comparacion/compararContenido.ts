import {
  TOLERANCIA_CANAL,
  type DiferenciaTexto,
  type DiferenciaVisual,
  type GeometriaPagina,
  type ZonaDiferencia,
} from './tipos'

/**
 * Comparación de texto y de píxeles.
 *
 * Todo lo de este módulo es puro: recibe cadenas y matrices de píxeles y devuelve
 * diferencias. No dibuja nada ni abre ningún documento, así que se puede probar
 * entero, que es justo lo que hace falta en la parte donde es fácil equivocarse.
 */

/**
 * Parte un texto en palabras comparables.
 *
 * Se normaliza el espacio en blanco porque PDF.js parte el texto en fragmentos según
 * cómo esté dibujado, y dos documentos idénticos pueden dar fragmentos distintos con
 * las mismas palabras. Comparar fragmento a fragmento daría diferencias falsas.
 */
export function partirEnPalabras(texto: string): readonly string[] {
  return texto
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((palabra) => palabra !== '')
}

/**
 * Compara dos textos y devuelve qué palabras cambian.
 *
 * Se usa una comparación por multiconjunto: qué palabras sobran y qué palabras faltan,
 * contando repeticiones. **No es un algoritmo de diferencias por líneas**, y es una
 * decisión consciente: mover un párrafo de sitio no cambia las palabras, así que un
 * algoritmo de líneas lo señalaría como un cambio enorme y este no señala nada.
 *
 * A cambio, reordenar palabras dentro de una frase pasa desapercibido. Es el precio, y
 * está documentado en las limitaciones de la herramienta.
 */
export function compararTexto(
  antes: string,
  despues: string,
): DiferenciaTexto {
  const palabrasAntes = partirEnPalabras(antes)
  const palabrasDespues = partirEnPalabras(despues)

  const cuentaAntes = contar(palabrasAntes)
  const cuentaDespues = contar(palabrasDespues)

  const eliminadas: string[] = []
  const anadidas: string[] = []

  for (const [palabra, veces] of cuentaAntes) {
    const enDespues = cuentaDespues.get(palabra) ?? 0

    for (let sobra = 0; sobra < veces - enDespues; sobra += 1) {
      eliminadas.push(palabra)
    }
  }

  for (const [palabra, veces] of cuentaDespues) {
    const enAntes = cuentaAntes.get(palabra) ?? 0

    for (let falta = 0; falta < veces - enAntes; falta += 1) {
      anadidas.push(palabra)
    }
  }

  return {
    eliminadas,
    anadidas,
    // El orden también cuenta para decidir si es idéntico: dos textos con las mismas
    // palabras en otro orden no son el mismo texto, aunque las diferencias estén
    // vacías. Compararlos ya normalizados es lo que lo detecta.
    identico:
      eliminadas.length === 0 &&
      anadidas.length === 0 &&
      palabrasAntes.join(' ') === palabrasDespues.join(' '),
    palabrasAntes: palabrasAntes.length,
    palabrasDespues: palabrasDespues.length,
  }
}

/** Cuenta cuántas veces aparece cada palabra. */
function contar(palabras: readonly string[]): Map<string, number> {
  const cuenta = new Map<string, number>()

  for (const palabra of palabras) {
    cuenta.set(palabra, (cuenta.get(palabra) ?? 0) + 1)
  }

  return cuenta
}

/** Píxeles de una página dibujada, en formato RGBA. */
export interface PixelesPagina {
  readonly datos: Uint8ClampedArray
  readonly ancho: number
  readonly alto: number
}

/** Cuántas divisiones por lado se usan para agrupar las diferencias en zonas. */
export const DIVISIONES_ZONA = 12

/**
 * Compara los píxeles de dos páginas.
 *
 * Las dos imágenes deben tener las mismas medidas; quien llama se encarga de dibujar
 * ambas a la misma escala. Si no coinciden se devuelve la diferencia máxima, porque
 * dos páginas de tamaños distintos son distintas por definición.
 *
 * La comparación es por canal con una tolerancia, no exacta. Dibujar la misma página
 * dos veces puede dar valores que difieren en una unidad por el antialias, y exigir
 * igualdad exacta marcaría como modificadas páginas idénticas.
 */
export function compararPixeles(
  antes: PixelesPagina,
  despues: PixelesPagina,
  umbral: number,
): DiferenciaVisual {
  if (antes.ancho !== despues.ancho || antes.alto !== despues.alto) {
    return {
      fraccionCambiada: 1,
      superaUmbral: true,
      zonas: [{ izquierda: 0, superior: 0, ancho: 1, alto: 1 }],
    }
  }

  const totalPixeles = antes.ancho * antes.alto

  if (totalPixeles === 0) {
    return { fraccionCambiada: 0, superaUmbral: false, zonas: [] }
  }

  // Rejilla de recuento: cuántos píxeles cambian en cada celda.
  const rejilla = new Uint32Array(DIVISIONES_ZONA * DIVISIONES_ZONA)
  let cambiados = 0

  for (let indice = 0; indice < totalPixeles; indice += 1) {
    const base = indice * 4

    if (!pixelCambia(antes.datos, despues.datos, base)) {
      continue
    }

    cambiados += 1

    const x = indice % antes.ancho
    const y = Math.floor(indice / antes.ancho)
    const columna = Math.min(
      DIVISIONES_ZONA - 1,
      Math.floor((x / antes.ancho) * DIVISIONES_ZONA),
    )
    const fila = Math.min(
      DIVISIONES_ZONA - 1,
      Math.floor((y / antes.alto) * DIVISIONES_ZONA),
    )

    rejilla[fila * DIVISIONES_ZONA + columna] += 1
  }

  const fraccionCambiada = cambiados / totalPixeles

  return {
    fraccionCambiada,
    superaUmbral: fraccionCambiada > umbral,
    zonas: fraccionCambiada > umbral ? extraerZonas(rejilla, totalPixeles) : [],
  }
}

/** Decide si un píxel cambia, comparando los cuatro canales con tolerancia. */
function pixelCambia(
  antes: Uint8ClampedArray,
  despues: Uint8ClampedArray,
  base: number,
): boolean {
  for (let canal = 0; canal < 4; canal += 1) {
    const uno = antes[base + canal] ?? 0
    const otro = despues[base + canal] ?? 0

    if (Math.abs(uno - otro) > TOLERANCIA_CANAL) {
      return true
    }
  }

  return false
}

/**
 * Convierte la rejilla de recuentos en zonas para resaltar.
 *
 * Se marca una celda cuando concentra una proporción apreciable de los píxeles
 * cambiados. No se intenta agrupar celdas contiguas en rectángulos mayores: eso daría
 * una impresión de precisión que el método no tiene.
 */
export function extraerZonas(
  rejilla: Uint32Array,
  totalPixeles: number,
): readonly ZonaDiferencia[] {
  const porCelda = totalPixeles / (DIVISIONES_ZONA * DIVISIONES_ZONA)

  // Una celda se resalta si al menos un 2 % de sus píxeles ha cambiado.
  const minimo = Math.max(1, porCelda * 0.02)
  const zonas: ZonaDiferencia[] = []
  const lado = 1 / DIVISIONES_ZONA

  for (let fila = 0; fila < DIVISIONES_ZONA; fila += 1) {
    for (let columna = 0; columna < DIVISIONES_ZONA; columna += 1) {
      if ((rejilla[fila * DIVISIONES_ZONA + columna] ?? 0) < minimo) {
        continue
      }

      zonas.push({
        izquierda: columna * lado,
        superior: fila * lado,
        ancho: lado,
        alto: lado,
      })
    }
  }

  return zonas
}

/** Compara la geometría de dos páginas. */
export function geometriaCoincide(
  antes: GeometriaPagina | null,
  despues: GeometriaPagina | null,
): boolean {
  if (antes === null || despues === null) {
    return false
  }

  // Se admite medio punto de diferencia: las medidas son números en coma flotante y
  // reescribir un documento puede introducir una variación imperceptible.
  return (
    Math.abs(antes.ancho - despues.ancho) < 0.5 &&
    Math.abs(antes.alto - despues.alto) < 0.5 &&
    antes.rotacion === despues.rotacion
  )
}

/** Describe una geometría en español, para mostrarla. */
export function describirGeometria(geometria: GeometriaPagina): string {
  const medidas = `${Math.round(geometria.ancho)} × ${Math.round(geometria.alto)} puntos`

  return geometria.rotacion === 0
    ? medidas
    : `${medidas}, girada ${geometria.rotacion}°`
}

/**
 * Resume las diferencias de una página en una frase.
 *
 * Distingue con claridad el plano del texto del de los píxeles, porque son cosas
 * distintas y confundirlas es el error más fácil de esta herramienta.
 */
export function resumirDiferencias(
  texto: DiferenciaTexto | null,
  visual: DiferenciaVisual | null,
  geometriaDistinta: boolean,
): string {
  const partes: string[] = []

  if (geometriaDistinta) {
    partes.push('Las medidas o el giro de la página no coinciden.')
  }

  if (texto !== null && !texto.identico) {
    const cambios: string[] = []

    if (texto.anadidas.length > 0) {
      cambios.push(
        `${texto.anadidas.length} ${texto.anadidas.length === 1 ? 'palabra añadida' : 'palabras añadidas'}`,
      )
    }

    if (texto.eliminadas.length > 0) {
      cambios.push(
        `${texto.eliminadas.length} ${texto.eliminadas.length === 1 ? 'palabra eliminada' : 'palabras eliminadas'}`,
      )
    }

    partes.push(
      cambios.length === 0
        ? 'El texto es el mismo pero está en otro orden.'
        : `Cambia el texto: ${cambios.join(' y ')}.`,
    )
  }

  if (visual !== null && visual.superaUmbral) {
    partes.push(
      `Cambia un ${(visual.fraccionCambiada * 100).toFixed(1)} % de los píxeles.`,
    )
  }

  if (partes.length === 0) {
    return 'No se ha encontrado ninguna diferencia en esta página.'
  }

  return partes.join(' ')
}
