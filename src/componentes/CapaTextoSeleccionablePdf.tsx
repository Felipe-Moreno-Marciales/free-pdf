import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react'
import {
  convertirRectangulosSeleccion,
  elegirTipografia,
  LINEA_BASE_APROXIMADA,
  type CajaTextoSeleccionado,
  type SeleccionTextoPdf,
} from '../edicion/seleccionTexto'
import { cargarPdfJs } from '../pdf/renderizarMiniaturaPdf'
import { normalizarRotacion } from '../pdf/rotaciones'
import type { GradosRotacion } from '../pdf/tipos'
import type { ClaveTipografia } from '../edicion/tipos'
import {
  detectarPalabrasPagina,
  type PalabraDetectadaPagina,
} from '../ocr/detectarPalabrasPagina'

interface PropiedadesCapaTextoSeleccionablePdf {
  readonly documento: PDFDocumentProxy
  readonly numeroPagina: number
  readonly rotacion: GradosRotacion
  readonly alSeleccionar: (seleccion: SeleccionTextoPdf) => void
}

type EstadoCapaTexto =
  | 'cargando'
  | 'lista'
  | 'sin-texto'
  | 'error'
  | 'ocr'
  | 'ocr-lista'
  | 'ocr-vacio'

/**
 * Capa transparente de PDF.js que coincide con el texto dibujado en el canvas.
 * Permite seleccionar una palabra o varias líneas y devuelve sus rectángulos en
 * fracciones, que el editor convierte en una palabra corregible en el mismo lugar.
 */
