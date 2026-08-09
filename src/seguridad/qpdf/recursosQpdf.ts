/**
 * Dirección del archivo WebAssembly de qpdf.
 *
 * Se importa con el sufijo `?url`, así que Vite lo trata como un recurso más del
 * proyecto: lo copia a `dist/assets/`, le añade una huella en el nombre y aplica
 * la ruta base `/free-pdf/`. No se usa ninguna CDN.
 *
 * La importación vive en su propio módulo para que el hilo principal pueda
 * conocer la dirección sin cargar nada más de la infraestructura de cifrado, y
 * para que el trabajador la reciba ya resuelta en lugar de intentar deducirla.
 *
 * La petición del archivo es del mismo origen y no contiene ningún dato: es el
 * propio motor, idéntico para todo el mundo.
 */
import urlWasmQpdf from '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url'

/** Dirección del WebAssembly de qpdf, ya con la ruta base aplicada. */
export const URL_WASM_QPDF: string = urlWasmQpdf

/**
 * Tamaño aproximado del WebAssembly, en bytes.
 *
 * Se declara aquí para poder mostrarlo en la interfaz y avisar de la descarga
 * antes de empezarla. El valor corresponde a la versión 0.3.0 del paquete, que
 * contiene qpdf 12.2.0.
 */
export const TAMANO_WASM_QPDF = 1_334_286

/** Versión de qpdf que contiene el WebAssembly integrado. */
export const VERSION_QPDF = '12.2.0'
