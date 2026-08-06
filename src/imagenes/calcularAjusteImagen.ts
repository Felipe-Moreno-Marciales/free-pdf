import { milimetrosAPuntos, pixelesAPuntos } from '../utilidades/unidades'
import { calcularRecorteParaProporcion, esRecorteCompleto } from './recorteImagen'
import type {
  ClaveMargen,
  ClaveTamanoPagina,
  ColocacionImagen,
  ConfiguracionPaginaImagen,
  DimensionesImagen,
  MedidasPagina,
  OrientacionPagina,
} from './tipos'

/**
 * Cálculo de la página y de la colocación de una imagen dentro de ella.
 *
 * Es el corazón geométrico de «Imágenes a PDF» y de «Escanear a PDF». Todas las
 * funciones son puras y no dependen de pdf-lib ni del navegador, así que la
 * interfaz puede usarlas para la vista previa y el procesamiento para generar el
 * documento, con la garantía de que ambos coinciden.
 *
 * Las medidas de página están en puntos PDF, la unidad del formato: una pulgada
 * son 72 puntos.
 */

/** Medidas de los tamaños de página con nombre, en puntos PDF. */
export const TAMANOS_PAGINA: Readonly<
  Record<Exclude<ClaveTamanoPagina, 'original'>, MedidasPagina>
> = {
  a4: { ancho: 595.28, alto: 841.89 },
  carta: { ancho: 612, alto: 792 },
  legal: { ancho: 612, alto: 1008 },
}

/** Márgenes predefinidos, en milímetros. */
export const MARGENES_MM: Readonly<
  Record<Exclude<ClaveMargen, 'personalizado'>, number>
> = {
  'sin-margen': 0,
  pequeno: 5,
  mediano: 10,
  grande: 20,
}

/** Margen propio máximo admitido, en milímetros. */
export const MARGEN_PERSONALIZADO_MAXIMO_MM = 100

/** Margen propio mínimo admitido, en milímetros. */
export const MARGEN_PERSONALIZADO_MINIMO_MM = 0

/** Medida mínima de una página, en puntos, para no generar páginas vacías. */
const MEDIDA_MINIMA_PAGINA = 1

/** Holgura con la que se comparan medidas en punto flotante. */
const TOLERANCIA = 0.01

/** Color de fondo predeterminado de las páginas generadas. */
export const COLOR_FONDO_PREDETERMINADO = '#ffffff'

/** Configuración con la que arrancan las herramientas de imágenes. */
export const CONFIGURACION_PAGINA_PREDETERMINADA: ConfiguracionPaginaImagen = {
  tamano: 'a4',
  orientacion: 'automatica',
  margen: 'pequeno',
  margenPersonalizadoMm: 10,
  // «Contener» es el modo predeterminado: muestra la imagen completa y nunca
  // descarta parte de su contenido sin que se haya pedido.
  ajuste: 'contener',
  colorFondo: COLOR_FONDO_PREDETERMINADO,
}

/** Nombre visible de cada tamaño de página. */
const NOMBRE_TAMANO: Readonly<Record<ClaveTamanoPagina, string>> = {
  original: 'Tamaño original',
  a4: 'A4',
  carta: 'Carta',
  legal: 'Legal',
}

/** Nombre visible de cada orientación. */
const NOMBRE_ORIENTACION: Readonly<Record<OrientacionPagina, string>> = {
  automatica: 'Automática',
  vertical: 'Vertical',
  horizontal: 'Horizontal',
}

/** Nombre visible de cada margen. */
const NOMBRE_MARGEN: Readonly<Record<ClaveMargen, string>> = {
  'sin-margen': 'Sin margen',
  pequeno: 'Pequeño',
  mediano: 'Mediano',
  grande: 'Grande',
  personalizado: 'Personalizado',
}

/** Devuelve el nombre visible de un tamaño de página. */
export function describirTamanoPagina(tamano: ClaveTamanoPagina): string {
  return NOMBRE_TAMANO[tamano]
}

/** Devuelve el nombre visible de una orientación. */
export function describirOrientacion(orientacion: OrientacionPagina): string {
  return NOMBRE_ORIENTACION[orientacion]
}

/** Devuelve el nombre visible de un margen. */
export function describirMargen(margen: ClaveMargen): string {
  return NOMBRE_MARGEN[margen]
}

