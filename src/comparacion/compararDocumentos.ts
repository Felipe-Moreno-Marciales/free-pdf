import { cederElControl, comprobarCancelacion } from '../pdf/cancelacion'
import {
  compararPixeles,
  compararTexto,
  geometriaCoincide,
  type PixelesPagina,
} from './compararContenido'
import {
  UMBRAL_PREDETERMINADO,
  type ComparacionPagina,
  type DiferenciaMetadato,
  type EstadoPagina,
  type GeometriaPagina,
  type RecuentoPaginas,
  type ResultadoComparacion,
} from './tipos'

/**
 * Comparación completa de dos documentos, página por página.
 *
 * Lo que necesita el navegador —abrir los documentos, leer el texto y dibujar las
 * páginas— se inyecta como adaptador. Así este orquestador, que es donde vive la
 * lógica de emparejar páginas y decidir estados, se puede probar entero.
 *
 * Las páginas se recorren **de una en una y en orden**. Dibujar dos páginas a la vez
 * multiplica la memoria por dos sin ganar nada, y el progreso y la cancelación tienen
 * que ser reales.
 */

/** Lo que hace falta saber de un documento para compararlo. */
export interface DocumentoComparable {
  readonly nombre: string
  readonly numeroPaginas: number
  /** Geometría de una página, empezando en 1. */
  readonly geometria: (pagina: number) => Promise<GeometriaPagina>
  /** Texto de una página. */
  readonly texto: (pagina: number) => Promise<string>
  /**
   * Dibuja una página y devuelve sus píxeles.
   *
   * Recibe las medidas exactas a las que hay que dibujar, para que las dos versiones
   * de la misma página se puedan comparar píxel a píxel. Devuelve `null` si no se pudo
   * dibujar, que no es un error: se informa y se compara solo el texto.
   */
  readonly pixeles: (
    pagina: number,
    ancho: number,
    alto: number,
  ) => Promise<PixelesPagina | null>
  /** Metadatos, para compararlos. */
  readonly metadatos: () => Promise<ReadonlyMap<string, string>>
  /** Libera lo que haya que liberar. */
  readonly liberar: () => void
}

/** Progreso de la comparación. */
export interface ProgresoComparacion {
  readonly paginasComparadas: number
  readonly total: number
}

/** Opciones de la comparación. */
export interface OpcionesComparacion {
  /** Umbral visual, en fracción de píxeles cambiados. */
  readonly umbral?: number
  /** `true` para comparar también los píxeles. */
  readonly compararVisualmente?: boolean
  /** Ancho al que se dibujan las páginas para comparar. */
  readonly anchoComparacion?: number
  readonly senal?: AbortSignal
  readonly alProgreso?: (progreso: ProgresoComparacion) => void
}

/**
 * Ancho en píxeles al que se dibujan las páginas para compararlas.
 *
 * No hace falta más: la comparación busca **dónde** hay diferencias, no reproducir el
 * documento. A 900 píxeles de ancho una A4 son unos 1,1 megapíxeles, que se comparan
 * rápido y detectan cualquier cambio apreciable. Subirlo multiplicaría el tiempo sin
 * encontrar nada nuevo.
 */
export const ANCHO_COMPARACION = 900

