import { normalizarRotacion } from './rotaciones'
import type { GradosRotacion } from './tipos'

/**
 * Colocación de contenido sobre una página, respetando su rotación.
 *
 * Una página PDF puede llevar una rotación propia —el atributo `/Rotate`— que el
 * visor aplica al mostrarla. Sus coordenadas internas, en cambio, no cambian: el
 * origen sigue en la esquina inferior izquierda de la página sin girar.
 *
 * Si se ignorase esa rotación, un número de página colocado «abajo a la derecha»
 * aparecería girado y en otra esquina en cuanto el documento llevase páginas
 * apaisadas. Este módulo traduce entre las dos formas de ver la página:
 *
 * - Coordenadas **visibles**: las que ve la persona, con el origen en la esquina
 *   inferior izquierda de la página tal y como se muestra.
 * - Coordenadas **PDF**: las que espera pdf-lib.
 *
 * Todas las funciones son puras, así que se pueden probar sin generar documentos.
 */

/** Posiciones en las que se puede colocar contenido dentro de una página. */
export type PosicionEnPagina =
  | 'superior-izquierda'
  | 'superior-centro'
  | 'superior-derecha'
  | 'centro-izquierda'
  | 'centro'
  | 'centro-derecha'
  | 'inferior-izquierda'
  | 'inferior-centro'
  | 'inferior-derecha'

/** Alineación horizontal que corresponde a cada posición. */
type AlineacionHorizontal = 'izquierda' | 'centro' | 'derecha'

/** Alineación vertical que corresponde a cada posición. */
type AlineacionVertical = 'superior' | 'centro' | 'inferior'

/** Caja de una página, en puntos PDF y sin aplicar su rotación. */
export interface CajaPagina {
  /** Coordenada horizontal del origen de la caja. */
  readonly x: number
  /** Coordenada vertical del origen de la caja. */
  readonly y: number
  /** Ancho de la página sin girar. */
  readonly ancho: number
  /** Alto de la página sin girar. */
  readonly alto: number
}

/** Medidas en puntos PDF. */
export interface Medidas {
  readonly ancho: number
  readonly alto: number
}

/** Punto en puntos PDF. */
export interface Punto {
  readonly x: number
  readonly y: number
}

/** Descomposición de una posición en sus dos alineaciones. */
const ALINEACIONES: Readonly<
  Record<
    PosicionEnPagina,
    { readonly horizontal: AlineacionHorizontal; readonly vertical: AlineacionVertical }
  >
> = {
  'superior-izquierda': { horizontal: 'izquierda', vertical: 'superior' },
  'superior-centro': { horizontal: 'centro', vertical: 'superior' },
  'superior-derecha': { horizontal: 'derecha', vertical: 'superior' },
  'centro-izquierda': { horizontal: 'izquierda', vertical: 'centro' },
  centro: { horizontal: 'centro', vertical: 'centro' },
  'centro-derecha': { horizontal: 'derecha', vertical: 'centro' },
  'inferior-izquierda': { horizontal: 'izquierda', vertical: 'inferior' },
  'inferior-centro': { horizontal: 'centro', vertical: 'inferior' },
  'inferior-derecha': { horizontal: 'derecha', vertical: 'inferior' },
}

/** Nombre visible de cada posición. */
const NOMBRE_POSICION: Readonly<Record<PosicionEnPagina, string>> = {
  'superior-izquierda': 'Superior izquierda',
  'superior-centro': 'Superior centro',
  'superior-derecha': 'Superior derecha',
  'centro-izquierda': 'Centro izquierda',
  centro: 'Centro',
  'centro-derecha': 'Centro derecha',
  'inferior-izquierda': 'Inferior izquierda',
  'inferior-centro': 'Inferior centro',
  'inferior-derecha': 'Inferior derecha',
}

/** Las seis posiciones que usa la numeración de páginas. */
export const POSICIONES_NUMERACION: readonly PosicionEnPagina[] = [
  'superior-izquierda',
  'superior-centro',
  'superior-derecha',
  'inferior-izquierda',
  'inferior-centro',
  'inferior-derecha',
]

/** Las nueve posiciones que usa la marca de agua. */
export const POSICIONES_COMPLETAS: readonly PosicionEnPagina[] = [
  'superior-izquierda',
  'superior-centro',
  'superior-derecha',
  'centro-izquierda',
  'centro',
  'centro-derecha',
  'inferior-izquierda',
  'inferior-centro',
  'inferior-derecha',
]

/** Devuelve el nombre visible de una posición. */
export function describirPosicion(posicion: PosicionEnPagina): string {
  return NOMBRE_POSICION[posicion]
}

