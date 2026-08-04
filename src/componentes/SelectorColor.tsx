import { useEffect, useId, useState } from 'react'
import { esColorValido, normalizarColor } from '../pdf/colores'

interface PropiedadesSelectorColor {
  /** Texto de la etiqueta. */
  readonly etiqueta: string
  /** Color actual, en notación `#rrggbb`. */
  readonly valor: string
  /** Bloquea el control mientras hay un proceso en curso. */
  readonly deshabilitado: boolean
  /** Se ejecuta con el color elegido, ya normalizado. */
  readonly alCambiar: (color: string) => void
  /** Aclaración que se muestra bajo el control. */
  readonly ayuda?: string
}

/**
 * Selector de color con paleta del navegador y campo de texto.
 *
 * Se ofrecen las dos formas a propósito: la paleta nativa es cómoda con el ratón
 * pero difícil de manejar con un lector de pantalla, mientras que el campo de
 * texto permite escribir el color exacto y funciona íntegramente con el teclado.
 * Ambos controles reflejan el mismo valor.
 *
 * Mientras se escribe se admiten formas incompletas sin protestar; el color solo
 * se comunica cuando ya es válido.
 */
export function SelectorColor({
  etiqueta,
  valor,
  deshabilitado,
  alCambiar,
  ayuda,
}: PropiedadesSelectorColor) {
  const idPaleta = useId()
  const idTexto = useId()
  const idAyuda = useId()
  const idError = useId()

  const [texto, establecerTexto] = useState(valor)

  // Cuando el color cambia desde fuera —al restablecer la herramienta, por
  // ejemplo— el campo de texto se pone al día.
  useEffect(() => {
    establecerTexto(valor)
  }, [valor])

  const textoValido = esColorValido(texto)

  const aplicarTexto = (siguiente: string): void => {
    establecerTexto(siguiente)

    const normalizado = normalizarColor(siguiente)
    if (normalizado !== null) {
      alCambiar(normalizado)
    }
  }

  return (
    <div className="selector-color">
      <span className="selector-color__etiqueta">{etiqueta}</span>

      <div className="selector-color__fila">
        <input
          className="selector-color__paleta"
          id={idPaleta}
          type="color"
          value={valor}
          disabled={deshabilitado}
          aria-label={`${etiqueta}: elegir en la paleta`}
          onChange={(evento) => {
            establecerTexto(evento.target.value)
            alCambiar(evento.target.value)
          }}
        />

        <input
          className="campo-texto campo-texto--color"
          id={idTexto}
          type="text"
          value={texto}
          spellCheck={false}
          autoComplete="off"
          disabled={deshabilitado}
          aria-label={`${etiqueta}: escribir el código hexadecimal`}
          aria-invalid={!textoValido}
          aria-describedby={
            textoValido
              ? ayuda === undefined
                ? undefined
                : idAyuda
              : `${idError}${ayuda === undefined ? '' : ` ${idAyuda}`}`
          }
          onChange={(evento) => aplicarTexto(evento.target.value)}
        />
      </div>

      {ayuda !== undefined && (
        <p className="selector-color__ayuda" id={idAyuda}>
          {ayuda}
        </p>
      )}

      {!textoValido && (
        <p className="selector-color__error" id={idError}>
          Escribe un color en notación hexadecimal, por ejemplo #1b1f2a o #f0a.
        </p>
      )}
    </div>
  )
}
