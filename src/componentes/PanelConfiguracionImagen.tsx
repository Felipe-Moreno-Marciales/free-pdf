import {
  MARGEN_PERSONALIZADO_MAXIMO_MM,
  MARGEN_PERSONALIZADO_MINIMO_MM,
  calcularMargenMilimetros,
  describirMargen,
  describirOrientacion,
  describirTamanoPagina,
} from '../imagenes/calcularAjusteImagen'
import type {
  ClaveMargen,
  ClaveTamanoPagina,
  ConfiguracionPaginaImagen,
  ModoAjuste,
  OrientacionPagina,
} from '../imagenes/tipos'
import { formatearMilimetros } from '../utilidades/unidades'
import { CampoNumero } from './CampoNumero'
import { GrupoOpciones, type OpcionElegible } from './GrupoOpciones'
import { SelectorColor } from './SelectorColor'

/** Tamaños de página que se ofrecen. */
const TAMANOS: readonly ClaveTamanoPagina[] = [
  'original',
  'a4',
  'carta',
  'legal',
]

/** Orientaciones que se ofrecen. */
const ORIENTACIONES: readonly OrientacionPagina[] = [
  'automatica',
  'vertical',
  'horizontal',
]

/** Márgenes que se ofrecen. */
const MARGENES: readonly ClaveMargen[] = [
  'sin-margen',
  'pequeno',
  'mediano',
  'grande',
  'personalizado',
]

/** Opciones del tamaño de página. */
const OPCIONES_TAMANO: readonly OpcionElegible<ClaveTamanoPagina>[] =
  TAMANOS.map((tamano) => ({
    valor: tamano,
    etiqueta: describirTamanoPagina(tamano),
  }))

/** Opciones de la orientación. */
const OPCIONES_ORIENTACION: readonly OpcionElegible<OrientacionPagina>[] =
  ORIENTACIONES.map((orientacion) => ({
    valor: orientacion,
    etiqueta: describirOrientacion(orientacion),
  }))

/** Opciones del margen. */
const OPCIONES_MARGEN: readonly OpcionElegible<ClaveMargen>[] = MARGENES.map(
  (margen) => ({ valor: margen, etiqueta: describirMargen(margen) }),
)

/** Opciones del modo de ajuste. */
const OPCIONES_AJUSTE: readonly OpcionElegible<ModoAjuste>[] = [
  {
    valor: 'contener',
    etiqueta: 'Contener',
    descripcion: 'Muestra la imagen completa.',
  },
  {
    valor: 'cubrir',
    etiqueta: 'Cubrir',
    descripcion: 'Rellena la página y recorta los bordes que sobran.',
  },
]

interface PropiedadesPanelConfiguracionImagen {
  /** Configuración actual. */
  readonly configuracion: ConfiguracionPaginaImagen
  /** Bloquea los controles mientras hay un proceso en curso. */
  readonly deshabilitado: boolean
  /** Se ejecuta con los cambios parciales de la configuración. */
  readonly alCambiar: (cambios: Partial<ConfiguracionPaginaImagen>) => void
  /** Advertencia sobre la configuración actual, o `null`. */
  readonly advertencia?: string | null
  /** Oculta el selector de color de fondo cuando no procede. */
  readonly mostrarColorFondo?: boolean
}

/**
 * Controles de las páginas que se generan a partir de imágenes.
 *
 * Los comparten «Imágenes a PDF» y «Escanear a PDF», así que las dos
 * herramientas ofrecen exactamente las mismas opciones con los mismos textos.
 * El campo de margen propio solo aparece cuando se elige «Personalizado», para
 * no mostrar controles que no tienen efecto.
 */
export function PanelConfiguracionImagen({
  configuracion,
  deshabilitado,
  alCambiar,
  advertencia = null,
  mostrarColorFondo = true,
}: PropiedadesPanelConfiguracionImagen) {
  return (
    <div className="configuracion-imagen">
      <GrupoOpciones
        etiqueta="Tamaño de página"
        opciones={OPCIONES_TAMANO}
        valor={configuracion.tamano}
        deshabilitado={deshabilitado}
        alCambiar={(tamano) => alCambiar({ tamano })}
        ayuda={
          configuracion.tamano === 'original'
            ? 'La página se ajusta a la imagen, interpretando sus píxeles a 96 por pulgada. Una fotografía muy grande produce una página muy grande.'
            : undefined
        }
      />

      <GrupoOpciones
        etiqueta="Orientación"
        opciones={OPCIONES_ORIENTACION}
        valor={configuracion.orientacion}
        deshabilitado={deshabilitado}
        alCambiar={(orientacion) => alCambiar({ orientacion })}
        ayuda={
          configuracion.orientacion === 'automatica'
            ? 'Cada página adopta la orientación de su imagen.'
            : undefined
        }
      />

      <GrupoOpciones
        etiqueta="Márgenes"
        opciones={OPCIONES_MARGEN}
        valor={configuracion.margen}
        deshabilitado={deshabilitado}
        alCambiar={(margen) => alCambiar({ margen })}
        ayuda={`Margen actual: ${formatearMilimetros(
          calcularMargenMilimetros(configuracion),
        )} por cada lado.`}
      />

      {configuracion.margen === 'personalizado' && (
        <CampoNumero
          etiqueta="Margen propio"
          valor={configuracion.margenPersonalizadoMm}
          minimo={MARGEN_PERSONALIZADO_MINIMO_MM}
          maximo={MARGEN_PERSONALIZADO_MAXIMO_MM}
          paso={1}
          unidad="mm"
          deshabilitado={deshabilitado}
          alCambiar={(margenPersonalizadoMm) =>
            alCambiar({ margenPersonalizadoMm })
          }
          ayuda={`Entre ${MARGEN_PERSONALIZADO_MINIMO_MM} y ${MARGEN_PERSONALIZADO_MAXIMO_MM} milímetros.`}
        />
      )}

      <GrupoOpciones
        etiqueta="Modo de ajuste"
        opciones={OPCIONES_AJUSTE}
        valor={configuracion.ajuste}
        deshabilitado={deshabilitado}
        alCambiar={(ajuste) => alCambiar({ ajuste })}
        ayuda="En los dos modos se conserva la proporción original: las imágenes nunca se deforman."
      />

      {mostrarColorFondo && (
        <SelectorColor
          etiqueta="Color de fondo"
          valor={configuracion.colorFondo}
          deshabilitado={deshabilitado}
          alCambiar={(colorFondo) => alCambiar({ colorFondo })}
          ayuda="Se ve en los márgenes y en las zonas que la imagen no cubre."
        />
      )}

      {advertencia !== null && (
        <p className="configuracion-imagen__advertencia">{advertencia}</p>
      )}
    </div>
  )
}
