import { AvisoSeguridad } from '../../componentes/AvisoSeguridad'
import { CampoNumero } from '../../componentes/CampoNumero'
import { ControlDeslizante } from '../../componentes/ControlDeslizante'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import {
  GrupoOpciones,
  type OpcionElegible,
} from '../../componentes/GrupoOpciones'
import {
  IconoAlerta,
  IconoDescargar,
  IconoDetener,
  IconoFlechaIzquierda,
  IconoFlechaDerecha,
  IconoRestablecer,
  IconoVerificado,
} from '../../componentes/Iconos'
import { VisorComparacion } from '../../componentes/VisorComparacion'
import { ZonaArrastrePdf } from '../../componentes/ZonaArrastrePdf'
import {
  describirGeometria,
  resumirDiferencias,
} from '../../comparacion/compararContenido'
import { resumirComparacion } from '../../comparacion/compararDocumentos'
import {
  describirEstadoPagina,
  UMBRAL_MAXIMO,
  UMBRAL_MINIMO,
} from '../../comparacion/tipos'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import {
  describirModoVista,
  useCompararPdf,
  type ModoVista,
} from './useCompararPdf'

/** Modos de vista que se ofrecen. */
const MODOS: readonly OpcionElegible<ModoVista>[] = (
  ['lado-a-lado', 'superpuesto'] as const
).map((modo) => ({
  valor: modo,
  etiqueta: describirModoVista(modo),
  descripcion:
    modo === 'lado-a-lado'
      ? 'Las dos versiones una junto a otra.'
      : 'Una encima de la otra, con opacidad ajustable para ver qué se mueve.',
}))

