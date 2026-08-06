/** Ruta base estable de los recursos OCR publicados por el complemento de Vite. */
function leerRutaBase(): string {
  const base = import.meta.env.BASE_URL
  if (typeof base !== 'string' || base === '') return '/'
  return base.endsWith('/') ? base : `${base}/`
}

/** Construye la carpeta pública respetando cualquier ruta base de Vite. */
export function construirUrlRecursosOcr(base: string): string {
  const normalizada = base.endsWith('/') ? base : `${base}/`
  return `${normalizada}ocr/`
}

export const URL_RECURSOS_OCR = construirUrlRecursosOcr(leerRutaBase())
export const URL_TRABAJADOR_OCR = `${URL_RECURSOS_OCR}worker.min.js`
export const URL_NUCLEOS_OCR = `${URL_RECURSOS_OCR}core`
export const URL_IDIOMAS_OCR = `${URL_RECURSOS_OCR}idiomas`
