import type {
  BloqueDocumento,
  DocumentoEstructurado,
  FragmentoTextoPdf,
  PaginaEstructurada,
  PaginaTextoPdf,
  TramoTexto,
} from './tipos'

interface Linea {
  readonly y: number
  readonly alto: number
  readonly tamanoFuente: number
  readonly fragmentos: readonly FragmentoTextoPdf[]
}

const INICIO_LISTA_ORDENADA = /^\s*(\d+)[.)]\s+/
const INICIO_LISTA_VINETAS = /^\s*[-–—•●▪◦*]\s+/
const INICIO_CITA = /^\s*>\s?/

function mediana(valores: readonly number[]): number {
  if (valores.length === 0) return 12
  const ordenados = [...valores].sort((a, b) => a - b)
  const mitad = Math.floor(ordenados.length / 2)
  const central = ordenados[mitad] ?? 12
  return ordenados.length % 2 === 0
    ? ((ordenados[mitad - 1] ?? central) + central) / 2
    : central
}

/** Estima el cuerpo por la cantidad de caracteres impresa con cada tamaño. */
function estimarTamanoCuerpo(
  fragmentos: readonly FragmentoTextoPdf[],
): number {
  const pesos = new Map<number, number>()
  for (const fragmento of fragmentos) {
    const tamano = Math.round(fragmento.tamanoFuente * 2) / 2
    pesos.set(tamano, (pesos.get(tamano) ?? 0) + fragmento.texto.length)
  }

  let elegido = mediana(fragmentos.map((fragmento) => fragmento.tamanoFuente))
  let pesoElegido = -1
  for (const [tamano, peso] of pesos) {
    if (peso > pesoElegido || (peso === pesoElegido && tamano < elegido)) {
      elegido = tamano
      pesoElegido = peso
    }
  }
  return elegido
}

/** Agrupa fragmentos cercanos en líneas visuales. */
function agruparEnLineas(
  fragmentos: readonly FragmentoTextoPdf[],
): readonly Linea[] {
  const ordenados = [...fragmentos].sort(
    (a, b) => b.y - a.y || a.x - b.x,
  )
  const lineas: {
    y: number
    alto: number
    tamanoFuente: number
    fragmentos: FragmentoTextoPdf[]
  }[] = []

  for (const fragmento of ordenados) {
    const tolerancia = Math.max(2, fragmento.tamanoFuente * 0.35)
    const linea = lineas.find((candidata) => Math.abs(candidata.y - fragmento.y) <= tolerancia)

    if (linea === undefined) {
      lineas.push({
        y: fragmento.y,
        alto: fragmento.alto,
        tamanoFuente: fragmento.tamanoFuente,
        fragmentos: [fragmento],
      })
    } else {
      linea.fragmentos.push(fragmento)
      linea.alto = Math.max(linea.alto, fragmento.alto)
      linea.tamanoFuente = Math.max(
        linea.tamanoFuente,
        fragmento.tamanoFuente,
      )
    }
  }

  return lineas
    .map((linea) => ({
      ...linea,
      fragmentos: linea.fragmentos.sort((a, b) => a.x - b.x),
    }))
    .sort((a, b) => b.y - a.y)
}

/** Une fragmentos respetando espacios y cambios de enlace. */
function tramosDeFragmentos(
  fragmentos: readonly FragmentoTextoPdf[],
): readonly TramoTexto[] {
  const tramos: { texto: string; enlace: string | null }[] = []
  let derechaAnterior: number | null = null

  for (const fragmento of fragmentos) {
    const separacion =
      derechaAnterior === null ? 0 : fragmento.x - derechaAnterior
    const necesitaEspacio =
      derechaAnterior !== null &&
      separacion > fragmento.tamanoFuente * 0.12 &&
      !fragmento.texto.startsWith(' ') &&
      !/^[,.;:!?)}\]]/.test(fragmento.texto)
    const texto = `${necesitaEspacio ? ' ' : ''}${fragmento.texto}`
    const anterior = tramos.at(-1)

    if (anterior?.enlace === fragmento.enlace) {
      anterior.texto += texto
    } else {
      tramos.push({ texto, enlace: fragmento.enlace })
    }

    derechaAnterior = fragmento.x + fragmento.ancho
  }

  return tramos
}

function textoLinea(linea: Linea): string {
  return tramosDeFragmentos(linea.fragmentos)
    .map((tramo) => tramo.texto)
    .join('')
}

function quitarPrefijo(
  tramos: readonly TramoTexto[],
  patron: RegExp,
): readonly TramoTexto[] {
  const copia = tramos.map((tramo) => ({ ...tramo }))
  const primero = copia[0]
  if (primero !== undefined) primero.texto = primero.texto.replace(patron, '')
  return copia.filter((tramo) => tramo.texto !== '')
}