/** Limita un margen propio al rango admitido, en milímetros. */
export function limitarMargenPersonalizado(milimetros: number): number {
  if (!Number.isFinite(milimetros)) {
    return MARGEN_PERSONALIZADO_MINIMO_MM
  }

  return Math.min(
    MARGEN_PERSONALIZADO_MAXIMO_MM,
    Math.max(MARGEN_PERSONALIZADO_MINIMO_MM, milimetros),
  )
}

/** Calcula el margen configurado, en milímetros. */
export function calcularMargenMilimetros(
  configuracion: ConfiguracionPaginaImagen,
): number {
  if (configuracion.margen === 'personalizado') {
    return limitarMargenPersonalizado(configuracion.margenPersonalizadoMm)
  }

  return MARGENES_MM[configuracion.margen]
}

/** Calcula el margen configurado, en puntos PDF. */
export function calcularMargenPuntos(
  configuracion: ConfiguracionPaginaImagen,
): number {
  return milimetrosAPuntos(calcularMargenMilimetros(configuracion))
}

/**
 * Aplica una orientación a unas medidas de página.
 *
 * `vertical` garantiza que el alto sea el lado mayor y `horizontal` que lo sea
 * el ancho; `automatica` deja las medidas tal y como llegan, porque quien la
 * llama ya ha decidido la orientación en función de la imagen.
 */
export function aplicarOrientacion(
  medidas: MedidasPagina,
  orientacion: OrientacionPagina,
): MedidasPagina {
  const menor = Math.min(medidas.ancho, medidas.alto)
  const mayor = Math.max(medidas.ancho, medidas.alto)

  if (orientacion === 'vertical') {
    return { ancho: menor, alto: mayor }
  }

  if (orientacion === 'horizontal') {
    return { ancho: mayor, alto: menor }
  }

  return medidas
}

/**
 * Calcula las medidas de la página que alojará una imagen.
 *
 * Con `original` la página se deriva de la propia imagen: sus píxeles se
 * interpretan a 96 píxeles por pulgada y se le suman los márgenes, de modo que
 * la imagen aparece a su tamaño natural. Con un tamaño con nombre se usan sus
 * medidas normalizadas.
 *
 * La orientación `automatica` hace que una imagen horizontal produzca una
 * página horizontal, y una vertical, una página vertical.
 */
export function calcularMedidasPagina(
  dimensiones: DimensionesImagen,
  configuracion: ConfiguracionPaginaImagen,
): MedidasPagina {
  const margen = calcularMargenPuntos(configuracion)
  const imagenEsHorizontal = dimensiones.ancho > dimensiones.alto

  if (configuracion.tamano === 'original') {
    const base: MedidasPagina = {
      ancho: pixelesAPuntos(dimensiones.ancho) + margen * 2,
      alto: pixelesAPuntos(dimensiones.alto) + margen * 2,
    }

    return asegurarMedidasMinimas(
      aplicarOrientacion(base, configuracion.orientacion),
    )
  }

  const base = TAMANOS_PAGINA[configuracion.tamano]

  if (configuracion.orientacion === 'automatica') {
    return asegurarMedidasMinimas(
      aplicarOrientacion(base, imagenEsHorizontal ? 'horizontal' : 'vertical'),
    )
  }

  return asegurarMedidasMinimas(
    aplicarOrientacion(base, configuracion.orientacion),
  )
}

/** Garantiza que ninguna medida sea cero o negativa. */
function asegurarMedidasMinimas(medidas: MedidasPagina): MedidasPagina {
  return {
    ancho: Math.max(MEDIDA_MINIMA_PAGINA, medidas.ancho),
    alto: Math.max(MEDIDA_MINIMA_PAGINA, medidas.alto),
  }
}

/** Área de la página que queda libre después de aplicar los márgenes. */
export function calcularAreaDisponible(
  pagina: MedidasPagina,
  margen: number,
): MedidasPagina {
  return {
    ancho: Math.max(MEDIDA_MINIMA_PAGINA, pagina.ancho - margen * 2),
    alto: Math.max(MEDIDA_MINIMA_PAGINA, pagina.alto - margen * 2),
  }
}

