import {
  construirNombreDerivado,
  numerarConCeros,
} from '../../utilidades/nombresArchivo'
import {
  describirGrupo,
  ErrorRangoPaginas,
  interpretarRangos,
} from '../../utilidades/rangosPaginas'
import type { GrupoPrevisto, ModoDivision } from './tipos'

/**
 * Calcula los documentos que producirá la división.
 *
 * Es una función pura: recibe la expresión escrita, el modo elegido y los datos
 * del documento, y devuelve la previsualización que se muestra antes de
 * procesar. Así la interfaz y el procesamiento comparten exactamente el mismo
 * cálculo y los nombres nunca se desvían.
 *
 * @throws {ErrorRangoPaginas} Si la expresión de rangos no es válida.
 */
export function calcularGruposPrevistos(
  modo: ModoDivision,
  expresion: string,
  nombreOriginal: string,
  totalPaginas: number,
): readonly GrupoPrevisto[] {
  if (modo === 'cada-pagina') {
    return calcularGruposPorPagina(nombreOriginal, totalPaginas)
  }

  return calcularGruposPorRangos(expresion, nombreOriginal, totalPaginas)
}

/** Un documento por cada página, con numeración ordenada. */
function calcularGruposPorPagina(
  nombreOriginal: string,
  totalPaginas: number,
): readonly GrupoPrevisto[] {
  if (totalPaginas < 1) {
    throw new ErrorRangoPaginas(
      'Todavía no hay un documento cargado con páginas que dividir.',
    )
  }

  return Array.from({ length: totalPaginas }, (_, indice) => {
    const numero = indice + 1

    return {
      nombreArchivo: construirNombreDerivado(
        nombreOriginal,
        `pagina-${numerarConCeros(numero, totalPaginas)}`,
      ),
      indices: [indice],
      descripcion: `Página ${numero}`,
    }
  })
}

/** Un documento por cada rango escrito, en el orden en que se escribió. */
function calcularGruposPorRangos(
  expresion: string,
  nombreOriginal: string,
  totalPaginas: number,
): readonly GrupoPrevisto[] {
  const { grupos } = interpretarRangos(expresion, totalPaginas)

  return grupos.map((grupo) => ({
    nombreArchivo: construirNombreDerivado(nombreOriginal, describirGrupo(grupo)),
    indices: grupo.indices,
    descripcion:
      grupo.primeraPagina === grupo.ultimaPagina
        ? `Página ${grupo.primeraPagina}`
        : `Páginas ${grupo.primeraPagina} a ${grupo.ultimaPagina} (${grupo.indices.length})`,
  }))
}
