import type { ComponentType, LazyExoticComponent } from 'react'

/** Identificador de cada herramienta de las fases 1 y 2. */
export type IdHerramienta =
  // Fase 1 — Organización
  | 'unir'
  | 'dividir'
  | 'extraer'
  | 'eliminar'
  | 'organizar'
  | 'rotar'
  // Fase 2 — Creación y personalización
  | 'imagenes-a-pdf'
  | 'pdf-a-imagenes'
  | 'numerar'
  | 'marca-de-agua'
  | 'recortar'
  | 'escanear'
  // Fase 3 — Seguridad y edición
  | 'proteger'
  | 'desbloquear'
  | 'formularios'
  | 'censurar'
  | 'editar'
  | 'firma-visual'
  // Fase 4 — Conversión y análisis
  | 'reparar'
  | 'comprimir'
  | 'comparar'
  | 'pdf-a-markdown'
  | 'ocr'

/** Identificador de cada categoría del catálogo. */
export type IdCategoria =
  | 'organizacion'
  | 'creacion'
  | 'seguridad'
  | 'analisis'

/** Componente de icono, que solo recibe una clase CSS. */
export type ComponenteIcono = ComponentType<{ readonly className?: string }>

/** Componente de una herramienta, cargado de forma diferida. */
export type ComponenteHerramienta = LazyExoticComponent<ComponentType>

/** Descripción de una herramienta dentro del catálogo. */
export interface DefinicionHerramienta {
  /** Identificador estable, que también se usa en el hash de la dirección. */
  readonly id: IdHerramienta
  /** Categoría a la que pertenece. */
  readonly categoria: IdCategoria
  /** Nombre visible. */
  readonly nombre: string
  /** Descripción breve de lo que hace. */
  readonly descripcion: string
  /** Icono propio de la herramienta. */
  readonly Icono: ComponenteIcono
  /** `true` cuando la herramienta está terminada y se puede usar. */
  readonly disponible: boolean
  /** Interfaz de la herramienta. */
  readonly Panel: ComponenteHerramienta
}

/** Descripción de una categoría del catálogo. */
export interface DefinicionCategoria {
  /** Identificador estable. */
  readonly id: IdCategoria
  /** Nombre visible. */
  readonly nombre: string
  /** Descripción breve de lo que agrupa. */
  readonly descripcion: string
}

/** Categoría junto con las herramientas que contiene. */
export interface CategoriaConHerramientas {
  /** Categoría descrita. */
  readonly categoria: DefinicionCategoria
  /** Herramientas que pertenecen a ella, en el orden del catálogo. */
  readonly herramientas: readonly DefinicionHerramienta[]
}