export function CapaTextoSeleccionablePdf({
  documento,
  numeroPagina,
  rotacion,
  alSeleccionar,
}: PropiedadesCapaTextoSeleccionablePdf) {
  const referencia = useRef<HTMLDivElement | null>(null)
  const altoPaginaPuntos = useRef(842)
  const [estado, establecerEstado] = useState<EstadoCapaTexto>('cargando')
  const [palabrasOcr, establecerPalabrasOcr] = useState<
    readonly PalabraDetectadaPagina[]
  >([])
  const [progresoOcr, establecerProgresoOcr] = useState('')
  const controladorOcr = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      controladorOcr.current?.abort()
    },
    [],
  )

  useEffect(() => {
    const contenedor = referencia.current

    if (contenedor === null) {
      return
    }

    controladorOcr.current?.abort()
    controladorOcr.current = null
    let cancelada = false
    let capaTexto: InstanceType<
      Awaited<ReturnType<typeof cargarPdfJs>>['TextLayer']
    > | null = null
    let observador: ResizeObserver | null = null

    contenedor.replaceChildren()
    establecerPalabrasOcr([])
    establecerEstado('cargando')

    const preparar = async (): Promise<void> => {
      const [pdfjs, pagina] = await Promise.all([
        cargarPdfJs(),
        documento.getPage(numeroPagina),
      ])

      try {
        const rotacionTotal = normalizarRotacion(pagina.rotate + rotacion)
        const base = pagina.getViewport({ scale: 1, rotation: rotacionTotal })
        altoPaginaPuntos.current = base.height
        const dimensionesBase = base.rawDims as {
          readonly pageWidth: number
          readonly pageHeight: number
        }
        const contenido = await pagina.getTextContent({ includeMarkedContent: true })

        if (cancelada) {
          return
        }

        const crearVista = () => {
          const ancho =
            contenedor.parentElement?.getBoundingClientRect().width || base.width
          const escala = ancho / base.width
          const escalaTotal = escala * base.userUnit

          contenedor.style.setProperty('--total-scale-factor', String(escalaTotal))
          contenedor.style.setProperty('--scale-round-x', '1px')
          contenedor.style.setProperty('--scale-round-y', '1px')
          contenedor.style.width = `${dimensionesBase.pageWidth * escalaTotal}px`
          contenedor.style.height = `${dimensionesBase.pageHeight * escalaTotal}px`

          return pagina.getViewport({ scale: escala, rotation: rotacionTotal })
        }

        capaTexto = new pdfjs.TextLayer({
          textContentSource: contenido,
          container: contenedor,
          viewport: crearVista(),
        })

        // TextLayer usa `round()` en sus medidas automáticas. Se reponen medidas
        // numéricas para navegadores que aún no implementan esa función CSS.
        crearVista()

        await capaTexto.render()

        if (cancelada) {
          return
        }

        const elementosTexto = contenido.items.filter(esItemTexto)

        for (const [indice, fragmento] of capaTexto.textDivs.entries()) {
          const item = elementosTexto[indice]

          if (item === undefined) {
            continue
          }

          const estilo = contenido.styles[item.fontName]
          const fuente = pagina.commonObjs.has(item.fontName)
            ? (pagina.commonObjs.get(item.fontName) as FuentePdfJs)
            : undefined

          fragmento.dataset.tamano = String(
            Math.hypot(item.transform[2] ?? 0, item.transform[3] ?? 0),
          )
          // `item.transform` da el origen del fragmento en coordenadas PDF, que es
          // justo su línea base. Se pasa por la matriz de la vista para expresarlo
          // como fracción desde arriba, igual que el resto de medidas del editor.
          fragmento.dataset.lineaBase = String(
            proyectarLineaBase(base.transform, item.transform) / base.height,
          )
          fragmento.dataset.tipografia = elegirTipografia({
            familia: estilo?.fontFamily ?? '',
            nombre: fuente?.name ?? '',
            negrita: fuente?.bold === true || fuente?.black === true,
            cursiva: fuente?.italic === true,
          })
        }

        establecerEstado(
          capaTexto.textContentItemsStr.some((texto) => texto.trim() !== '')
            ? 'lista'
            : 'sin-texto',
        )

        if (typeof ResizeObserver !== 'undefined') {
          observador = new ResizeObserver(() => {
            capaTexto?.update({ viewport: crearVista() })
          })
          observador.observe(contenedor.parentElement ?? contenedor)
        }
      } finally {
        await pagina.cleanup()
      }
    }

    void preparar().catch(() => {
      if (!cancelada) {
        establecerEstado('error')
      }
    })

    return () => {
      cancelada = true
      observador?.disconnect()
      capaTexto?.cancel()
      contenedor.replaceChildren()
    }
  }, [documento, numeroPagina, rotacion])

  const procesarSeleccion = useCallback((
    objetivo: EventTarget | null,
    punto: { readonly x: number; readonly y: number },
  ): void => {
    const contenedor = referencia.current
    const seleccion = window.getSelection()

    if (contenedor === null) {
      return
    }

    const cajas: CajaTextoSeleccionado[] = []
    let textoElegido = ''
    let fragmentoEstilo: HTMLElement | null = null
    const limite = contenedor.getBoundingClientRect()

    if (seleccion !== null && !seleccion.isCollapsed) {
      for (let indice = 0; indice < seleccion.rangeCount; indice += 1) {
        const rango = seleccion.getRangeAt(indice)

        if (!contenedor.contains(rango.commonAncestorContainer)) {
          continue
        }

        cajas.push(...convertirRectangulosSeleccion(rango.getClientRects(), limite))
        textoElegido += `${rango.toString()} `
        fragmentoEstilo ??= obtenerFragmentoTexto(rango.startContainer, contenedor)
      }
    }

    // Si solo se pulsó, se obtiene la palabra exacta alrededor del carácter bajo
    // el puntero. PDF.js puede guardar una línea entera en un solo `span`, por lo
    // que cubrir el `span` completo borraría demasiado.
    if (cajas.length === 0) {
      const documentoCaret = document as Document & {
        caretRangeFromPoint?: (x: number, y: number) => Range | null
      }
      const caret = documentoCaret.caretRangeFromPoint?.(punto.x, punto.y)
      const nodo = caret?.startContainer

      if (nodo?.nodeType === Node.TEXT_NODE && contenedor.contains(nodo)) {
        fragmentoEstilo = obtenerFragmentoTexto(nodo, contenedor)
        const texto = nodo.textContent ?? ''
        let inicio = caret?.startOffset ?? 0
        let final = inicio

        while (inicio > 0 && !/\s/u.test(texto[inicio - 1] ?? '')) {
          inicio -= 1
        }
        while (final < texto.length && !/\s/u.test(texto[final] ?? '')) {
          final += 1
        }

        if (final > inicio) {
          textoElegido = texto.slice(inicio, final)
          const palabra = document.createRange()
          palabra.setStart(nodo, inicio)
          palabra.setEnd(nodo, final)
          cajas.push(
            ...convertirRectangulosSeleccion(palabra.getClientRects(), limite),
          )
        }
      }
    }

    // Un clic sin arrastre borra el fragmento de texto de PDF.js bajo el puntero.
    // Esto cubre el caso habitual de querer quitar una sola palabra.
    if (cajas.length === 0 && objetivo instanceof Element) {
      const fragmento = objetivo.closest('span')

      if (fragmento !== null && contenedor.contains(fragmento)) {
        fragmentoEstilo = fragmento as HTMLElement
        textoElegido = fragmento.textContent ?? ''
        cajas.push(
          ...convertirRectangulosSeleccion(
            [fragmento.getBoundingClientRect()],
            limite,
          ),
        )
      }
    }

    if (cajas.length > 0) {
      const colores = estimarColores(contenedor, cajas)

      alSeleccionar({
        cajas,
        texto: textoElegido.trim(),
        tamano: leerTamanoTexto(
          fragmentoEstilo,
          cajas[0],
          altoPaginaPuntos.current,
        ),
        tipografia: leerTipografia(fragmentoEstilo),
        lineaBase: leerLineaBase(fragmentoEstilo, cajas[0]),
        colorTexto: colores.texto,
        colorFondo: colores.fondo,
      })
      seleccion?.removeAllRanges()
    }
  }, [alSeleccionar])

  const terminarSeleccion = useCallback(
    (evento: PointerEvent<HTMLElement>): void => {
      const objetivo = evento.target
      const punto = { x: evento.clientX, y: evento.clientY }

      // La selección nativa termina de actualizarse después de `pointerup` en
      // algunos navegadores. Aplazar un ciclo evita leer una selección anterior.
      window.setTimeout(() => procesarSeleccion(objetivo, punto), 0)
    },
    [procesarSeleccion],
  )

  const iniciarOcr = useCallback((): void => {
    if (controladorOcr.current !== null) {
      return
    }

    const controlador = new AbortController()
    controladorOcr.current = controlador
    establecerEstado('ocr')
    establecerProgresoOcr('Preparando reconocimiento…')

    void detectarPalabrasPagina(
      documento,
      numeroPagina,
      controlador.signal,
      (progreso) =>
        establecerProgresoOcr(
          `${progreso.estado}: ${Math.round(progreso.fraccion * 100)} %`,
        ),
    )
      .then((palabras) => {
        if (controlador.signal.aborted) {
          return
        }

        establecerPalabrasOcr(palabras)
        establecerEstado(palabras.length > 0 ? 'ocr-lista' : 'ocr-vacio')
      })
      .catch(() => {
        if (!controlador.signal.aborted) {
          establecerEstado('error')
        }
      })
      .finally(() => {
        if (controladorOcr.current === controlador) {
          controladorOcr.current = null
        }
      })
  }, [documento, numeroPagina])

  const cancelarOcr = useCallback((): void => {
    controladorOcr.current?.abort()
    controladorOcr.current = null
    establecerEstado('sin-texto')
    establecerProgresoOcr('')
  }, [])

  return (
    <div className="lienzo-edicion__selector-texto" data-estado={estado}>
      <div
        className="lienzo-edicion__capa-texto textLayer"
        ref={referencia}
        role="region"
        aria-label="Selecciona o pulsa las palabras que quieres borrar"
        onPointerUp={terminarSeleccion}
      />

      {estado === 'cargando' && (
        <div className="lienzo-edicion__mensaje-texto">Preparando texto…</div>
      )}

      {estado === 'sin-texto' && (
        <div className="lienzo-edicion__mensaje-texto">
          <span>La página parece ser una imagen.</span>
          <button
            className="boton boton--primario boton--pequeno"
            type="button"
            onClick={iniciarOcr}
          >
            Detectar palabras con OCR
          </button>
        </div>
      )}

      {estado === 'ocr' && (
        <div className="lienzo-edicion__mensaje-texto">
          <span>{progresoOcr}</span>
          <button
            className="boton boton--secundario boton--pequeno"
            type="button"
            onClick={cancelarOcr}
          >
            Cancelar OCR
          </button>
        </div>
      )}

      {estado === 'ocr-vacio' && (
        <div className="lienzo-edicion__mensaje-texto">
          No se detectaron palabras. Usa «Cubrir área».
        </div>
      )}

      {estado === 'error' && (
        <div className="lienzo-edicion__mensaje-texto">
          No se pudo preparar el texto. Puedes usar «Cubrir área».
        </div>
      )}

      {estado === 'ocr-lista' &&
        palabrasOcr.map((palabra, indice) => (
          <button
            className="lienzo-edicion__palabra-ocr"
            key={`${palabra.texto}-${indice}`}
            type="button"
            title={`Editar «${palabra.texto}»`}
            aria-label={`Editar la palabra ${palabra.texto}`}
            style={{
              left: `${palabra.izquierda * 100}%`,
              top: `${palabra.superior * 100}%`,
              width: `${palabra.ancho * 100}%`,
              height: `${palabra.alto * 100}%`,
            }}
            onClick={() =>
              (() => {
                const cajas = [{
                  izquierda: palabra.izquierda,
                  superior: palabra.superior,
                  ancho: palabra.ancho,
                  alto: palabra.alto,
                }]
                const colores = estimarColores(referencia.current, cajas)

                alSeleccionar({
                  texto: palabra.texto,
                  cajas,
                  tamano: estimarTamanoTexto(cajas[0], altoPaginaPuntos.current),
                  tipografia: 'helvetica',
                  lineaBase: leerLineaBase(null, cajas[0]),
                  colorTexto: colores.texto,
                  colorFondo: colores.fondo,
                })
              })()
            }
          />
        ))}
    </div>
  )
}