/** Interfaz de la herramienta «Comparar PDF». */
export function HerramientaCompararPdf() {
  const {
    antes,
    despues,
    umbral,
    compararVisualmente,
    modoVista,
    opacidad,
    paginaActiva,
    comparando,
    progreso,
    resultado,
    cancelado,
    bloqueado,
    mensajeError,
    puedeComparar,
    paginasConDiferencias,
    seleccionarArchivos,
    cambiarUmbral,
    cambiarCompararVisualmente,
    cambiarModoVista,
    cambiarOpacidad,
    cambiarPaginaActiva,
    irADiferenciaAnterior,
    irADiferenciaSiguiente,
    comparar,
    cancelar,
    descargarInforme,
    restablecer,
  } = useCompararPdf()

  const paginaComparada =
    resultado?.paginas.find((pagina) => pagina.numero === paginaActiva) ?? null

  const totalPaginas = Math.max(
    resultado?.paginasAntes ?? 0,
    resultado?.paginasDespues ?? 0,
  )

  return (
    <div className="herramienta__cuerpo">
      <AvisoSeguridad titulo="Qué compara, y qué no puede concluir">
        <p className="aviso-informativo__texto">
          Compara <strong>dos cosas distintas</strong>. El{' '}
          <strong>texto extraíble</strong>, que es la comparación fiable: dos documentos
          con el mismo texto dicen lo mismo. Y los <strong>píxeles</strong> de cada
          página, que detectan lo que el texto no ve —una imagen cambiada, un sello
          movido, otro color—.
        </p>
        <p className="aviso-informativo__texto">
          <strong>Una diferencia visual no implica una diferencia de contenido.</strong>{' '}
          Cambiar de tipografía altera todos los píxeles sin cambiar una sola palabra.
          Por eso las dos cosas se muestran por separado y no se mezclan en un
          veredicto único.
        </p>
        <p className="aviso-informativo__texto">
          Los dos documentos se procesan en tu navegador y no se modifica ninguno.
        </p>
      </AvisoSeguridad>

      <div className="comparar__entradas">
        <div className="comparar__entrada">
          <h3 className="comparar__titulo">Primer documento</h3>
          <ZonaArrastrePdf
            alSeleccionarArchivos={seleccionarArchivos('antes')}
            deshabilitado={bloqueado}
            titulo="Versión original"
            ayuda="El documento con el que comparar."
            nombreAccesible="Elegir el primer documento"
          />
          {antes !== null && (
            <p className="comparar__archivo">
              {antes.nombre} · {formatearTamanoArchivo(antes.tamano)}
            </p>
          )}
        </div>

        <div className="comparar__entrada">
          <h3 className="comparar__titulo">Segundo documento</h3>
          <ZonaArrastrePdf
            alSeleccionarArchivos={seleccionarArchivos('despues')}
            deshabilitado={bloqueado}
            titulo="Versión nueva"
            ayuda="El documento que quieres revisar."
            nombreAccesible="Elegir el segundo documento"
          />
          {despues !== null && (
            <p className="comparar__archivo">
              {despues.nombre} · {formatearTamanoArchivo(despues.tamano)}
            </p>
          )}
        </div>
      </div>

      <fieldset className="permisos-pdf__grupo">
        <legend className="permisos-pdf__titulo">Cómo comparar</legend>

        <label className="casilla">
          <input
            className="casilla__campo"
            type="checkbox"
            checked={compararVisualmente}
            disabled={bloqueado}
            onChange={(evento) =>
              cambiarCompararVisualmente(evento.target.checked)
            }
          />
          <span className="casilla__texto">
            <span className="casilla__etiqueta">
              Comparar también la apariencia de cada página
            </span>
            <span className="casilla__ayuda">
              Dibuja las dos versiones y cuenta los píxeles que cambian. Detecta
              cambios que el texto no ve, pero tarda más.
            </span>
          </span>
        </label>

        {compararVisualmente && (
          <ControlDeslizante
            etiqueta="Umbral de diferencia visual"
            valor={Math.round(umbral * 1000)}
            minimo={Math.round(UMBRAL_MINIMO * 1000)}
            maximo={Math.round(UMBRAL_MAXIMO * 1000)}
            paso={1}
            valorLegible={`${(umbral * 100).toFixed(1)} por ciento de los píxeles`}
            deshabilitado={bloqueado}
            alCambiar={(valor) => cambiarUmbral(valor / 1000)}
            ayuda="Por debajo de este porcentaje, una diferencia visual se considera ruido del dibujado y no se señala."
          />
        )}
      </fieldset>

      <div className="herramienta__acciones">
        <button
          className="boton boton--primario"
          type="button"
          disabled={!puedeComparar}
          onClick={comparar}
        >
          <IconoVerificado className="boton__icono" />
          {comparando ? 'Comparando…' : 'Comparar los documentos'}
        </button>

        {comparando && (
          <button
            className="boton boton--secundario"
            type="button"
            onClick={cancelar}
          >
            <IconoDetener className="boton__icono" />
            Cancelar
          </button>
        )}

        <button
          className="boton boton--discreto"
          type="button"
          disabled={bloqueado}
          onClick={restablecer}
        >
          <IconoRestablecer className="boton__icono" />
          Empezar de nuevo
        </button>

        {resultado !== null && (
          <button
            className="boton boton--secundario"
            type="button"
            onClick={descargarInforme}
          >
            <IconoDescargar className="boton__icono" />
            Descargar el informe
          </button>
        )}
      </div>

      {!puedeComparar && !comparando && (antes === null || despues === null) && (
        <p className="herramienta__requisito">
          Elige los dos documentos para poder compararlos.
        </p>
      )}

      {progreso !== null && (
        <div className="progreso-etapas">
          <p className="progreso-etapas__texto" aria-live="polite">
            Comparando la página {progreso.paginasComparadas} de {progreso.total}.
          </p>
          <div className="progreso">
            <div
              className="progreso__barra"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progreso.total}
              aria-valuenow={progreso.paginasComparadas}
              aria-valuetext={`${progreso.paginasComparadas} de ${progreso.total} páginas comparadas`}
            >
              <span
                className="progreso__relleno"
                style={{
                  width: `${(progreso.paginasComparadas / progreso.total) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {resultado !== null && (
        <>
          <section className="diagnostico">
            <h3 className="diagnostico__titulo">Resumen</h3>

            <p
              className={`diagnostico__estado${
                resultado.sonIdenticos
                  ? ' diagnostico__estado--correcto'
                  : ' diagnostico__estado--alerta'
              }`}
            >
              {resultado.sonIdenticos ? (
                <IconoVerificado className="diagnostico__icono" />
              ) : (
                <IconoAlerta className="diagnostico__icono" />
              )}
              {resultado.sonIdenticos
                ? 'No se han encontrado diferencias'
                : 'Se han encontrado diferencias'}
            </p>

            <p className="diagnostico__explicacion">
              {resumirComparacion(resultado)}
            </p>

            <ul className="lista-datos">
              <li className="lista-datos__elemento">
                <span className="lista-datos__clave">Sin cambios</span>
                <span className="lista-datos__valor">
                  {resultado.recuento.identicas}
                </span>
              </li>
              <li className="lista-datos__elemento">
                <span className="lista-datos__clave">Modificadas</span>
                <span className="lista-datos__valor">
                  {resultado.recuento.modificadas}
                </span>
              </li>
              <li className="lista-datos__elemento">
                <span className="lista-datos__clave">Añadidas</span>
                <span className="lista-datos__valor">
                  {resultado.recuento.anadidas}
                </span>
              </li>
              <li className="lista-datos__elemento">
                <span className="lista-datos__clave">Eliminadas</span>
                <span className="lista-datos__valor">
                  {resultado.recuento.eliminadas}
                </span>
              </li>
            </ul>

            {resultado.metadatos.length > 0 && (
              <>
                <h4 className="diagnostico__subtitulo">Metadatos que cambian</h4>
                <ul className="lista-datos">
                  {resultado.metadatos.map((diferencia) => (
                    <li className="lista-datos__elemento" key={diferencia.clave}>
                      <span className="lista-datos__clave">
                        {diferencia.clave}
                      </span>
                      <span className="lista-datos__valor">
                        {diferencia.antes === '' ? '(vacío)' : diferencia.antes} →{' '}
                        {diferencia.despues === ''
                          ? '(vacío)'
                          : diferencia.despues}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <div className="comparar__navegacion">
            <CampoNumero
              etiqueta="Página"
              valor={paginaActiva}
              minimo={1}
              maximo={Math.max(1, totalPaginas)}
              paso={1}
              deshabilitado={bloqueado}
              alCambiar={cambiarPaginaActiva}
              ayuda={
                paginasConDiferencias.length === 0
                  ? 'Ninguna página presenta diferencias.'
                  : `Páginas con diferencias: ${paginasConDiferencias.join(', ')}.`
              }
            />

            <div className="grupo-botones">
              <button
                className="boton boton--secundario"
                type="button"
                disabled={
                  paginasConDiferencias.filter(
                    (numero) => numero < paginaActiva,
                  ).length === 0
                }
                onClick={irADiferenciaAnterior}
              >
                <IconoFlechaIzquierda className="boton__icono" />
                Diferencia anterior
              </button>

              <button
                className="boton boton--secundario"
                type="button"
                disabled={
                  paginasConDiferencias.filter(
                    (numero) => numero > paginaActiva,
                  ).length === 0
                }
                onClick={irADiferenciaSiguiente}
              >
                Diferencia siguiente
                <IconoFlechaDerecha className="boton__icono" />
              </button>
            </div>
          </div>

          {paginaComparada !== null && (
            <section className="diagnostico">
              <h3 className="diagnostico__titulo">
                Página {paginaComparada.numero} ·{' '}
                <span className="etiqueta-dato">
                  {describirEstadoPagina(paginaComparada.estado)}
                </span>
              </h3>

              <p className="diagnostico__explicacion">
                {paginaComparada.estado === 'anadida' ||
                paginaComparada.estado === 'eliminada'
                  ? `Esta página solo existe en ${
                      paginaComparada.estado === 'anadida'
                        ? 'el segundo'
                        : 'el primer'
                    } documento.`
                  : resumirDiferencias(
                      paginaComparada.texto,
                      paginaComparada.visual,
                      paginaComparada.geometriaDistinta,
                    )}
              </p>

              {paginaComparada.geometriaDistinta &&
                paginaComparada.geometriaAntes !== null &&
                paginaComparada.geometriaDespues !== null && (
                  <ul className="lista-datos">
                    <li className="lista-datos__elemento">
                      <span className="lista-datos__clave">Antes</span>
                      <span className="lista-datos__valor">
                        {describirGeometria(paginaComparada.geometriaAntes)}
                      </span>
                    </li>
                    <li className="lista-datos__elemento">
                      <span className="lista-datos__clave">Después</span>
                      <span className="lista-datos__valor">
                        {describirGeometria(paginaComparada.geometriaDespues)}
                      </span>
                    </li>
                  </ul>
                )}

              {paginaComparada.texto !== null &&
                !paginaComparada.texto.identico && (
                  <div className="comparar__palabras">
                    {paginaComparada.texto.eliminadas.length > 0 && (
                      <div>
                        <h4 className="diagnostico__subtitulo">
                          Palabras eliminadas (
                          {paginaComparada.texto.eliminadas.length})
                        </h4>
                        <ul className="lista-palabras">
                          {paginaComparada.texto.eliminadas
                            .slice(0, 40)
                            .map((palabra, indice) => (
                              <li
                                className="lista-palabras__elemento lista-palabras__elemento--eliminada"
                                key={`${palabra}-${indice}`}
                              >
                                {palabra}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}

                    {paginaComparada.texto.anadidas.length > 0 && (
                      <div>
                        <h4 className="diagnostico__subtitulo">
                          Palabras añadidas (
                          {paginaComparada.texto.anadidas.length})
                        </h4>
                        <ul className="lista-palabras">
                          {paginaComparada.texto.anadidas
                            .slice(0, 40)
                            .map((palabra, indice) => (
                              <li
                                className="lista-palabras__elemento lista-palabras__elemento--anadida"
                                key={`${palabra}-${indice}`}
                              >
                                {palabra}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
            </section>
          )}

          {antes !== null && despues !== null && (
            <>
              <GrupoOpciones
                etiqueta="Cómo ver las páginas"
                opciones={MODOS}
                valor={modoVista}
                deshabilitado={false}
                alCambiar={cambiarModoVista}
                enColumna
              />

              {modoVista === 'superpuesto' && (
                <ControlDeslizante
                  etiqueta="Opacidad de la versión nueva"
                  valor={Math.round(opacidad * 100)}
                  minimo={0}
                  maximo={100}
                  paso={1}
                  valorLegible={`${Math.round(opacidad * 100)} por ciento`}
                  deshabilitado={false}
                  alCambiar={(valor) => cambiarOpacidad(valor / 100)}
                  ayuda="Muévelo para ver qué cambia entre las dos versiones."
                />
              )}

              <div
                className={
                  modoVista === 'lado-a-lado'
                    ? 'comparar__vistas'
                    : 'comparar__vistas comparar__vistas--superpuestas'
                }
              >
                {paginaActiva <= resultado.paginasAntes && (
                  <VisorComparacion
                    archivo={antes.archivo}
                    numeroPagina={paginaActiva}
                    etiqueta="Primer documento"
                  />
                )}

                {paginaActiva <= resultado.paginasDespues && (
                  <VisorComparacion
                    archivo={despues.archivo}
                    numeroPagina={paginaActiva}
                    etiqueta="Segundo documento"
                    zonas={paginaComparada?.visual?.zonas ?? []}
                    opacidad={modoVista === 'superpuesto' ? opacidad : 1}
                  />
                )}
              </div>
            </>
          )}
        </>
      )}

      <EstadoProcesamiento
        textoProceso={comparando ? 'Comparando los documentos.' : null}
        textoExito={
          resultado !== null
            ? 'Comparación terminada. Puedes descargar el informe o navegar entre las diferencias.'
            : null
        }
        textoAviso={
          cancelado
            ? 'La comparación se canceló. No se modificó ningún documento.'
            : null
        }
        textoError={mensajeError}
      />
    </div>
  )
}
