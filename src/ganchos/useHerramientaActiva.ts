import { useCallback, useEffect, useState } from 'react'
import { esIdHerramienta } from '../herramientas/catalogo'
import type { IdHerramienta } from '../herramientas/tipos'

/** Estado y acciones de la navegación entre herramientas. */
export interface ControladorHerramientaActiva {
  /** Herramienta abierta, o `null` si se está viendo el listado. */
  readonly idActiva: IdHerramienta | null
  /** Abre una herramienta. */
  readonly abrir: (id: IdHerramienta) => void
  /** Vuelve al listado de herramientas. */
  readonly cerrar: () => void
}

/**
 * Sincroniza la herramienta abierta con el hash de la dirección.
 *
 * Se usa el hash en lugar de rutas reales porque la aplicación se publica como
 * sitio estático en GitHub Pages: así se puede compartir el enlace directo a
 * una herramienta y funcionan los botones de atrás y adelante del navegador,
 * sin necesidad de configurar redirecciones en el servidor ni de añadir un
 * enrutador como dependencia.
 */
export function useHerramientaActiva(): ControladorHerramientaActiva {
  const [idActiva, establecerIdActiva] = useState<IdHerramienta | null>(() =>
    leerHash(),
  )

  // Atiende los cambios de hash, incluidos los botones de atrás y adelante.
  useEffect(() => {
    const alCambiarHash = (): void => {
      establecerIdActiva(leerHash())
    }

    window.addEventListener('hashchange', alCambiarHash)

    return () => {
      window.removeEventListener('hashchange', alCambiarHash)
    }
  }, [])

  const abrir = useCallback((id: IdHerramienta): void => {
    window.location.hash = `#/${id}`
  }, [])

  const cerrar = useCallback((): void => {
    // Se usa el identificador de la sección del listado, así que además de
    // volver al listado el navegador lo desplaza a la vista.
    window.location.hash = '#herramientas'
  }, [])

  return { idActiva, abrir, cerrar }
}

/** Lee el identificador de herramienta que contiene el hash actual. */
function leerHash(): IdHerramienta | null {
  if (typeof window === 'undefined') {
    return null
  }

  const valor = window.location.hash.replace(/^#\/?/, '')

  return esIdHerramienta(valor) ? valor : null
}