/** Detecta grupos de dos o más filas con columnas alineadas. */
function detectarTabla(
  lineas: readonly Linea[],
  inicio: number,
): { readonly bloque: BloqueDocumento; readonly consumidas: number } | null {
  const primera = lineas[inicio]
  if (primera === undefined || primera.fragmentos.length < 2) return null

  const centros = primera.fragmentos.map((fragmento) => fragmento.x)
  const filas: Linea[] = [primera]

  for (const candidata of lineas.slice(inicio + 1)) {
    if (candidata.fragmentos.length !== centros.length) break
    const alineada = candidata.fragmentos.every(
      (fragmento, indice) =>
        Math.abs(fragmento.x - (centros[indice] ?? fragmento.x)) <=
        Math.max(8, fragmento.tamanoFuente),
    )
    if (!alineada) break
    filas.push(candidata)
  }

  if (filas.length < 2) return null

  return {
    bloque: {
      tipo: 'tabla',
      filas: filas.map((fila) =>
        fila.fragmentos.map((fragmento) => tramosDeFragmentos([fragmento])),
      ),
    },
    consumidas: filas.length,
  }
}

function nivelEncabezado(tamano: number, cuerpo: number): 1 | 2 | 3 {
  const razon = tamano / cuerpo
  if (razon >= 1.8) return 1
  if (razon >= 1.5) return 2
  return 3
}

/** Deduce bloques de una página mediante geometría y tamaños de fuente. */
export function deducirPagina(
  pagina: PaginaTextoPdf,
  tamanoCuerpo?: number,
): PaginaEstructurada {
  const lineas = agruparEnLineas(pagina.fragmentos)
  const cuerpo =
    tamanoCuerpo ??
    mediana(lineas.flatMap((linea) => linea.fragmentos.map((f) => f.tamanoFuente)))
  const bloques: BloqueDocumento[] = []
  let indice = 0

  while (indice < lineas.length) {
    const linea = lineas[indice]
    if (linea === undefined) break
    const texto = textoLinea(linea)
    const tramos = tramosDeFragmentos(linea.fragmentos)

    if (linea.tamanoFuente >= cuerpo * 1.28 && texto.trim().length <= 160) {
      bloques.push({
        tipo: 'encabezado',
        nivel: nivelEncabezado(linea.tamanoFuente, cuerpo),
        tramos,
      })
      indice += 1
      continue
    }

    const ordenada = INICIO_LISTA_ORDENADA.test(texto)
    const vineta = INICIO_LISTA_VINETAS.test(texto)
    if (ordenada || vineta) {
      const elementos: (readonly TramoTexto[])[] = []
      const patron = ordenada ? INICIO_LISTA_ORDENADA : INICIO_LISTA_VINETAS
      while (indice < lineas.length) {
        const candidata = lineas[indice]
        if (candidata === undefined || !patron.test(textoLinea(candidata))) break
        elementos.push(quitarPrefijo(tramosDeFragmentos(candidata.fragmentos), patron))
        indice += 1
      }
      bloques.push({ tipo: 'lista', ordenada, elementos })
      continue
    }

    if (INICIO_CITA.test(texto)) {
      const citas: (readonly TramoTexto[])[] = []
      while (indice < lineas.length) {
        const candidata = lineas[indice]
        if (candidata === undefined || !INICIO_CITA.test(textoLinea(candidata))) break
        citas.push(
          quitarPrefijo(tramosDeFragmentos(candidata.fragmentos), INICIO_CITA),
        )
        indice += 1
      }
      bloques.push({ tipo: 'cita', lineas: citas })
      continue
    }

    const tabla = detectarTabla(lineas, indice)
    if (tabla !== null) {
      bloques.push(tabla.bloque)
      indice += tabla.consumidas
      continue
    }

    const parrafo: (readonly TramoTexto[])[] = [tramos]
    let anterior = linea
    indice += 1
    while (indice < lineas.length) {
      const siguiente = lineas[indice]
      if (siguiente === undefined) break
      const textoSiguiente = textoLinea(siguiente)
      const separacion = anterior.y - siguiente.y
      if (
        siguiente.tamanoFuente >= cuerpo * 1.28 ||
        INICIO_LISTA_ORDENADA.test(textoSiguiente) ||
        INICIO_LISTA_VINETAS.test(textoSiguiente) ||
        INICIO_CITA.test(textoSiguiente) ||
        separacion > Math.max(anterior.alto, siguiente.alto) * 1.75
      ) {
        break
      }
      parrafo.push(tramosDeFragmentos(siguiente.fragmentos))
      anterior = siguiente
      indice += 1
    }
    bloques.push({ tipo: 'parrafo', lineas: parrafo })
  }

  return { numero: pagina.numero, bloques }
}

/** Deduce la estructura usando un tamaño de cuerpo común a todo el documento. */
export function deducirEstructura(
  paginas: readonly PaginaTextoPdf[],
): DocumentoEstructurado {
  const fragmentos = paginas.flatMap((pagina) => pagina.fragmentos)
  const contieneTexto = fragmentos.some((fragmento) => fragmento.texto.trim() !== '')
  const cuerpo = estimarTamanoCuerpo(fragmentos)

  return {
    contieneTexto,
    paginas: paginas.map((pagina) => deducirPagina(pagina, cuerpo)),
  }
}