/** Compara dos documentos y devuelve el resultado completo. */
export async function compararDocumentos(
  antes: DocumentoComparable,
  despues: DocumentoComparable,
  opciones: OpcionesComparacion = {},
): Promise<ResultadoComparacion> {
  const umbral = opciones.umbral ?? UMBRAL_PREDETERMINADO
  const compararVisualmente = opciones.compararVisualmente ?? true
  const anchoComparacion = opciones.anchoComparacion ?? ANCHO_COMPARACION

  const total = Math.max(antes.numeroPaginas, despues.numeroPaginas)
  const paginas: ComparacionPagina[] = []

  for (let numero = 1; numero <= total; numero += 1) {
    comprobarCancelacion(opciones.senal)

    paginas.push(
      await compararUna({
        numero,
        antes,
        despues,
        umbral,
        compararVisualmente,
        anchoComparacion,
      }),
    )

    opciones.alProgreso?.({ paginasComparadas: numero, total })

    // Se cede el control entre páginas: la interfaz sigue respondiendo y los lienzos
    // de la página anterior se pueden liberar.
    await cederElControl()
  }

  const metadatos = compararMetadatos(
    await antes.metadatos(),
    await despues.metadatos(),
  )

  const recuento = contarPaginas(paginas)

  return {
    nombreAntes: antes.nombre,
    nombreDespues: despues.nombre,
    paginasAntes: antes.numeroPaginas,
    paginasDespues: despues.numeroPaginas,
    paginas,
    recuento,
    metadatos,
    umbral,
    sonIdenticos:
      recuento.modificadas === 0 &&
      recuento.anadidas === 0 &&
      recuento.eliminadas === 0 &&
      metadatos.length === 0,
  }
}

/** Datos con los que se compara una página. */
interface PeticionPagina {
  readonly numero: number
  readonly antes: DocumentoComparable
  readonly despues: DocumentoComparable
  readonly umbral: number
  readonly compararVisualmente: boolean
  readonly anchoComparacion: number
}

/**
 * Compara una sola página.
 *
 * Las páginas se emparejan **por su número**, no buscando la más parecida. Es una
 * decisión deliberada: emparejar por semejanza detectaría una página insertada en
 * medio, pero exigiría comparar todas contra todas y produciría resultados difíciles
 * de explicar. Aquí, insertar una página al principio marca todas las siguientes como
 * modificadas, y eso se dice en las limitaciones en lugar de disimularlo.
 */
async function compararUna(
  peticion: PeticionPagina,
): Promise<ComparacionPagina> {
  const { numero, antes, despues } = peticion

  const existeAntes = numero <= antes.numeroPaginas
  const existeDespues = numero <= despues.numeroPaginas

  if (!existeAntes || !existeDespues) {
    return {
      numero,
      estado: existeAntes ? 'eliminada' : 'anadida',
      geometriaAntes: existeAntes ? await antes.geometria(numero) : null,
      geometriaDespues: existeDespues ? await despues.geometria(numero) : null,
      geometriaDistinta: false,
      texto: null,
      visual: null,
    }
  }

  const geometriaAntes = await antes.geometria(numero)
  const geometriaDespues = await despues.geometria(numero)
  const geometriaDistinta = !geometriaCoincide(geometriaAntes, geometriaDespues)

  const texto = compararTexto(
    await antes.texto(numero),
    await despues.texto(numero),
  )

  const visual = peticion.compararVisualmente
    ? await compararVisualmente(peticion, geometriaAntes)
    : null

  const hayDiferencias =
    geometriaDistinta ||
    !texto.identico ||
    (visual !== null && visual.superaUmbral)

  return {
    numero,
    estado: hayDiferencias ? 'modificada' : 'identica',
    geometriaAntes,
    geometriaDespues,
    geometriaDistinta,
    texto,
    visual,
  }
}

/** Dibuja las dos versiones de una página y compara sus píxeles. */
async function compararVisualmente(
  peticion: PeticionPagina,
  geometria: GeometriaPagina,
): Promise<ComparacionPagina['visual']> {
  // Las dos se dibujan a las mismas medidas, derivadas de la primera: es la única
  // forma de poder comparar píxel a píxel.
  const escala = peticion.anchoComparacion / Math.max(1, geometria.ancho)
  const ancho = Math.max(1, Math.round(geometria.ancho * escala))
  const alto = Math.max(1, Math.round(geometria.alto * escala))

  const pixelesAntes = await peticion.antes.pixeles(
    peticion.numero,
    ancho,
    alto,
  )
  const pixelesDespues = await peticion.despues.pixeles(
    peticion.numero,
    ancho,
    alto,
  )

  if (pixelesAntes === null || pixelesDespues === null) {
    return null
  }

  return compararPixeles(pixelesAntes, pixelesDespues, peticion.umbral)
}