function estimarTamanoTexto(
  caja: CajaTextoSeleccionado | undefined,
  altoPagina: number,
): number {
  if (caja === undefined) {
    return 12
  }

  return Math.min(200, Math.max(4, Math.round(caja.alto * altoPagina * 0.78)))
}

function leerTamanoTexto(
  fragmento: HTMLElement | null,
  caja: CajaTextoSeleccionado | undefined,
  altoPagina: number,
): number {
  const declarado = Number(fragmento?.dataset.tamano)

  // Se redondea a centésimas porque la matriz del PDF devuelve cosas como
  // 11,9999995 y en el panel se lee como un cuerpo raro en vez de como 12.
  return Number.isFinite(declarado) && declarado > 0
    ? Math.round(Math.min(200, Math.max(4, declarado)) * 100) / 100
    : estimarTamanoTexto(caja, altoPagina)
}

/**
 * Pasa el origen de un fragmento de texto a coordenadas de la vista.
 *
 * Solo hace falta la componente vertical, que es la línea base. La matriz de la
 * vista invierte el eje, así que este cálculo es lo que traduce «tantos puntos
 * desde abajo» a «tantos píxeles desde arriba».
 */
function proyectarLineaBase(
  matrizVista: readonly number[],
  matrizTexto: readonly number[],
): number {
  const x = matrizTexto[4] ?? 0
  const y = matrizTexto[5] ?? 0

  return (matrizVista[1] ?? 0) * x + (matrizVista[3] ?? 0) * y + (matrizVista[5] ?? 0)
}

