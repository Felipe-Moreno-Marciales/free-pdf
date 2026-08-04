import type {
  BloqueDocumento,
  DocumentoEstructurado,
  TramoTexto,
} from './tipos'

/** Opciones que afectan solo a la representación final. */
export interface OpcionesMarkdown {
  readonly conservarSaltosLinea: boolean
  readonly separadoresPagina: boolean
}

const CARACTERES_MARKDOWN = /([\\`*_{}[\]()#+.!|>-])/g

/** Escapa caracteres que Markdown interpreta, sin alterar el contenido. */
export function escaparMarkdown(texto: string): string {
  return texto.replace(CARACTERES_MARKDOWN, '\\$1')
}

/** Evita destinos que podrían ejecutar código al abrir el Markdown. */
export function normalizarDestinoEnlace(url: string): string | null {
  const limpia = url.trim()
  if (!/^(https?:|mailto:)/i.test(limpia)) return null
  return limpia.replace(/[()<>\s]/g, (caracter) =>
    encodeURIComponent(caracter),
  )
}

function generarTramos(tramos: readonly TramoTexto[]): string {
  return tramos
    .map((tramo) => {
      const texto = escaparMarkdown(tramo.texto)
      const destino =
        tramo.enlace === null ? null : normalizarDestinoEnlace(tramo.enlace)
      return destino === null ? texto : `[${texto}](${destino})`
    })
    .join('')
    .trim()
}

function generarTabla(
  filas: Extract<BloqueDocumento, { tipo: 'tabla' }>['filas'],
): string {
  const escaparCelda = (celda: readonly TramoTexto[]) =>
    generarTramos(celda).replaceAll('|', '\\|').replaceAll('\n', ' ')
  const primera = filas[0]
  if (primera === undefined) return ''
  const lineas = [
    `| ${primera.map(escaparCelda).join(' | ')} |`,
    `| ${primera.map(() => '---').join(' | ')} |`,
  ]
  for (const fila of filas.slice(1)) {
    lineas.push(`| ${fila.map(escaparCelda).join(' | ')} |`)
  }
  return lineas.join('\n')
}

function generarBloque(
  bloque: BloqueDocumento,
  conservarSaltosLinea: boolean,
): string {
  switch (bloque.tipo) {
    case 'encabezado':
      return `${'#'.repeat(bloque.nivel)} ${generarTramos(bloque.tramos)}`
    case 'parrafo':
      return bloque.lineas
        .map(generarTramos)
        .join(conservarSaltosLinea ? '  \n' : ' ')
    case 'lista':
      return bloque.elementos
        .map(
          (elemento, indice) =>
            `${bloque.ordenada ? `${indice + 1}.` : '-'} ${generarTramos(elemento)}`,
        )
        .join('\n')
    case 'cita':
      return bloque.lineas
        .map((linea) => `> ${generarTramos(linea)}`)
        .join('\n')
    case 'tabla':
      return generarTabla(bloque.filas)
  }
}

/** Genera un documento Markdown UTF-8 válido a partir de la estructura deducida. */
export function generarMarkdown(
  documento: DocumentoEstructurado,
  opciones: OpcionesMarkdown,
): string {
  const paginas = documento.paginas.map((pagina) =>
    pagina.bloques
      .map((bloque) => generarBloque(bloque, opciones.conservarSaltosLinea))
      .filter((bloque) => bloque !== '')
      .join('\n\n'),
  )

  const separador = opciones.separadoresPagina
    ? '\n\n---\n\n'
    : '\n\n'
  return `${paginas.join(separador).trim()}\n`
}

/** Prepara el archivo exacto que se descarga desde la vista previa. */
export function crearArchivoMarkdown(contenido: string): Blob {
  return new Blob([contenido], { type: 'text/markdown;charset=utf-8' })
}
