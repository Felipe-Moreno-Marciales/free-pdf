import {
  GROSOR_MAXIMO,
  GROSOR_MINIMO,
  NOMBRE_FIGURA,
  TAMANO_TEXTO_MAXIMO,
  TAMANO_TEXTO_MINIMO,
} from '../edicion/colocarElementos'
import {
  describirTipografia,
  TIPOGRAFIAS_DISPONIBLES,
} from '../edicion/tipografias'
import type {
  AlineacionTexto,
  ElementoSuperpuesto,
  FiguraGeometrica,
} from '../edicion/tipos'
import { CampoNumero } from './CampoNumero'
import { ControlDeslizante } from './ControlDeslizante'
import { GrupoOpciones, type OpcionElegible } from './GrupoOpciones'
import { IconoDuplicar, IconoPapelera } from './Iconos'
import { SelectorColor } from './SelectorColor'

interface PropiedadesPanelElemento {
  readonly elemento: ElementoSuperpuesto
  /** Número de páginas del documento, para poder cambiar de página. */
  readonly numeroPaginas: number
  readonly deshabilitado: boolean
  readonly alCambiar: (cambios: Partial<ElementoSuperpuesto>) => void
  readonly alQuitar: () => void
  readonly alDuplicar: () => void
  readonly alSubir: () => void
  readonly alBajar: () => void
}

/** Opciones de alineación del texto. */
const ALINEACIONES: readonly OpcionElegible<AlineacionTexto>[] = [
  { valor: 'izquierda', etiqueta: 'Izquierda' },
  { valor: 'centro', etiqueta: 'Centro' },
  { valor: 'derecha', etiqueta: 'Derecha' },
]

/** Opciones de figura. */
const FIGURAS: readonly OpcionElegible<FiguraGeometrica>[] = (
  ['rectangulo', 'elipse', 'linea', 'flecha'] as const
).map((figura) => ({ valor: figura, etiqueta: NOMBRE_FIGURA[figura] }))

/**
 * Propiedades del elemento seleccionado.
 *
 * Todo se ajusta con campos numéricos y controles nativos, además de poder arrastrar
 * en el lienzo. Es la parte que hace la herramienta usable con teclado y con lector de
 * pantalla, y también la que permite decir «exactamente al 25 %» en lugar de
 * aproximar con el ratón.
 */
