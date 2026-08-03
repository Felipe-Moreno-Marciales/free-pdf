import type { ReactNode } from 'react'
import { IconoEscudo } from './Iconos'

interface PropiedadesAvisoSeguridad {
  /** Título del aviso. */
  readonly titulo: string
  /** Contenido explicativo. */
  readonly children: ReactNode
  /**
   * Tono del aviso.
   *
   * `informativo` explica cómo funciona algo; `advertencia` señala una limitación
   * que conviene entender antes de seguir.
   */
  readonly tono?: 'informativo' | 'advertencia'
}

/**
 * Aviso destacado sobre el alcance real de una herramienta de seguridad.
 *
 * Las herramientas de esta categoría prometen cosas que se parecen entre sí pero
 * no son equivalentes: una firma visual no es una firma digital, unos permisos no
 * son una barrera técnica y tapar algo no es eliminarlo. Este componente da un
 * lugar fijo y reconocible a esas aclaraciones, para que no queden escondidas en
 * la documentación.
 *
 * Se marca como `note`, no como `alert`: informa antes de actuar y no interrumpe.
 * El tono se distingue con un icono y con el propio título, no solo con el color.
 */
export function AvisoSeguridad({
  titulo,
  children,
  tono = 'informativo',
}: PropiedadesAvisoSeguridad) {
  return (
    <section
      className="aviso-seguridad"
      data-tono={tono}
      role="note"
      aria-label={titulo}
    >
      <h3 className="aviso-seguridad__titulo">
        <IconoEscudo className="aviso-seguridad__icono" />
        {titulo}
      </h3>

      <div className="aviso-seguridad__cuerpo">{children}</div>
    </section>
  )
}
