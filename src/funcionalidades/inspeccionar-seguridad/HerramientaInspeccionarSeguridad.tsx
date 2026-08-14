import { useEffect, useRef } from 'react'
import { AvisoSeguridad } from '../../componentes/AvisoSeguridad'
import { DetallesTecnicos } from '../../componentes/DetallesTecnicos'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import {
  IconoAlerta,
  IconoArchivoPdf,
  IconoRestablecer,
  IconoVerificado,
} from '../../componentes/Iconos'
import { ZonaArrastrePdf } from '../../componentes/ZonaArrastrePdf'
import type {
  ArchivoIncrustadoSeguridad,
  HallazgoSeguridad,
  InformeSeguridadPdf,
  NivelRiesgo,
} from '../../seguridad/inspeccion/tipos'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import { useInspeccionarSeguridad } from './useInspeccionarSeguridad'

interface PresentacionNivel {
  readonly titulo: string
  readonly explicacion: string
}

const PRESENTACION_NIVELES: Readonly<Record<NivelRiesgo, PresentacionNivel>> = {
  'sin-indicios': {
    titulo: 'Sin indicadores estructurales relevantes',
    explicacion:
      'No se encontraron las características estructurales que busca esta primera versión del inspector.',
  },
  bajo: {
    titulo: 'Características de riesgo bajo',
    explicacion:
      'Se encontraron características comunes que conviene conocer, pero que no indican por sí mismas que el documento sea peligroso.',
  },
  precaucion: {
    titulo: 'Requiere precaución',
    explicacion:
      'Se encontraron características activas o sensibles que conviene revisar antes de confiar en el documento.',
  },
  elevado: {
    titulo: 'Riesgo estructural elevado',
    explicacion:
      'Se encontraron características especialmente sensibles o combinaciones que pueden activar acciones automáticamente.',
  },
}

const ETIQUETAS_SEVERIDAD = {
  informativa: 'Informativa',
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
} as const

/** Interfaz del inspector estructural de seguridad. */
export function HerramientaInspeccionarSeguridad() {
  const {
    documento,
    informe,
    estado,
    bloqueado,
    mensajeError,
    mensajeAviso,
    seleccionarArchivos,
    restablecer,
  } = useInspeccionarSeguridad()
  const referenciaSelector = useRef<HTMLInputElement>(null)
  const referenciaRestablecer = useRef<HTMLButtonElement>(null)
  const tuvoDocumento = useRef(false)

  useEffect(() => {
    if (documento !== null) {
      tuvoDocumento.current = true
      referenciaRestablecer.current?.focus()
      return
    }

    if (tuvoDocumento.current) {
      tuvoDocumento.current = false
      referenciaSelector.current?.focus()
    }
  }, [documento])

  return (
    <div className="herramienta__cuerpo">
      <AvisoSeguridad titulo="Qué analiza este inspector">
        <p className="aviso-informativo__texto">
          Revisa la estructura interna del PDF para señalar JavaScript, acciones
          automáticas, enlaces, formularios, contenido multimedia y archivos
          incrustados. <strong>Solo interpreta la estructura:</strong> no ejecuta
          JavaScript ni acciones, no abre enlaces y no extrae ni abre adjuntos.
        </p>
        <p className="aviso-informativo__texto">
          Todo el análisis ocurre en tu navegador. El documento no se sube, no se
          almacena y no se envía a ningún servicio externo.
        </p>
        <p className="aviso-informativo__texto">
          Este análisis estructural no sustituye a un antivirus y no puede garantizar
          que un archivo sea seguro. La presencia de una característica tampoco
          significa necesariamente que el documento sea malicioso.
        </p>
      </AvisoSeguridad>

      {documento === null ? (
        <ZonaArrastrePdf
          alSeleccionarArchivos={seleccionarArchivos}
          deshabilitado={bloqueado}
          permitirVarios={false}
          titulo="Arrastra el PDF que quieres inspeccionar o pulsa para seleccionarlo"
          ayuda="Se analiza un documento a la vez y permanece siempre en tu dispositivo."
          nombreAccesible="Seleccionar el PDF que se va a inspeccionar"
          referenciaCampo={referenciaSelector}
        />
      ) : (
        <>
          <div className="documento-cargado">
            <IconoArchivoPdf className="documento-cargado__icono" />
            <div className="documento-cargado__datos">
              <p className="documento-cargado__nombre">{documento.nombre}</p>
              <p className="documento-cargado__detalle">
                {formatearTamanoArchivo(documento.tamano)}
                {informe?.numeroPaginas !== null &&
                  informe?.numeroPaginas !== undefined && (
                    <>
                      {' · '}
                      {informe.numeroPaginas}{' '}
                      {informe.numeroPaginas === 1 ? 'página' : 'páginas'}
                    </>
                  )}
              </p>
            </div>
            <div className="documento-cargado__acciones">
              <button
                ref={referenciaRestablecer}
                className="boton boton--discreto"
                type="button"
                onClick={restablecer}
              >
                <IconoRestablecer className="boton__icono" />
                {bloqueado ? 'Cancelar y empezar de nuevo' : 'Empezar de nuevo'}
              </button>
            </div>
          </div>

          {estado === 'cifrado' && <AvisoDocumentoCifrado />}

          {estado === 'completado' && informe !== null && (
            <ResultadoInspeccion informe={informe} />
          )}
        </>
      )}

      <EstadoProcesamiento
        textoProceso={
          estado === 'analizando'
            ? 'Analizando la estructura del documento…'
            : null
        }
        textoExito={
          estado === 'completado' && informe !== null
            ? `Análisis terminado. ${PRESENTACION_NIVELES[informe.nivel].titulo}.`
            : null
        }
        textoAviso={
          estado === 'cifrado'
            ? 'No se pudo completar la inspección porque el documento está cifrado. Desbloquéalo primero con «Desbloquear PDF».'
            : mensajeAviso
        }
        textoError={mensajeError}
      />
    </div>
  )
}

