import {
  describirGeometria,
  resumirDiferencias,
} from './compararContenido'
import { resumirComparacion } from './compararDocumentos'
import {
  describirEstadoPagina,
  type ComparacionPagina,
  type ResultadoComparacion,
} from './tipos'

/**
 * Informe de comparación como HTML estático.
 *
 * Se genera HTML y no PDF a propósito. Un PDF exigiría incrustar tipografías para
 * poder escribir los acentos y las eñes, y las tipografías estándar del formato no
 * cubren todo lo que puede aparecer en el texto comparado. Un HTML se abre en
 * cualquier navegador, se puede imprimir a PDF desde ahí y **no pierde ni un carácter**.
 *
 * El archivo resultante es **completamente autónomo**: los estilos van dentro, no hay
 * ni un `script`, ni una imagen, ni una referencia externa. Se puede archivar, enviar
 * por correo o abrir sin conexión, y no ejecuta nada.
 */

/** Nombre del informe. */
export const NOMBRE_INFORME = 'free-pdf-informe-comparacion.html'

/**
 * Escapa un texto para insertarlo en HTML.
 *
 * Los nombres de archivo y el texto comparado vienen de los documentos de la persona,
 * así que pueden contener cualquier cosa. Sin escapar, un nombre de archivo con un
 * `<script>` acabaría dentro del informe.
 */
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Cuántas palabras cambiadas se listan por página en el informe. */
export const PALABRAS_POR_PAGINA = 40

/** Genera el informe completo. */
export function generarInforme(
  resultado: ResultadoComparacion,
  fecha: Date,
): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Informe de comparación · Free PDF</title>
<style>${ESTILOS}</style>
</head>
<body>
<main class="informe">
<h1>Informe de comparación</h1>

<p class="generado">Generado por Free PDF el ${escaparHtml(formatearFechaHora(fecha))}, en el navegador. Ningún documento salió del dispositivo.</p>

${seccionDocumentos(resultado)}
${seccionResumen(resultado)}
${seccionAdvertencia()}
${seccionMetadatos(resultado)}
${seccionPaginas(resultado)}
</main>
</body>
</html>
`
}

/** Formatea la fecha y la hora en español. */
export function formatearFechaHora(fecha: Date): string {
  const dos = (numero: number): string => String(numero).padStart(2, '0')

  return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}/${fecha.getFullYear()} a las ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`
}

/** Sección con los dos documentos comparados. */
function seccionDocumentos(resultado: ResultadoComparacion): string {
  return `<section>
<h2>Documentos comparados</h2>
<table>
<tbody>
<tr><th scope="row">Primer documento</th><td>${escaparHtml(resultado.nombreAntes)} · ${resultado.paginasAntes} ${resultado.paginasAntes === 1 ? 'página' : 'páginas'}</td></tr>
<tr><th scope="row">Segundo documento</th><td>${escaparHtml(resultado.nombreDespues)} · ${resultado.paginasDespues} ${resultado.paginasDespues === 1 ? 'página' : 'páginas'}</td></tr>
<tr><th scope="row">Umbral visual</th><td>${(resultado.umbral * 100).toFixed(2)} % de píxeles</td></tr>
</tbody>
</table>
</section>`
}

/** Sección de resumen con el recuento. */
function seccionResumen(resultado: ResultadoComparacion): string {
  const { recuento } = resultado

  return `<section>
<h2>Resumen</h2>
<p class="${resultado.sonIdenticos ? 'correcto' : 'aviso'}">${escaparHtml(resumirComparacion(resultado))}</p>
<table>
<thead><tr><th scope="col">Estado</th><th scope="col">Páginas</th></tr></thead>
<tbody>
<tr><td>Sin cambios</td><td>${recuento.identicas}</td></tr>
<tr><td>Modificadas</td><td>${recuento.modificadas}</td></tr>
<tr><td>Añadidas</td><td>${recuento.anadidas}</td></tr>
<tr><td>Eliminadas</td><td>${recuento.eliminadas}</td></tr>
</tbody>
</table>
</section>`
}

/**
 * Advertencia sobre qué significa y qué no significa este informe.
 *
 * Va en el propio informe, no solo en la interfaz. El archivo se puede archivar o
 * reenviar, y quien lo lea meses después merece la misma advertencia que quien lo
 * generó.
 */