/** Línea base del fragmento, en fracciones de la página, con reserva razonable. */
function leerLineaBase(
  fragmento: HTMLElement | null,
  caja: CajaTextoSeleccionado | undefined,
): number {
  const declarada = Number(fragmento?.dataset.lineaBase)

  if (Number.isFinite(declarada) && declarada > 0) {
    return declarada
  }

  return caja === undefined
    ? LINEA_BASE_APROXIMADA
    : caja.superior + caja.alto * LINEA_BASE_APROXIMADA
}

function leerTipografia(fragmento: HTMLElement | null): ClaveTipografia {
  const declarada = fragmento?.dataset.tipografia

  return esClaveTipografia(declarada) ? declarada : 'helvetica'
}

/**
 * Elige el color más frecuente dentro de la palabra renderizada. Los píxeles de
 * fondo suelen ser muchos más que los trazos de las letras, incluso con antialias.
 */
function estimarColores(
  contenedor: HTMLElement | null,
  cajas: readonly CajaTextoSeleccionado[],
): { readonly fondo: string; readonly texto: string } {
  const lienzo = contenedor
    ?.closest('.lienzo-edicion__pagina')
    ?.querySelector('canvas')

  if (!(lienzo instanceof HTMLCanvasElement) || lienzo.width === 0) {
    return { fondo: '#ffffff', texto: '#111111' }
  }

  const contexto = lienzo.getContext('2d', { willReadFrequently: true })

  if (contexto === null) {
    return { fondo: '#ffffff', texto: '#111111' }
  }

  const frecuencias = new Map<number, { cantidad: number; r: number; g: number; b: number }>()
  const muestras: Array<{ readonly r: number; readonly g: number; readonly b: number }> = []

  try {
    for (const caja of cajas) {
      const x = Math.max(0, Math.floor(caja.izquierda * lienzo.width))
      const y = Math.max(0, Math.floor(caja.superior * lienzo.height))
      const ancho = Math.max(1, Math.min(lienzo.width - x, Math.ceil(caja.ancho * lienzo.width)))
      const alto = Math.max(1, Math.min(lienzo.height - y, Math.ceil(caja.alto * lienzo.height)))
      const pixeles = contexto.getImageData(x, y, ancho, alto).data
      const paso = Math.max(4, Math.ceil(pixeles.length / 80_000) * 4)

      for (let indice = 0; indice < pixeles.length; indice += paso) {
        if ((pixeles[indice + 3] ?? 0) < 200) {
          continue
        }

        const r = pixeles[indice] ?? 255
        const g = pixeles[indice + 1] ?? 255
        const b = pixeles[indice + 2] ?? 255
        muestras.push({ r, g, b })
        const clave = (Math.floor(r / 16) << 8) | (Math.floor(g / 16) << 4) | Math.floor(b / 16)
        const actual = frecuencias.get(clave) ?? { cantidad: 0, r: 0, g: 0, b: 0 }

        frecuencias.set(clave, {
          cantidad: actual.cantidad + 1,
          r: actual.r + r,
          g: actual.g + g,
          b: actual.b + b,
        })
      }
    }
  } catch {
    return { fondo: '#ffffff', texto: '#111111' }
  }

  const dominante = [...frecuencias.values()].sort(
    (primero, segundo) => segundo.cantidad - primero.cantidad,
  )[0]

  if (dominante === undefined || dominante.cantidad === 0) {
    return { fondo: '#ffffff', texto: '#111111' }
  }

  const fondoRgb = {
    r: Math.round(dominante.r / dominante.cantidad),
    g: Math.round(dominante.g / dominante.cantidad),
    b: Math.round(dominante.b / dominante.cantidad),
  }
  // El color de la letra es el más alejado del fondo, no el más repetido entre los
  // que no son fondo: en un texto pequeño la mayoría de píxeles distintos del fondo
  // son antialias, y quedarse con ellos devuelve un gris lavado en vez del negro real.
  const alejadas = muestras
    .map((muestra) => ({
      muestra,
      distancia: Math.hypot(
        muestra.r - fondoRgb.r,
        muestra.g - fondoRgb.g,
        muestra.b - fondoRgb.b,
      ),
    }))
    .filter((candidata) => candidata.distancia >= 55)
    .sort((primera, segunda) => segunda.distancia - primera.distancia)

  if (alejadas.length === 0) {
    return { fondo: convertirRgbAHex(fondoRgb), texto: '#111111' }
  }

  // Se promedia el núcleo de los trazos, no un único píxel, para que un artefacto
  // suelto de compresión no decida el color de toda la corrección.
  const nucleo = alejadas.slice(0, Math.max(1, Math.round(alejadas.length * 0.2)))
  const suma = nucleo.reduce(
    (acumulado, candidata) => ({
      r: acumulado.r + candidata.muestra.r,
      g: acumulado.g + candidata.muestra.g,
      b: acumulado.b + candidata.muestra.b,
    }),
    { r: 0, g: 0, b: 0 },
  )

  return {
    fondo: convertirRgbAHex(fondoRgb),
    texto: convertirRgbAHex({
      r: suma.r / nucleo.length,
      g: suma.g / nucleo.length,
      b: suma.b / nucleo.length,
    }),
  }
}

