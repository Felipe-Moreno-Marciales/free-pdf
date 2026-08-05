import { useState } from 'react'
import { CargadorDocumentoPdf } from '../../componentes/CargadorDocumentoPdf'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import {
  IconoDescargar,
  IconoDetener,
  IconoTexto,
} from '../../componentes/Iconos'
import { SelectorRangoPaginas } from '../../componentes/SelectorRangoPaginas'
import { useDocumentoPdf } from '../../ganchos/useDocumentoPdf'
import { usePdfAMarkdown } from './usePdfAMarkdown'

/** Interfaz de extracción local de PDF a Markdown. */
export function HerramientaPdfAMarkdown() {
  const carga = useDocumentoPdf()
  const proceso = usePdfAMarkdown(carga.documento)
  const [mensajeCopia, establecerMensajeCopia] = useState<string | null>(null)

  const textoProceso =
    proceso.procesando && proceso.progreso !== null
      ? `Extrayendo la página ${proceso.progreso.pagina}: ${proceso.progreso.completadas} de ${proceso.progreso.total} terminadas.`
      : proceso.procesando
        ? 'Preparando la extracción…'
        : null

  return (
    <div className="herramienta">
      <div className="herramienta__introduccion">
        <h2 className="herramienta__titulo">
          <IconoTexto className="herramienta__titulo-icono" />
          PDF a Markdown
        </h2>
        <p className="herramienta__descripcion">
          Extrae la capa de texto con PDF.js y reconstruye encabezados,
          párrafos, listas, citas, enlaces y tablas sencillas sin enviar el
          documento a ningún sitio.
        </p>
      </div>

      <aside className="aviso aviso--importante">
        <strong>La estructura es aproximada.</strong> Un PDF guarda posiciones
        de dibujo, no párrafos ni tablas. Los documentos con columnas y las
        tablas complejas pueden quedar desordenados.
      </aside>

      <CargadorDocumentoPdf
        documento={carga.documento}
        deshabilitado={proceso.procesando}
        alSeleccionarArchivos={carga.seleccionarArchivos}
        alRestablecer={() => {
          proceso.limpiar()
          carga.restablecer()
        }}
      />

      {carga.documento !== null && (
        <>
          <section className="herramienta__seccion">
            <h3 className="herramienta__subtitulo">Páginas y formato</h3>
            <SelectorRangoPaginas
              alcance={proceso.alcance}
              expresion={proceso.expresion}
              numeroPaginas={carga.documento.numeroPaginas}
              indicesAfectados={proceso.indices}
              mensajeError={proceso.mensajeRango}
              deshabilitado={proceso.procesando}
              alCambiarAlcance={proceso.cambiarAlcance}
              alCambiarExpresion={proceso.cambiarExpresion}
            />

            <div className="opciones-marcables">
              <label className="opcion-marcable">
                <input
                  type="checkbox"
                  checked={proceso.separadoresPagina}
                  disabled={proceso.procesando}
                  onChange={(evento) =>
                    proceso.cambiarSeparadores(evento.target.checked)
                  }
                />
                <span>Mantener separadores horizontales entre páginas</span>
              </label>
              <label className="opcion-marcable">
                <input
                  type="checkbox"
                  checked={proceso.conservarSaltosLinea}
                  disabled={proceso.procesando}
                  onChange={(evento) =>
                    proceso.cambiarSaltosLinea(evento.target.checked)
                  }
                />
                <span>Conservar los saltos de línea dentro de los párrafos</span>
              </label>
            </div>
          </section>

          <div className="herramienta__acciones">
            <button
              className="boton boton--primario"
              type="button"
              disabled={!proceso.puedeConvertir}
              onClick={proceso.convertir}
            >
              <IconoTexto className="boton__icono" />
              {proceso.procesando ? 'Extrayendo…' : 'Extraer a Markdown'}
            </button>
            {proceso.procesando && (
              <button
                className="boton boton--peligro"
                type="button"
                onClick={proceso.cancelar}
              >
                <IconoDetener className="boton__icono" />
                Cancelar
              </button>
            )}
          </div>
        </>
      )}

      {proceso.progreso !== null && proceso.procesando && (
        <progress
          className="progreso"
          max={proceso.progreso.total}
          value={proceso.progreso.completadas}
        >
          {proceso.progreso.completadas} de {proceso.progreso.total}
        </progress>
      )}

      {proceso.contieneTexto === false && (
        <aside className="aviso aviso--importante">
          <strong>El documento no contiene una capa de texto.</strong> Necesita
          reconocimiento OCR. Puedes abrir la herramienta «OCR local» desde el
          catálogo.
        </aside>
      )}

      {proceso.contieneTexto === true && (
        <section className="herramienta__seccion">
          <h3 className="herramienta__subtitulo">Vista previa editable</h3>
          <label className="editor-markdown__etiqueta" htmlFor="markdown-editable">
            Contenido Markdown
          </label>
          <textarea
            className="editor-markdown"
            id="markdown-editable"
            value={proceso.contenido}
            spellCheck
            onChange={(evento) => proceso.cambiarContenido(evento.target.value)}
          />
          <div className="herramienta__acciones">
            <button
              className="boton boton--secundario"
              type="button"
              onClick={() => {
                void proceso.copiar().then((copiado) =>
                  establecerMensajeCopia(
                    copiado
                      ? 'Markdown copiado al portapapeles.'
                      : 'El navegador no permitió copiar. Selecciona el texto manualmente.',
                  ),
                )
              }}
            >
              <IconoTexto className="boton__icono" />
              Copiar
            </button>
            <button
              className="boton boton--primario"
              type="button"
              disabled={proceso.contenido === ''}
              onClick={proceso.descargar}
            >
              <IconoDescargar className="boton__icono" />
              Descargar free-pdf.md
            </button>
          </div>
        </section>
      )}

      <EstadoProcesamiento
        textoProceso={textoProceso}
        textoExito={
          proceso.contieneTexto === true
            ? 'Extracción terminada. Revisa y edita el resultado antes de descargarlo.'
            : null
        }
        textoAviso={
          carga.mensajeAviso ??
          mensajeCopia ??
          (proceso.cancelado ? 'La extracción se canceló.' : null)
        }
        textoError={carga.mensajeError ?? proceso.mensajeError}
      />
    </div>
  )
}