/**
 * Medidas de la página tal y como se ve.
 * Con un cuarto o tres cuartos de vuelta el ancho y el alto se intercambian.
 */
export function calcularMedidasVisibles(
  caja: CajaPagina,
  rotacion: GradosRotacion,
): Medidas {
  const normalizada = normalizarRotacion(rotacion)

  if (normalizada === 90 || normalizada === 270) {
    return { ancho: caja.alto, alto: caja.ancho }
  }

  return { ancho: caja.ancho, alto: caja.alto }
}

/**
 * Traduce un punto de coordenadas visibles a coordenadas PDF.
 *
 * El visor gira la página en el sentido de las agujas del reloj, así que para
 * volver a las coordenadas internas hay que girar el punto en sentido contrario
 * y sumarle después el origen de la caja.
 */
export function puntoVisibleAPdf(
  caja: CajaPagina,
  rotacion: GradosRotacion,
  visible: Punto,
): Punto {
  const normalizada = normalizarRotacion(rotacion)

  switch (normalizada) {
    case 90:
      return {
        x: caja.x + caja.ancho - visible.y,
        y: caja.y + visible.x,
      }
    case 180:
      return {
        x: caja.x + caja.ancho - visible.x,
        y: caja.y + caja.alto - visible.y,
      }
    case 270:
      return {
        x: caja.x + visible.y,
        y: caja.y + caja.alto - visible.x,
      }
    case 0:
      return { x: caja.x + visible.x, y: caja.y + visible.y }
  }
}

/**
 * Caja que envuelve un contenido girado.
 *
 * pdf-lib gira el contenido alrededor del punto en el que se dibuja, que es su
 * esquina inferior izquierda sin girar. Al girarlo, esa esquina deja de coincidir
 * con la de la caja que realmente ocupa, así que hace falta saber cuánto se ha
 * desplazado para poder colocarlo donde se espera.
 */
export interface CajaRotada {
  /** Ancho de la caja envolvente. */
  readonly ancho: number
  /** Alto de la caja envolvente. */
  readonly alto: number
  /** Distancia horizontal del origen del contenido al borde de la caja. */
  readonly desplazamientoX: number
  /** Distancia vertical del origen del contenido al borde de la caja. */
  readonly desplazamientoY: number
}

/** Convierte grados a radianes. */
function aRadianes(grados: number): number {
  return (grados * Math.PI) / 180
}

/**
 * Calcula la caja que ocupa un contenido girado.
 *
 * El giro se expresa en grados en sentido contrario a las agujas del reloj, que
 * es el sentido que usa pdf-lib.
 */
export function calcularCajaRotada(
  contenido: Medidas,
  grados: number,
): CajaRotada {
  const angulo = aRadianes(grados)
  const coseno = Math.cos(angulo)
  const seno = Math.sin(angulo)

  const esquinas: readonly Punto[] = [
    { x: 0, y: 0 },
    { x: contenido.ancho * coseno, y: contenido.ancho * seno },
    {
      x: contenido.ancho * coseno - contenido.alto * seno,
      y: contenido.ancho * seno + contenido.alto * coseno,
    },
    { x: -contenido.alto * seno, y: contenido.alto * coseno },
  ]

  const equis = esquinas.map((esquina) => esquina.x)
  const yes = esquinas.map((esquina) => esquina.y)

  const minimoX = Math.min(...equis)
  const minimoY = Math.min(...yes)

  return {
    ancho: Math.max(...equis) - minimoX,
    alto: Math.max(...yes) - minimoY,
    // Se suma cero para no arrastrar un cero negativo, que aparecería al negar un
    // mínimo que ya valía cero y complica las comparaciones.
    desplazamientoX: -minimoX + 0,
    desplazamientoY: -minimoY + 0,
  }
}

/** Gira un punto en sentido contrario a las agujas del reloj. */
export function girarPunto(punto: Punto, grados: number): Punto {
  const angulo = aRadianes(grados)
  const coseno = Math.cos(angulo)
  const seno = Math.sin(angulo)

  return {
    x: punto.x * coseno - punto.y * seno,
    y: punto.x * seno + punto.y * coseno,
  }
}