/** Explica por qué un documento cifrado no recibe una clasificación parcial. */
function AvisoDocumentoCifrado() {
  return (
    <AvisoSeguridad
      titulo="El documento está cifrado"
      tono="advertencia"
    >
      <p className="aviso-informativo__texto">
        No se pudo realizar una inspección completa porque el documento está
        cifrado. Para evitar una conclusión incompleta, no se muestra ningún nivel
        de riesgo ni un resultado parcial.
      </p>
      <p className="aviso-informativo__texto">
        Desbloquéalo primero con «Desbloquear PDF» y vuelve a analizar el documento
        resultante.
      </p>
    </AvisoSeguridad>
  )
}

/** Presenta el resumen comprensible y los datos técnicos del informe. */
function ResultadoInspeccion({
  informe,
}: {
  readonly informe: InformeSeguridadPdf
}) {
  const presentacion = PRESENTACION_NIVELES[informe.nivel]
  const IconoNivel =
    informe.nivel === 'sin-indicios' ? IconoVerificado : IconoAlerta

  return (
    <section
      className="informe-seguridad"
      data-nivel={informe.nivel}
      aria-labelledby="informe-seguridad-titulo"
    >
      <h3 className="informe-seguridad__titulo" id="informe-seguridad-titulo">
        Resultado del análisis
      </h3>

      <div className="informe-seguridad__nivel">
        <IconoNivel className="informe-seguridad__icono" />
        <div>
          <p className="informe-seguridad__nivel-titulo">{presentacion.titulo}</p>
          <p className="informe-seguridad__explicacion">
            {presentacion.explicacion}
          </p>
        </div>
      </div>

      <ul className="lista-datos">
        <li className="lista-datos__elemento">
          <span className="lista-datos__clave">Páginas detectadas</span>
          <span className="lista-datos__valor">
            {informe.numeroPaginas === null
              ? 'No se pudieron contar'
              : informe.numeroPaginas}
          </span>
        </li>
        <li className="lista-datos__elemento">
          <span className="lista-datos__clave">Estructura legible</span>
          <span className="lista-datos__valor">
            {describirEstadoEstructura(informe.estadoEstructura)}
          </span>
        </li>
        <li className="lista-datos__elemento">
          <span className="lista-datos__clave">Documento cifrado</span>
          <span className="lista-datos__valor">{informe.cifrado ? 'Sí' : 'No'}</span>
        </li>
      </ul>

      <div className="informe-seguridad__hallazgos">
        <h4 className="informe-seguridad__subtitulo">Hallazgos</h4>

        {informe.hallazgos.length === 0 ? (
          <p className="informe-seguridad__sin-hallazgos">
            No se encontraron indicadores estructurales relevantes entre los que
            analiza esta versión.
          </p>
        ) : (
          <ul className="lista-hallazgos-seguridad">
            {informe.hallazgos.map((hallazgo) => (
              <li
                className="hallazgo-seguridad"
                data-severidad={hallazgo.severidad}
                key={hallazgo.tipo}
              >
                <div className="hallazgo-seguridad__encabezado">
                  <h5 className="hallazgo-seguridad__titulo">
                    {hallazgo.titulo}
                  </h5>
                  <span className="hallazgo-seguridad__cantidad">
                    {describirCantidad(hallazgo.cantidad)}
                  </span>
                </div>
                <p className="hallazgo-seguridad__descripcion">
                  {hallazgo.descripcion}
                </p>
                <p className="hallazgo-seguridad__severidad">
                  Severidad: {ETIQUETAS_SEVERIDAD[hallazgo.severidad]}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DetallesTecnicos
        titulo="Detalles técnicos"
        aclaracion="Claves PDF y clasificación estructural"
        explicacion={
          <p className="informe-seguridad__explicacion">
            Estos datos sirven para una revisión avanzada. Muestran tipos, claves y
            contextos estructurales, metadatos acotados de adjuntos y advertencias de
            qpdf; no incluyen streams ni ejecutan su contenido.
          </p>
        }
      >
        <ul className="detalles-inspeccion">
          {informe.hallazgos.map((hallazgo) => (
            <DetalleHallazgo hallazgo={hallazgo} key={hallazgo.tipo} />
          ))}
          {informe.archivosIncrustados.map((archivo, indice) => (
            <DetalleArchivo
              archivo={archivo}
              key={`${archivo.referencia ?? archivo.nombre}-${indice}`}
            />
          ))}
          {informe.advertenciasTecnicas.map((advertencia, indice) => (
            <li className="detalles-inspeccion__elemento" key={indice}>
              <span>Advertencia de qpdf</span>
              <code className="diagnostico__mensaje">{advertencia}</code>
            </li>
          ))}
          {informe.hallazgos.length === 0 &&
            informe.archivosIncrustados.length === 0 &&
            informe.advertenciasTecnicas.length === 0 && (
              <li>No hay indicadores que detallar.</li>
            )}
        </ul>
      </DetallesTecnicos>

      <p className="informe-seguridad__limitacion">
        La presencia de una característica no significa necesariamente que el
        documento sea malicioso. Este análisis no sustituye a un antivirus ni
        garantiza que el archivo sea seguro.
      </p>
    </section>
  )
}

function DetalleHallazgo({ hallazgo }: { readonly hallazgo: HallazgoSeguridad }) {
  const claves = describirClaves(hallazgo.tipo)

  return (
    <li className="detalles-inspeccion__elemento">
      <code className="detalles-inspeccion__tipo">{hallazgo.tipo}</code>
      <span>{ETIQUETAS_SEVERIDAD[hallazgo.severidad]}</span>
      <span>{describirCantidad(hallazgo.cantidad)}</span>
      {claves.length > 0 && (
        <span>
          Claves: {claves.map((clave, indice) => (
            <span key={clave}>
              {indice > 0 ? ', ' : ''}
              <code>{clave}</code>
            </span>
          ))}
        </span>
      )}
      {hallazgo.contextos.length > 0 && (
        <span>
          Contextos: {hallazgo.contextos.map((contexto, indice) => (
            <span key={`${contexto}-${indice}`}>
              {indice > 0 ? ', ' : ''}
              <code>{contexto}</code>
            </span>
          ))}
        </span>
      )}
    </li>
  )
}

function DetalleArchivo({
  archivo,
}: {
  readonly archivo: ArchivoIncrustadoSeguridad
}) {
  return (
    <li className="detalles-inspeccion__elemento">
      <strong>Archivo incrustado: {archivo.nombre}</strong>
      <span>Extensión: {archivo.extension ?? 'no determinada'}</span>
      <span>Tipo declarado: {archivo.tipoDeclarado ?? 'no declarado'}</span>
      <span>
        Apariencia de ejecutable o script: {archivo.aparentaEjecutable ? 'sí' : 'no'}
      </span>
      {archivo.referencia !== null && (
        <span>
          Referencia: <code>{archivo.referencia}</code>
        </span>
      )}
    </li>
  )
}

function describirCantidad(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? 'coincidencia' : 'coincidencias'}`
}

function describirEstadoEstructura(
  estado: InformeSeguridadPdf['estadoEstructura'],
): string {
  switch (estado) {
    case 'valida':
      return 'Sí'
    case 'con-advertencias':
      return 'Con advertencias'
    case 'danada':
      return 'Dañada'
  }
}

/** Claves que originan cada tipo, sin depender de contenido del documento. */
function describirClaves(tipo: string): readonly string[] {
  switch (tipo) {
    case 'javascript':
      return ['/JavaScript', '/JS']
    case 'accion-apertura':
      return ['/OpenAction']
    case 'accion-adicional':
      return ['/AA']
    case 'launch':
      return ['/Launch']
    case 'archivo-incrustado':
    case 'ejecutable-incrustado':
      return ['/EmbeddedFiles', '/EmbeddedFile']
    case 'envio-formulario':
      return ['/SubmitForm']
    case 'enlace-externo':
      return ['/URI']
    case 'contenido-multimedia':
      return ['/RichMedia']
    case 'formulario':
      return ['/AcroForm']
    case 'xfa':
      return ['/XFA']
    default:
      return []
  }
}
