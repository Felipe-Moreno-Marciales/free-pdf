import { useEffect, useState } from 'react'
import { IconoLuna, IconoSol } from './Iconos'

type Tema = 'claro' | 'oscuro'

/** Lee la preferencia del dispositivo sin guardar ningún dato en el navegador. */
function obtenerTemaInicial(): Tema {
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'oscuro'
  }

  return 'claro'
}

/** Selector de tema local a la sesión actual. */
export function SelectorTema() {
  const [tema, establecerTema] = useState<Tema>(obtenerTemaInicial)
  const temaOscuro = tema === 'oscuro'
  const temaSiguiente = temaOscuro ? 'claro' : 'oscuro'

  useEffect(() => {
    const raiz = document.documentElement
    raiz.dataset.tema = tema

    return () => {
      delete raiz.dataset.tema
    }
  }, [tema])

  return (
    <button
      className="selector-tema"
      type="button"
      aria-label={`Cambiar al tema ${temaSiguiente}`}
      aria-pressed={temaOscuro}
      title={`Cambiar al tema ${temaSiguiente}`}
      onClick={() => establecerTema(temaSiguiente)}
    >
      <span
        className="selector-tema__opcion"
        data-activa={!temaOscuro}
        aria-hidden="true"
      >
        <IconoSol className="selector-tema__icono" />
      </span>
      <span
        className="selector-tema__opcion"
        data-activa={temaOscuro}
        aria-hidden="true"
      >
        <IconoLuna className="selector-tema__icono" />
      </span>
    </button>
  )
}