/**
 * Calcula dónde y con qué medidas se dibuja una imagen en su página.
 *
 * `dimensiones` deben ser las de la imagen tal y como se va a dibujar, es decir,
 * después de aplicarle el giro que la persona haya elegido.
 *
 * En el modo «contener» la imagen se reduce hasta caber por completo en el área
 * disponible y se centra, así que se ve entera y conserva su proporción. En el
 * modo «cubrir» se rellena todo el área disponible y se devuelve además el
 * recorte centrado que hay que aplicarle para que su proporción coincida: la
 * imagen nunca se deforma, se descartan sus bordes.
 */
export function calcularColocacion(
  dimensiones: DimensionesImagen,
  configuracion: ConfiguracionPaginaImagen,
): ColocacionImagen {
  const pagina = calcularMedidasPagina(dimensiones, configuracion)
  const margen = calcularMargenPuntos(configuracion)
  const disponible = calcularAreaDisponible(pagina, margen)

  const anchoImagen = Math.max(1, dimensiones.ancho)
  const altoImagen = Math.max(1, dimensiones.alto)

  if (configuracion.ajuste === 'cubrir') {
    const recorte = calcularRecorteParaProporcion(
      { ancho: anchoImagen, alto: altoImagen },
      disponible.ancho / disponible.alto,
    )

    return {
      pagina,
      x: (pagina.ancho - disponible.ancho) / 2,
      y: (pagina.alto - disponible.alto) / 2,
      ancho: disponible.ancho,
      alto: disponible.alto,
      recorte: esRecorteCompleto(recorte) ? null : recorte,
      recorta: !esRecorteCompleto(recorte),
    }
  }

  const escala = Math.min(
    disponible.ancho / anchoImagen,
    disponible.alto / altoImagen,
  )
  const ancho = anchoImagen * escala
  const alto = altoImagen * escala

  return {
    pagina,
    x: (pagina.ancho - ancho) / 2,
    y: (pagina.alto - alto) / 2,
    ancho,
    alto,
    recorte: null,
    recorta: false,
  }
}

/**
 * Comprueba si los márgenes dejan un área utilizable en la página.
 *
 * Con los límites actuales el margen propio no puede llegar a agotar ni la página
 * con nombre más pequeña, así que en la práctica siempre devuelve `true`. Se
 * mantiene como salvaguarda explícita: si algún día se admitieran márgenes
 * mayores o tamaños de página menores, el cálculo seguiría siendo correcto y la
 * interfaz podría avisar antes de generar un documento inservible.
 */
export function losMargenesDejanEspacio(
  dimensiones: DimensionesImagen,
  configuracion: ConfiguracionPaginaImagen,
): boolean {
  if (configuracion.tamano === 'original') {
    return true
  }

  const pagina = calcularMedidasPagina(dimensiones, configuracion)
  const margen = calcularMargenPuntos(configuracion)

  return (
    pagina.ancho - margen * 2 > TOLERANCIA &&
    pagina.alto - margen * 2 > TOLERANCIA
  )
}

/**
 * Proporción de la página que la imagen llega a aprovechar, entre 0 y 1.
 *
 * Sirve para avisar cuando unos márgenes muy amplios dejan la imagen tan pequeña
 * que probablemente no sea lo que se pretendía.
 */
export function calcularProporcionAprovechada(
  dimensiones: DimensionesImagen,
  configuracion: ConfiguracionPaginaImagen,
): number {
  const colocacion = calcularColocacion(dimensiones, configuracion)
  const areaPagina = colocacion.pagina.ancho * colocacion.pagina.alto

  if (areaPagina <= 0) {
    return 0
  }

  return (colocacion.ancho * colocacion.alto) / areaPagina
}

/**
 * Proporción por debajo de la cual se avisa de que la imagen quedará muy
 * pequeña dentro de la página.
 */
export const PROPORCION_MINIMA_RECOMENDADA = 0.35

/** `true` cuando la imagen apenas aprovecha la página. */
export function laImagenQuedaMuyPequena(
  dimensiones: DimensionesImagen,
  configuracion: ConfiguracionPaginaImagen,
): boolean {
  return (
    calcularProporcionAprovechada(dimensiones, configuracion) <
    PROPORCION_MINIMA_RECOMENDADA
  )
}