/** Cuenta las páginas por estado. */
export function contarPaginas(
  paginas: readonly ComparacionPagina[],
): RecuentoPaginas {
  const recuento = {
    identicas: 0,
    modificadas: 0,
    anadidas: 0,
    eliminadas: 0,
  }

  const claves: Record<EstadoPagina, keyof RecuentoPaginas> = {
    identica: 'identicas',
    modificada: 'modificadas',
    anadida: 'anadidas',
    eliminada: 'eliminadas',
  }

  for (const pagina of paginas) {
    recuento[claves[pagina.estado]] += 1
  }

  return recuento
}

/** Metadatos que se comparan, con su nombre en español. */
export const CLAVES_METADATOS: readonly (readonly [string, string])[] = [
  ['titulo', 'Título'],
  ['autor', 'Autor'],
  ['asunto', 'Asunto'],
  ['palabrasClave', 'Palabras clave'],
  ['creador', 'Creado con'],
  ['productor', 'Producido con'],
]

/** Compara dos conjuntos de metadatos y devuelve solo los que cambian. */
export function compararMetadatos(
  antes: ReadonlyMap<string, string>,
  despues: ReadonlyMap<string, string>,
): readonly DiferenciaMetadato[] {
  const diferencias: DiferenciaMetadato[] = []

  for (const [clave, nombre] of CLAVES_METADATOS) {
    const valorAntes = antes.get(clave) ?? ''
    const valorDespues = despues.get(clave) ?? ''

    if (valorAntes !== valorDespues) {
      diferencias.push({
        clave: nombre,
        antes: valorAntes,
        despues: valorDespues,
      })
    }
  }

  return diferencias
}

/**
 * Resume la comparación en español.
 *
 * Dice lo que se ha encontrado sin interpretarlo. En particular, **no concluye que los
 * documentos digan lo mismo** por el hecho de que no se hayan encontrado diferencias:
 * la comparación mira el texto extraíble y los píxeles, y hay cambios que ninguna de
 * las dos cosas ve.
 */
export function resumirComparacion(
  resultado: ResultadoComparacion,
): string {
  if (resultado.sonIdenticos) {
    return 'No se ha encontrado ninguna diferencia: mismas páginas, mismo texto extraíble, misma apariencia y mismos metadatos. Eso no demuestra que los archivos sean idénticos byte a byte, solo que la comparación no encuentra nada.'
  }

  const partes: string[] = []

  if (resultado.paginasAntes !== resultado.paginasDespues) {
    partes.push(
      `El primero tiene ${resultado.paginasAntes} ${resultado.paginasAntes === 1 ? 'página' : 'páginas'} y el segundo ${resultado.paginasDespues}.`,
    )
  }

  const { recuento } = resultado
  const detalles: string[] = []

  if (recuento.modificadas > 0) {
    detalles.push(
      `${recuento.modificadas} ${recuento.modificadas === 1 ? 'modificada' : 'modificadas'}`,
    )
  }

  if (recuento.anadidas > 0) {
    detalles.push(`${recuento.anadidas} ${recuento.anadidas === 1 ? 'añadida' : 'añadidas'}`)
  }

  if (recuento.eliminadas > 0) {
    detalles.push(
      `${recuento.eliminadas} ${recuento.eliminadas === 1 ? 'eliminada' : 'eliminadas'}`,
    )
  }

  if (detalles.length > 0) {
    partes.push(`Páginas: ${detalles.join(', ')}.`)
  }

  if (recuento.identicas > 0) {
    partes.push(
      `${recuento.identicas} ${recuento.identicas === 1 ? 'página no cambia' : 'páginas no cambian'}.`,
    )
  }

  if (resultado.metadatos.length > 0) {
    partes.push(
      `Cambian ${resultado.metadatos.length} ${resultado.metadatos.length === 1 ? 'metadato' : 'metadatos'}.`,
    )
  }

  return partes.join(' ')
}