interface FuentePdfJs {
  readonly name?: string
  readonly bold?: boolean
  readonly black?: boolean
  readonly italic?: boolean
}

function esItemTexto(item: TextItem | { readonly type: string }): item is TextItem {
  return 'str' in item
}

function obtenerFragmentoTexto(
  nodo: Node,
  contenedor: HTMLElement,
): HTMLElement | null {
  const elemento = nodo.nodeType === Node.ELEMENT_NODE
    ? (nodo as Element)
    : nodo.parentElement
  const fragmento = elemento?.closest('span')

  return fragmento instanceof HTMLElement && contenedor.contains(fragmento)
    ? fragmento
    : null
}

function esClaveTipografia(valor: string | undefined): valor is ClaveTipografia {
  return valor === 'helvetica' ||
    valor === 'helvetica-negrita' ||
    valor === 'helvetica-cursiva' ||
    valor === 'times' ||
    valor === 'times-negrita' ||
    valor === 'times-cursiva' ||
    valor === 'courier' ||
    valor === 'courier-negrita'
}

function convertirRgbAHex(color: {
  readonly r: number
  readonly g: number
  readonly b: number
}): string {
  const hexadecimal = (valor: number) =>
    Math.min(255, Math.max(0, Math.round(valor)))
      .toString(16)
      .padStart(2, '0')

  return `#${hexadecimal(color.r)}${hexadecimal(color.g)}${hexadecimal(color.b)}`
}