/** Datos necesarios para colocar contenido en una página. */
export interface PeticionColocacion {
  /** Caja de la página, sin aplicar su rotación. */
  readonly caja: CajaPagina
  /** Rotación que declara la página. */
  readonly rotacionPagina: GradosRotacion
  /** Posición elegida. */
  readonly posicion: PosicionEnPagina
  /** Medidas del contenido sin girar. */
  readonly contenido: Medidas
  /** Separación respecto a los bordes izquierdo y derecho, en puntos. */
  readonly margenHorizontal: number
  /** Separación respecto a los bordes superior e inferior, en puntos. */
  readonly margenVertical: number
  /**
   * Giro propio del contenido, en grados y en sentido contrario a las agujas del
   * reloj. Lo usa la marca de agua; la numeración no gira su texto.
   */
  readonly rotacionContenido?: number
  /**
   * Desplazamiento del punto de dibujado respecto al origen del contenido, en
   * las coordenadas del propio contenido y antes de girarlo.
   *
   * Lo usa el texto: pdf-lib lo coloca por su línea base, mientras que aquí se
   * razona con la caja completa, así que hay que subir la línea base la altura de
   * los rasgos descendentes.
   */
  readonly desplazamientoLocal?: Punto
}

/** Resultado de colocar contenido en una página. */
export interface ColocacionEnPagina {
  /** Coordenada horizontal en puntos PDF, lista para pdf-lib. */
  readonly x: number
  /** Coordenada vertical en puntos PDF, lista para pdf-lib. */
  readonly y: number
  /**
   * Grados que hay que pasar a pdf-lib al dibujar.
   *
   * Suma la rotación de la página y el giro propio del contenido: así el
   * contenido se ve con el giro elegido después de que el visor gire la página.
   */
  readonly rotacionGrados: number
  /** Esquina inferior izquierda de la caja envolvente, en coordenadas visibles. */
  readonly visible: Punto
  /** Medidas de la caja envolvente, en coordenadas visibles. */
  readonly cajaVisible: Medidas
}

/**
 * Calcula dónde dibujar un contenido dentro de una página.
 *
 * Devuelve el punto que pdf-lib espera junto con la rotación que hay que
 * aplicarle. La posición se decide sobre la caja que el contenido ocupa una vez
 * girado, de modo que una marca de agua inclinada en una esquina no se sale de la
 * página.
 */
export function calcularColocacionEnPagina(
  peticion: PeticionColocacion,
): ColocacionEnPagina {
  const visibles = calcularMedidasVisibles(
    peticion.caja,
    peticion.rotacionPagina,
  )
  const rotacionContenido = peticion.rotacionContenido ?? 0
  const cajaRotada = calcularCajaRotada(peticion.contenido, rotacionContenido)
  const { horizontal, vertical } = ALINEACIONES[peticion.posicion]

  const x = calcularCoordenada(
    horizontal === 'izquierda'
      ? 'inicio'
      : horizontal === 'derecha'
        ? 'final'
        : 'centro',
    visibles.ancho,
    cajaRotada.ancho,
    peticion.margenHorizontal,
  )

  const y = calcularCoordenada(
    vertical === 'inferior'
      ? 'inicio'
      : vertical === 'superior'
        ? 'final'
        : 'centro',
    visibles.alto,
    cajaRotada.alto,
    peticion.margenVertical,
  )

  return {
    ...colocarEnPunto(peticion, { x, y }, cajaRotada, rotacionContenido),
    cajaVisible: { ancho: cajaRotada.ancho, alto: cajaRotada.alto },
  }
}

/**
 * Lo que la colocación necesita de verdad para traducir un punto visible.
 *
 * Se declara aparte de `PeticionColocacion` porque hay dos formas de decidir el
 * punto —por posición fija o eligiéndolo libremente— y ambas comparten esta parte.
 */
interface ContextoColocacion {
  /** Caja de la página, sin aplicar su rotación. */
  readonly caja: CajaPagina
  /** Rotación que declara la página. */
  readonly rotacionPagina: GradosRotacion
  /** Desplazamiento del punto de dibujado, en coordenadas del contenido. */
  readonly desplazamientoLocal?: Punto
}

/** Datos para colocar contenido en un punto visible elegido libremente. */
export interface PeticionColocacionLibre extends ContextoColocacion {
  /** Medidas del contenido sin girar. */
  readonly contenido: Medidas
  /**
   * Esquina inferior izquierda de la caja envolvente, en coordenadas visibles y
   * en puntos. El origen visible está abajo a la izquierda, igual que en PDF.
   */
  readonly esquinaVisible: Punto
  /** Giro propio del contenido, en grados y en sentido antihorario. */
  readonly rotacionContenido?: number
}

/**
 * Coloca contenido en un punto visible concreto, sin anclarlo a una posición fija.
 *
 * Lo usa el editor visual, donde cada elemento tiene sus propias coordenadas en vez
 * de elegir entre nueve posiciones. Comparte toda la traducción a coordenadas PDF
 * con `calcularColocacionEnPagina`, incluido el caso difícil de las páginas giradas.
 */
