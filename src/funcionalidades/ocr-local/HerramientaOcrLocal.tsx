import { useId } from 'react'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import { GrupoOpciones } from '../../componentes/GrupoOpciones'
import {
  IconoBuscar,
  IconoDescargar,
  IconoDetener,
  IconoPapelera,
  IconoRestablecer,
} from '../../componentes/Iconos'
import type { IdiomaOcr } from '../../ocr/motorOcr'
import { useOcrLocal } from './useOcrLocal'

const OPCIONES_IDIOMA = [
  { valor: 'espanol', etiqueta: 'Español' },
  { valor: 'ingles', etiqueta: 'Inglés' },
  { valor: 'espanol-ingles', etiqueta: 'Español e inglés' },
] as const

/** Interfaz de reconocimiento óptico completamente local. */
export function HerramientaOcrLocal() {
  const control = useOcrLocal()
  const idArchivo = useId()

  const progreso = control.progreso
  const textoProceso =
    control.procesando && progreso !== null
      ? `${progreso.estadoMotor}: ${progreso.origen}, ${progreso.actual} de ${progreso.total}.`
      : control.procesando
        ? 'Cargando el motor OCR y los datos de idioma locales…'
        : null

  return (
    <div className="herramienta">
      <div className="herramienta__introduccion">
        <h2 className="herramienta__titulo">
          <IconoBuscar className="herramienta__titulo-icono" />
          OCR local
        </h2>
        <p className="herramienta__descripcion">
          Reconoce texto impreso en imágenes JPEG, PNG y WebP, o en las páginas
          de un PDF escaneado. Tesseract.js y los idiomas se sirven desde Free
          PDF y trabajan dentro de un Web Worker.
        </p>
      </div>

      <aside className="aviso aviso--importante">
        <strong>El OCR no es exacto.</strong> La calidad, el giro, la resolución,
        la tipografía y el ruido cambian el resultado. Puede tardar y consumir
        bastante memoria, especialmente con PDF largos. Revisa siempre el texto.
      </aside>

      <section className="herramienta__seccion">
        <h3 className="herramienta__subtitulo">Archivos de entrada</h3>
        <div className="selector-archivo">
          <input
            className="selector-archivo__campo"
            id={idArchivo}
            type="file"
            multiple
            accept="application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            disabled={control.procesando}
            onChange={(evento) => {
              if (evento.target.files !== null) {
                control.seleccionar(Array.from(evento.target.files))
              }
              evento.target.value = ''
            }}
          />
          <label className="boton boton--secundario" htmlFor={idArchivo}>
            Seleccionar imágenes o un PDF
          </label>
        </div>

        {control.archivos.length > 0 && (
          <ul className="ocr__archivos">
            {control.archivos.map((archivo, indice) => (
              <li className="ocr__archivo" key={`${archivo.name}-${archivo.lastModified}`}>
                <span>{archivo.name}</span>
                <button
                  className="boton boton--discreto"
                  type="button"
                  disabled={control.procesando}
                  aria-label={`Quitar ${archivo.name}`}
                  onClick={() => control.quitar(indice)}
                >
                  <IconoPapelera className="boton__icono" />
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <GrupoOpciones<IdiomaOcr>
        etiqueta="Idioma del texto"
        opciones={OPCIONES_IDIOMA}
        valor={control.idioma}
        deshabilitado={control.procesando}
        alCambiar={control.cambiarIdioma}
        ayuda="Elegir dos idiomas carga ambos modelos y usa más memoria."
      />

      <div className="herramienta__acciones">
        <button
          className="boton boton--primario"
          type="button"
          disabled={control.archivos.length === 0 || control.procesando}
          onClick={control.reconocer}
        >
          <IconoBuscar className="boton__icono" />
          {control.procesando ? 'Reconociendo…' : 'Reconocer texto'}
        </button>
        {control.procesando && (
          <button
            className="boton boton--peligro"
            type="button"
            onClick={control.cancelar}
          >
            <IconoDetener className="boton__icono" />
            Cancelar y destruir el trabajador
          </button>
        )}
        {control.archivos.length > 0 && !control.procesando && (
          <button
            className="boton boton--discreto"
            type="button"
            onClick={control.restablecer}
          >
            <IconoRestablecer className="boton__icono" />
            Empezar de nuevo
          </button>
        )}
      </div>

      {progreso !== null && control.procesando && (
        <div className="ocr__progreso">
          <progress max={progreso.total} value={progreso.completadas + progreso.progresoPagina}>
            {progreso.completadas + progreso.progresoPagina} de {progreso.total}
          </progress>
          <p>
            Progreso de esta página: {Math.round(progreso.progresoPagina * 100)} %
          </p>
        </div>
      )}

      {control.resultado !== null && (
        <section className="herramienta__seccion">
          <h3 className="herramienta__subtitulo">Vista previa editable</h3>
          {control.resultado.contieneTexto ? (
            <>
              <label className="editor-markdown__etiqueta" htmlFor="texto-ocr">
                Texto reconocido
              </label>
              <textarea
                className="editor-markdown"
                id="texto-ocr"
                value={control.contenido}
                spellCheck
                onChange={(evento) =>
                  control.cambiarContenido(evento.target.value)
                }
              />
              <div className="herramienta__acciones">
                <button
                  className="boton boton--secundario"
                  type="button"
                  onClick={control.descargarTxt}
                >
                  <IconoDescargar className="boton__icono" />
                  Descargar TXT
                </button>
                <button
                  className="boton boton--primario"
                  type="button"
                  onClick={control.descargarMarkdown}
                >
                  <IconoDescargar className="boton__icono" />
                  Descargar Markdown
                </button>
              </div>
            </>
          ) : (
            <aside className="aviso aviso--importante">
              No se detectó texto. La imagen puede estar vacía, tener poca
              resolución o necesitar otro idioma.
            </aside>
          )}
        </section>
      )}

      <aside className="aviso aviso--neutro">
        <strong>PDF buscable no disponible.</strong> Free PDF no genera uno:
        colocar una capa de texto sin verificar su alineación produciría un
        documento engañoso. Las salidas verificadas son TXT y Markdown.
      </aside>

      <EstadoProcesamiento
        textoProceso={textoProceso}
        textoExito={
          control.resultado?.contieneTexto === true
            ? 'Reconocimiento terminado. Revisa el texto antes de descargarlo.'
            : null
        }
        textoAviso={
          control.mensajeAviso ??
          (control.cancelado
            ? 'El reconocimiento se canceló y el trabajador fue destruido.'
            : null)
        }
        textoError={control.mensajeError}
      />
    </div>
  )
}