function seccionAdvertencia(): string {
  return `<section class="advertencia">
<h2>Qué significa este informe, y qué no</h2>
<p>La comparación mira dos cosas <strong>distintas</strong>, y conviene no confundirlas:</p>
<ul>
<li><strong>El texto extraíble.</strong> Es la comparación fiable: dos documentos con el mismo texto dicen lo mismo.</li>
<li><strong>Los píxeles de cada página.</strong> Detecta cambios que el texto no ve —una imagen distinta, un sello movido, otro color—, pero <strong>una diferencia visual no implica una diferencia de contenido</strong>: cambiar de tipografía altera todos los píxeles sin cambiar una sola palabra.</li>
</ul>
<p>Además:</p>
<ul>
<li>Las páginas se emparejan <strong>por su número</strong>. Insertar una página al principio marca todas las siguientes como modificadas.</li>
<li>Un documento escaneado sin capa de texto no aporta texto que comparar, así que solo se compara visualmente.</li>
<li><strong>No encontrar diferencias no demuestra que los archivos sean idénticos</strong> byte a byte: solo que esta comparación no encuentra ninguna.</li>
</ul>
</section>`
}

/** Sección de metadatos cambiados. */
function seccionMetadatos(resultado: ResultadoComparacion): string {
  if (resultado.metadatos.length === 0) {
    return `<section>
<h2>Metadatos</h2>
<p>Ningún metadato cambia.</p>
</section>`
  }

  const filas = resultado.metadatos
    .map(
      (diferencia) =>
        `<tr><th scope="row">${escaparHtml(diferencia.clave)}</th><td>${escaparHtml(diferencia.antes) || '<span class="vacio">(vacío)</span>'}</td><td>${escaparHtml(diferencia.despues) || '<span class="vacio">(vacío)</span>'}</td></tr>`,
    )
    .join('\n')

  return `<section>
<h2>Metadatos que cambian</h2>
<table>
<thead><tr><th scope="col">Metadato</th><th scope="col">Antes</th><th scope="col">Después</th></tr></thead>
<tbody>
${filas}
</tbody>
</table>
</section>`
}

/** Sección con el detalle de cada página. */
function seccionPaginas(resultado: ResultadoComparacion): string {
  const conCambios = resultado.paginas.filter(
    (pagina) => pagina.estado !== 'identica',
  )

  if (conCambios.length === 0) {
    return `<section>
<h2>Detalle por páginas</h2>
<p>Ninguna página presenta diferencias.</p>
</section>`
  }

  return `<section>
<h2>Detalle por páginas</h2>
<p>Se listan solo las ${conCambios.length} ${conCambios.length === 1 ? 'página que presenta diferencias' : 'páginas que presentan diferencias'}.</p>
${conCambios.map(detallePagina).join('\n')}
</section>`
}

/** Detalle de una página con diferencias. */
function detallePagina(pagina: ComparacionPagina): string {
  const partes: string[] = [
    `<article class="pagina">
<h3>Página ${pagina.numero} · <span class="estado estado--${pagina.estado}">${describirEstadoPagina(pagina.estado)}</span></h3>`,
  ]

  if (pagina.estado === 'anadida' || pagina.estado === 'eliminada') {
    partes.push(
      `<p>Esta página solo existe en ${pagina.estado === 'anadida' ? 'el segundo' : 'el primer'} documento.</p>`,
    )
  } else {
    partes.push(
      `<p>${escaparHtml(resumirDiferencias(pagina.texto, pagina.visual, pagina.geometriaDistinta))}</p>`,
    )
  }

  if (
    pagina.geometriaDistinta &&
    pagina.geometriaAntes !== null &&
    pagina.geometriaDespues !== null
  ) {
    partes.push(`<table>
<tbody>
<tr><th scope="row">Antes</th><td>${escaparHtml(describirGeometria(pagina.geometriaAntes))}</td></tr>
<tr><th scope="row">Después</th><td>${escaparHtml(describirGeometria(pagina.geometriaDespues))}</td></tr>
</tbody>
</table>`)
  }

  if (pagina.texto !== null) {
    partes.push(listaPalabras('Palabras eliminadas', pagina.texto.eliminadas))
    partes.push(listaPalabras('Palabras añadidas', pagina.texto.anadidas))
  }

  partes.push('</article>')

  return partes.filter((parte) => parte !== '').join('\n')
}