export function calcularColocacionLibre(
  peticion: PeticionColocacionLibre,
): ColocacionEnPagina {
  const rotacionContenido = peticion.rotacionContenido ?? 0
  const cajaRotada = calcularCajaRotada(peticion.contenido, rotacionContenido)

  return {
    ...colocarEnPunto(
      peticion,
      peticion.esquinaVisible,
      cajaRotada,
      rotacionContenido,
    ),
    cajaVisible: { ancho: cajaRotada.ancho, alto: cajaRotada.alto },
  }
}

/**
 * Coloca el contenido con su caja envolvente en un punto visible concreto.
 * Lo usan tanto la colocación por posición como el mosaico.
 */
function colocarEnPunto(
  peticion: ContextoColocacion,
  esquinaCaja: Punto,
  cajaRotada: CajaRotada,
  rotacionContenido: number,
): Omit<ColocacionEnPagina, 'cajaVisible'> {
  // Del borde de la caja al origen del contenido.
  const origen: Punto = {
    x: esquinaCaja.x + cajaRotada.desplazamientoX,
    y: esquinaCaja.y + cajaRotada.desplazamientoY,
  }

  // El desplazamiento se expresa en las coordenadas del contenido, así que se
  // gira igual que él antes de sumarlo.
  const local = peticion.desplazamientoLocal ?? { x: 0, y: 0 }
  const desplazado = girarPunto(local, rotacionContenido)

  const visible: Punto = {
    x: origen.x + desplazado.x,
    y: origen.y + desplazado.y,
  }

  const enPdf = puntoVisibleAPdf(
    peticion.caja,
    peticion.rotacionPagina,
    visible,
  )

  return {
    x: enPdf.x,
    y: enPdf.y,
    rotacionGrados:
      normalizarRotacion(peticion.rotacionPagina) + rotacionContenido,
    visible: esquinaCaja,
  }
}

/**
 * Calcula la colocación de todas las copias de un mosaico.
 *
 * Las copias se reparten en una retícula que cubre la página, con la separación
 * indicada entre una y la siguiente.
 */
export function calcularColocacionesMosaico(
  peticion: PeticionColocacion,
  separacionHorizontal: number,
  separacionVertical: number,
): readonly ColocacionEnPagina[] {
  const visibles = calcularMedidasVisibles(
    peticion.caja,
    peticion.rotacionPagina,
  )
  const rotacionContenido = peticion.rotacionContenido ?? 0
  const cajaRotada = calcularCajaRotada(peticion.contenido, rotacionContenido)
  const cajaVisible: Medidas = {
    ancho: cajaRotada.ancho,
    alto: cajaRotada.alto,
  }

  const puntos = generarReticula(
    visibles,
    cajaVisible,
    separacionHorizontal,
    separacionVertical,
  )

  return puntos.map((punto) => ({
    ...colocarEnPunto(peticion, punto, cajaRotada, rotacionContenido),
    cajaVisible,
  }))
}

/** Calcula una coordenada a lo largo de un eje según la alineación. */
function calcularCoordenada(
  alineacion: 'inicio' | 'centro' | 'final',
  medidaPagina: number,
  medidaContenido: number,
  margen: number,
): number {
  switch (alineacion) {
    case 'inicio':
      return margen
    case 'final':
      return medidaPagina - margen - medidaContenido
    case 'centro':
      return (medidaPagina - medidaContenido) / 2
  }
}

/**
 * Genera los puntos de una retícula que cubre la página, en coordenadas
 * visibles.
 *
 * Lo usa la marca de agua en modo mosaico. Cada punto es la esquina inferior
 * izquierda de una copia del contenido. La retícula se extiende un poco más allá
 * de los bordes para que el mosaico llegue hasta el final de la página.
 */
export function generarReticula(
  medidasPagina: Medidas,
  contenido: Medidas,
  separacionHorizontal: number,
  separacionVertical: number,
): readonly Punto[] {
  const pasoHorizontal = Math.max(1, contenido.ancho + separacionHorizontal)
  const pasoVertical = Math.max(1, contenido.alto + separacionVertical)

  const puntos: Punto[] = []

  for (let y = 0; y < medidasPagina.alto; y += pasoVertical) {
    for (let x = 0; x < medidasPagina.ancho; x += pasoHorizontal) {
      puntos.push({ x, y })
    }
  }

  return puntos
}

/** Número de copias que tendrá un mosaico, para avisar antes de generarlo. */
export function contarCopiasMosaico(
  medidasPagina: Medidas,
  contenido: Medidas,
  separacionHorizontal: number,
  separacionVertical: number,
): number {
  return generarReticula(
    medidasPagina,
    contenido,
    separacionHorizontal,
    separacionVertical,
  ).length
}
