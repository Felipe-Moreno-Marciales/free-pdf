import { useId } from 'react'

/** Opción dentro de un grupo. */
export interface OpcionElegible<Valor extends string> {
  /** Valor que se comunica al elegirla. */
  readonly valor: Valor
  /** Texto visible. */
  readonly etiqueta: string
  /** Aclaración opcional que se muestra bajo la etiqueta. */
  readonly descripcion?: string
}

interface PropiedadesGrupoOpciones<Valor extends string> {
  /** Título del grupo, que se lee como parte del nombre de cada opción. */
  readonly etiqueta: string
  /** Opciones disponibles. */
  readonly opciones: readonly OpcionElegible<Valor>[]
  /** Opción elegida. */
  readonly valor: Valor
  /** Bloquea el grupo mientras hay un proceso en curso. */
  readonly deshabilitado: boolean
  /** Se ejecuta con la opción elegida. */
  readonly alCambiar: (valor: Valor) => void
  /** Aclaración del grupo completo. */
  readonly ayuda?: string
  /** Muestra las opciones en columna en lugar de en fila. */
  readonly enColumna?: boolean
}

/**
 * Grupo de opciones excluyentes.
 *
 * Se apoya en `<fieldset>`, `<legend>` y campos `radio` nativos, así que el
 * navegador aporta gratis la navegación con las flechas del teclado, el
 * agrupamiento para los lectores de pantalla y el estado de selección. Las
 * etiquetas visibles se estilan como pastillas, pero el control real sigue
 * siendo el `radio`: la selección nunca depende solo del color, porque la opción
 * elegida también queda marcada para la tecnología asistiva.
 */
export function GrupoOpciones<Valor extends string>({
  etiqueta,
  opciones,
  valor,
  deshabilitado,
  alCambiar,
  ayuda,
  enColumna = false,
}: PropiedadesGrupoOpciones<Valor>) {
  const nombre = useId()
  const idAyuda = useId()

  return (
    <fieldset
      className="grupo-opciones"
      aria-describedby={ayuda === undefined ? undefined : idAyuda}
    >
      <legend className="grupo-opciones__titulo">{etiqueta}</legend>

      {ayuda !== undefined && (
        <p className="grupo-opciones__ayuda" id={idAyuda}>
          {ayuda}
        </p>
      )}

      <div className="pastillas" data-columna={enColumna}>
        {opciones.map((opcion) => (
          <label
            className="pastilla"
            key={opcion.valor}
            data-elegida={opcion.valor === valor}
            data-deshabilitada={deshabilitado}
          >
            <input
              className="pastilla__campo"
              type="radio"
              name={nombre}
              value={opcion.valor}
              checked={opcion.valor === valor}
              disabled={deshabilitado}
              onChange={() => alCambiar(opcion.valor)}
            />
            <span className="pastilla__texto">
              <span className="pastilla__etiqueta">{opcion.etiqueta}</span>
              {opcion.descripcion !== undefined && (
                <span className="pastilla__descripcion">
                  {opcion.descripcion}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