export function PanelElemento({
  elemento,
  numeroPaginas,
  deshabilitado,
  alCambiar,
  alQuitar,
  alDuplicar,
  alSubir,
  alBajar,
}: PropiedadesPanelElemento) {
  return (
    <div className="panel-elemento">
      <div className="panel-elemento__encabezado">
        <h3 className="panel-elemento__titulo">{TITULO_CLASE[elemento.clase]}</h3>

        <div className="panel-elemento__acciones">
          <button
            className="boton boton--discreto boton--pequeno"
            type="button"
            disabled={deshabilitado}
            onClick={alBajar}
          >
            Enviar detrás
          </button>
          <button
            className="boton boton--discreto boton--pequeno"
            type="button"
            disabled={deshabilitado}
            onClick={alSubir}
          >
            Traer delante
          </button>
          <button
            className="boton-icono"
            type="button"
            disabled={deshabilitado}
            onClick={alDuplicar}
            aria-label="Duplicar este elemento"
          >
            <IconoDuplicar className="boton-icono__icono" />
          </button>
          <button
            className="boton-icono boton-icono--peligro"
            type="button"
            disabled={deshabilitado}
            onClick={alQuitar}
            aria-label="Quitar este elemento"
          >
            <IconoPapelera className="boton-icono__icono" />
          </button>
        </div>
      </div>

      {elemento.clase === 'texto' && (
        <>
          <div className="campo-texto-bloque">
            <label className="campo-texto-bloque__etiqueta" htmlFor="contenido-texto">
              Contenido
            </label>
            <textarea
              className="campo-area"
              id="contenido-texto"
              rows={3}
              value={elemento.texto}
              disabled={deshabilitado}
              onChange={(evento) => alCambiar({ texto: evento.target.value })}
            />
            <p className="campo-texto-bloque__ayuda">
              Se ajusta en líneas al ancho de la caja. Solo se pueden usar caracteres
              latinos: las tipografías estándar del PDF no cubren otros alfabetos.
            </p>
          </div>

          <div className="campo-texto-bloque">
            <label className="campo-texto-bloque__etiqueta" htmlFor="tipografia">
              Tipografía
            </label>
            <select
              className="campo-seleccion"
              id="tipografia"
              value={elemento.tipografia}
              disabled={deshabilitado}
              onChange={(evento) =>
                alCambiar({
                  tipografia: evento.target
                    .value as typeof elemento.tipografia,
                })
              }
            >
              {TIPOGRAFIAS_DISPONIBLES.map((clave) => (
                <option key={clave} value={clave}>
                  {describirTipografia(clave)}
                </option>
              ))}
            </select>
          </div>

          <CampoNumero
            etiqueta="Cuerpo"
            valor={elemento.tamano}
            minimo={TAMANO_TEXTO_MINIMO}
            maximo={TAMANO_TEXTO_MAXIMO}
            paso={1}
            unidad="pt"
            deshabilitado={deshabilitado}
            alCambiar={(tamano) => alCambiar({ tamano })}
          />

          <GrupoOpciones
            etiqueta="Alineación"
            opciones={ALINEACIONES}
            valor={elemento.alineacion}
            deshabilitado={deshabilitado}
            alCambiar={(alineacion) => alCambiar({ alineacion })}
          />

          <SelectorColor
            etiqueta="Color del texto"
            valor={elemento.color}
            deshabilitado={deshabilitado}
            alCambiar={(color) => alCambiar({ color })}
          />
        </>
      )}

      {elemento.clase === 'forma' && (
        <>
          <GrupoOpciones
            etiqueta="Figura"
            opciones={FIGURAS}
            valor={elemento.figura}
            deshabilitado={deshabilitado}
            alCambiar={(figura) => alCambiar({ figura })}
          />

          <label className="casilla">
            <input
              className="casilla__campo"
              type="checkbox"
              checked={elemento.relleno !== null}
              disabled={deshabilitado}
              onChange={(evento) =>
                alCambiar({ relleno: evento.target.checked ? '#c0d6f9' : null })
              }
            />
            <span className="casilla__texto">
              <span className="casilla__etiqueta">Rellenar la figura</span>
            </span>
          </label>

          {elemento.relleno !== null && (
            <SelectorColor
              etiqueta="Color de relleno"
              valor={elemento.relleno}
              deshabilitado={deshabilitado}
              alCambiar={(relleno) => alCambiar({ relleno })}
            />
          )}

          <label className="casilla">
            <input
              className="casilla__campo"
              type="checkbox"
              checked={elemento.borde !== null}
              disabled={deshabilitado}
              onChange={(evento) =>
                alCambiar({ borde: evento.target.checked ? '#1f2933' : null })
              }
            />
            <span className="casilla__texto">
              <span className="casilla__etiqueta">Dibujar el contorno</span>
              <span className="casilla__ayuda">
                Las líneas y las flechas necesitan contorno para verse.
              </span>
            </span>
          </label>

          {elemento.borde !== null && (
            <>
              <SelectorColor
                etiqueta="Color del contorno"
                valor={elemento.borde}
                deshabilitado={deshabilitado}
                alCambiar={(borde) => alCambiar({ borde })}
              />
              <CampoNumero
                etiqueta="Grosor del contorno"
                valor={elemento.grosorBorde}
                minimo={GROSOR_MINIMO}
                maximo={GROSOR_MAXIMO}
                paso={0.25}
                unidad="pt"
                deshabilitado={deshabilitado}
                alCambiar={(grosorBorde) => alCambiar({ grosorBorde })}
              />
            </>
          )}
        </>
      )}

      {elemento.clase === 'trazo' && (
        <>
          <SelectorColor
            etiqueta="Color del trazo"
            valor={elemento.color}
            deshabilitado={deshabilitado}
            alCambiar={(color) => alCambiar({ color })}
          />
          <CampoNumero
            etiqueta="Grosor del trazo"
            valor={elemento.grosor}
            minimo={GROSOR_MINIMO}
            maximo={GROSOR_MAXIMO}
            paso={0.25}
            unidad="pt"
            deshabilitado={deshabilitado}
            alCambiar={(grosor) => alCambiar({ grosor })}
          />
          <p className="panel-elemento__nota">
            El trazo no gira con el elemento: girar cada punto por separado daría un
            resultado distinto del de girar la caja, así que se deja como está.
          </p>
        </>
      )}

      {elemento.clase === 'resaltado' && (
        <SelectorColor
          etiqueta="Color del resaltado"
          valor={elemento.color}
          deshabilitado={deshabilitado}
          alCambiar={(color) => alCambiar({ color })}
        />
      )}

      {elemento.clase === 'imagen' && (
        <div className="campo-texto-bloque">
          <label className="campo-texto-bloque__etiqueta" htmlFor="descripcion-imagen">
            Descripción de la imagen
          </label>
          <input
            className="campo-texto"
            id="descripcion-imagen"
            type="text"
            value={elemento.descripcion}
            maxLength={120}
            disabled={deshabilitado}
            onChange={(evento) => alCambiar({ descripcion: evento.target.value })}
          />
          <p className="campo-texto-bloque__ayuda">
            Sirve para identificarla en la lista. No se guarda en el documento: pdf-lib
            no escribe texto alternativo de imágenes, y decir que sí sería falso.
          </p>
        </div>
      )}

      <fieldset className="panel-elemento__grupo">
        <legend className="panel-elemento__leyenda">Posición y tamaño</legend>

        <div className="rejilla-campos">
          <CampoNumero
            etiqueta="Desde la izquierda"
            valor={Math.round(elemento.izquierda * 1000) / 10}
            minimo={0}
            maximo={100}
            paso={0.1}
            unidad="%"
            deshabilitado={deshabilitado}
            alCambiar={(valor) => alCambiar({ izquierda: valor / 100 })}
          />
          <CampoNumero
            etiqueta="Desde arriba"
            valor={Math.round(elemento.superior * 1000) / 10}
            minimo={0}
            maximo={100}
            paso={0.1}
            unidad="%"
            deshabilitado={deshabilitado}
            alCambiar={(valor) => alCambiar({ superior: valor / 100 })}
          />
          <CampoNumero
            etiqueta="Ancho"
            valor={Math.round(elemento.ancho * 1000) / 10}
            minimo={0.5}
            maximo={100}
            paso={0.1}
            unidad="%"
            deshabilitado={deshabilitado}
            alCambiar={(valor) => alCambiar({ ancho: valor / 100 })}
          />
          <CampoNumero
            etiqueta="Alto"
            valor={Math.round(elemento.alto * 1000) / 10}
            minimo={0.5}
            maximo={100}
            paso={0.1}
            unidad="%"
            deshabilitado={deshabilitado}
            alCambiar={(valor) => alCambiar({ alto: valor / 100 })}
          />
        </div>

        {numeroPaginas > 1 && (
          <CampoNumero
            etiqueta="Página"
            valor={elemento.pagina}
            minimo={1}
            maximo={numeroPaginas}
            paso={1}
            deshabilitado={deshabilitado}
            alCambiar={(pagina) => alCambiar({ pagina })}
            ayuda="Cambia el elemento a otra página del documento."
          />
        )}

        <ControlDeslizante
          etiqueta="Giro"
          valor={elemento.giro}
          minimo={0}
          maximo={359}
          paso={1}
          valorLegible={`${Math.round(elemento.giro)} grados`}
          deshabilitado={deshabilitado}
          alCambiar={(giro) => alCambiar({ giro })}
        />

        <ControlDeslizante
          etiqueta="Opacidad"
          valor={Math.round(elemento.opacidad * 100)}
          minimo={0}
          maximo={100}
          paso={1}
          valorLegible={`${Math.round(elemento.opacidad * 100)} por ciento`}
          deshabilitado={deshabilitado}
          alCambiar={(valor) => alCambiar({ opacidad: valor / 100 })}
        />
      </fieldset>
    </div>
  )
}

/** Título del panel según la clase del elemento. */
const TITULO_CLASE = {
  texto: 'Texto',
  imagen: 'Imagen',
  trazo: 'Dibujo a mano alzada',
  forma: 'Forma',
  resaltado: 'Resaltado',
} as const