/** Lista de palabras cambiadas, recortada si son muchas. */
function listaPalabras(
  titulo: string,
  palabras: readonly string[],
): string {
  if (palabras.length === 0) {
    return ''
  }

  const mostradas = palabras.slice(0, PALABRAS_POR_PAGINA)
  const restantes = palabras.length - mostradas.length

  const etiquetas = mostradas
    .map((palabra) => `<li><code>${escaparHtml(palabra)}</code></li>`)
    .join('')

  const aviso =
    restantes > 0
      ? `<p class="recorte">y ${restantes} ${restantes === 1 ? 'palabra más' : 'palabras más'}.</p>`
      : ''

  return `<h4>${escaparHtml(titulo)} (${palabras.length})</h4>
<ul class="palabras">${etiquetas}</ul>${aviso}`
}

/**
 * Estilos del informe.
 *
 * Van dentro del archivo, sin ninguna referencia externa, y se adaptan al modo claro y
 * oscuro del sistema. Un informe que se va a archivar no puede depender de que un
 * servidor siga existiendo.
 */
const ESTILOS = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 2rem 1rem;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  line-height: 1.6;
  color: #1f2933;
  background-color: #f7f8fa;
}
.informe { max-width: 52rem; margin: 0 auto; }
h1 { margin-top: 0; font-size: 1.8rem; }
h2 { margin-top: 2rem; font-size: 1.3rem; }
h3 { margin: 0 0 .5rem; font-size: 1.05rem; }
h4 { margin: 1rem 0 .25rem; font-size: .95rem; }
.generado { color: #52606d; font-size: .9rem; }
section { padding: 1.25rem; margin-bottom: 1.5rem; background-color: #ffffff; border: 1px solid #cbd2d9; border-radius: .5rem; }
table { width: 100%; border-collapse: collapse; margin: .75rem 0; }
th, td { padding: .5rem .75rem; text-align: left; border-bottom: 1px solid #e4e7eb; vertical-align: top; }
th[scope="row"] { width: 12rem; color: #52606d; font-weight: 600; }
.correcto { padding: .75rem; color: #0b6b3a; background-color: #e3f9e5; border-radius: .25rem; }
.aviso { padding: .75rem; color: #8a5300; background-color: #fff8e1; border-radius: .25rem; }
.advertencia { background-color: #f5f7ff; border-color: #b3c0e8; }
.pagina { padding: 1rem; margin-top: 1rem; background-color: #f7f8fa; border: 1px solid #e4e7eb; border-radius: .25rem; }
.estado { padding: .1rem .5rem; font-size: .85rem; border-radius: 1rem; }
.estado--modificada { color: #8a5300; background-color: #fff8e1; }
.estado--anadida { color: #0b6b3a; background-color: #e3f9e5; }
.estado--eliminada { color: #8a1c1c; background-color: #ffeaea; }
.palabras { display: flex; flex-wrap: wrap; gap: .4rem; padding: 0; margin: .25rem 0; list-style: none; }
.palabras li { padding: .15rem .45rem; background-color: #ffffff; border: 1px solid #cbd2d9; border-radius: .25rem; }
code { font-family: ui-monospace, monospace; font-size: .85rem; }
.recorte, .vacio { color: #52606d; font-size: .85rem; }
@media (prefers-color-scheme: dark) {
  body { color: #e4e7eb; background-color: #1f2933; }
  section { background-color: #323f4b; border-color: #52606d; }
  .pagina { background-color: #3e4c59; border-color: #52606d; }
  .palabras li { background-color: #323f4b; border-color: #52606d; }
  th, td { border-color: #52606d; }
  th[scope="row"], .generado, .recorte, .vacio { color: #9aa5b1; }
  .advertencia { background-color: #2b3a55; border-color: #52606d; }
}
@media print {
  body { background-color: #ffffff; }
  section { break-inside: avoid; border-color: #999999; }
}
`
