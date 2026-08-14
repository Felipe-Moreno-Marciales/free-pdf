import { lazy } from 'react'
import {
  IconoCensurar,
  IconoBuscar,
  IconoComparar,
  IconoDesbloquear,
  IconoDividir,
  IconoEditar,
  IconoEliminarPaginas,
  IconoEscanear,
  IconoExtraer,
  IconoFirma,
  IconoFormulario,
  IconoImagenAPdf,
  IconoInspeccionarSeguridad,
  IconoMarcaDeAgua,
  IconoNumerarPaginas,
  IconoOrganizar,
  IconoPaquete,
  IconoPdfAImagenes,
  IconoProteger,
  IconoRecortar,
  IconoReparar,
  IconoRotarDerecha,
  IconoTexto,
  IconoUnir,
} from '../componentes/Iconos'
import type {
  CategoriaConHerramientas,
  DefinicionCategoria,
  DefinicionHerramienta,
  IdHerramienta,
} from './tipos'

/**
 * Categorías del catálogo.
 *
 * Agrupar las herramientas hace que el listado siga siendo comprensible a medida
 * que crece: quien busca reordenar páginas no tiene que leer las doce tarjetas.
 */
export const CATEGORIAS: readonly DefinicionCategoria[] = [
  {
    id: 'organizacion',
    nombre: 'Organización',
    descripcion:
      'Combina, separa y reordena las páginas de documentos que ya tienes.',
  },
  {
    id: 'creacion',
    nombre: 'Creación y personalización',
    descripcion:
      'Crea documentos a partir de imágenes o de la cámara, y personaliza los que ya tienes.',
  },
  {
    id: 'seguridad',
    nombre: 'Seguridad y edición',
    descripcion:
      'Inspecciona la estructura, cifra documentos, quita la protección de los que ya la tienen, trabaja con formularios, censura información de verdad, anota y firma visualmente.',
  },
  {
    id: 'analisis',
    nombre: 'Diagnóstico y conversión',
    descripcion:
      'Comprueba el estado de un documento, recupera los que están dañados y extrae su contenido a otros formatos.',
  },
]

/**
 * Catálogo de las herramientas disponibles.
 *
 * Cada interfaz se carga de forma diferida con `lazy`, así que abrir la página
 * inicial no descarga ni pdf-lib ni PDF.js ni la lógica de la cámara: cada motor
 * se trae solo cuando se entra en la herramienta que lo necesita.
 */
export const HERRAMIENTAS: readonly DefinicionHerramienta[] = [
  {
    id: 'unir',
    categoria: 'organizacion',
    nombre: 'Unir PDF',
    descripcion:
      'Combina varios documentos en un único PDF y decide el orden de las páginas.',
    Icono: IconoUnir,
    disponible: true,
    Panel: lazy(async () => ({
      default: (await import('../funcionalidades/unir-pdf/HerramientaUnirPdf'))
        .HerramientaUnirPdf,
    })),
  },
  {
    id: 'dividir',
    categoria: 'organizacion',
    nombre: 'Dividir PDF',
    descripcion:
      'Separa un documento en varios PDF por rangos de páginas o página a página.',
    Icono: IconoDividir,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import('../funcionalidades/dividir-pdf/HerramientaDividirPdf')
      ).HerramientaDividirPdf,
    })),
  },
  {
    id: 'extraer',
    categoria: 'organizacion',
    nombre: 'Extraer páginas',
    descripcion:
      'Elige las páginas que te interesan y reúnelas en un documento nuevo.',
    Icono: IconoExtraer,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import(
          '../funcionalidades/extraer-paginas/HerramientaExtraerPaginas'
        )
      ).HerramientaExtraerPaginas,
    })),
  },
  {
    id: 'eliminar',
    categoria: 'organizacion',
    nombre: 'Eliminar páginas',
    descripcion:
      'Quita las páginas que no necesitas y conserva el resto del documento.',
    Icono: IconoEliminarPaginas,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import(
          '../funcionalidades/eliminar-paginas/HerramientaEliminarPaginas'
        )
      ).HerramientaEliminarPaginas,
    })),
  },
  {
    id: 'organizar',
    categoria: 'organizacion',
    nombre: 'Organizar páginas',
    descripcion:
      'Cambia el orden de las páginas arrastrándolas o con los botones de movimiento.',
    Icono: IconoOrganizar,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import(
          '../funcionalidades/organizar-paginas/HerramientaOrganizarPaginas'
        )
      ).HerramientaOrganizarPaginas,
    })),
  },
  {
    id: 'rotar',
    categoria: 'organizacion',
    nombre: 'Rotar páginas',
    descripcion:
      'Gira las páginas que elijas en cuartos de vuelta o media vuelta.',
    Icono: IconoRotarDerecha,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import('../funcionalidades/rotar-paginas/HerramientaRotarPaginas')
      ).HerramientaRotarPaginas,
    })),
  },
  {
    id: 'imagenes-a-pdf',
    categoria: 'creacion',
    nombre: 'Imágenes a PDF',
    descripcion:
      'Convierte tus imágenes JPEG, PNG y WebP en un único PDF, con una página por imagen.',
    Icono: IconoImagenAPdf,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import(
          '../funcionalidades/imagenes-a-pdf/HerramientaImagenesAPdf'
        )
      ).HerramientaImagenesAPdf,
    })),
  },
  {
    id: 'pdf-a-imagenes',
    categoria: 'creacion',
    nombre: 'PDF a imágenes',
    descripcion:
      'Guarda las páginas que elijas como imágenes PNG o JPEG, con la resolución que necesites.',
    Icono: IconoPdfAImagenes,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import(
          '../funcionalidades/pdf-a-imagenes/HerramientaPdfAImagenes'
        )
      ).HerramientaPdfAImagenes,
    })),
  },
  {
    id: 'numerar',
    categoria: 'creacion',
    nombre: 'Numerar páginas',
    descripcion:
      'Añade números de página con el texto, la posición y la apariencia que prefieras.',
    Icono: IconoNumerarPaginas,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import(
          '../funcionalidades/numerar-paginas/HerramientaNumerarPaginas'
        )
      ).HerramientaNumerarPaginas,
    })),
  },
  {
    id: 'marca-de-agua',
    categoria: 'creacion',
    nombre: 'Marca de agua',
    descripcion:
      'Superpone un texto o una imagen sobre las páginas, una sola vez o en mosaico.',
    Icono: IconoMarcaDeAgua,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import('../funcionalidades/marca-de-agua/HerramientaMarcaDeAgua')
      ).HerramientaMarcaDeAgua,
    })),
  },
  {
    id: 'recortar',
    categoria: 'creacion',
    nombre: 'Recortar PDF',
    descripcion:
      'Ajusta el área visible de las páginas indicando cuánto quitar por cada lado.',
    Icono: IconoRecortar,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import('../funcionalidades/recortar-pdf/HerramientaRecortarPdf')
      ).HerramientaRecortarPdf,
    })),
  },
  {
    id: 'escanear',
    categoria: 'creacion',
    nombre: 'Escanear a PDF',
    descripcion:
      'Crea un PDF con la cámara o con fotografías que ya tengas, con recorte y filtros.',
    Icono: IconoEscanear,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import(
          '../funcionalidades/escanear-a-pdf/HerramientaEscanearAPdf'
        )
      ).HerramientaEscanearAPdf,
    })),
  },
  {
    id: 'inspeccionar-seguridad',
    categoria: 'seguridad',
    nombre: 'Inspector de seguridad PDF',
    descripcion:
      'Analiza localmente la estructura del PDF y señala JavaScript, acciones automáticas, archivos incrustados y otras características sensibles.',
    Icono: IconoInspeccionarSeguridad,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import(
          '../funcionalidades/inspeccionar-seguridad/HerramientaInspeccionarSeguridad'
        )
      ).HerramientaInspeccionarSeguridad,
    })),
  },
  {
    id: 'proteger',
    categoria: 'seguridad',
    nombre: 'Proteger PDF',
    descripcion:
      'Cifra el documento con una contraseña de apertura usando AES de 256 bits, y decide los permisos.',
    Icono: IconoProteger,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import('../funcionalidades/proteger-pdf/HerramientaProtegerPdf')
      ).HerramientaProtegerPdf,
    })),
  },
  {
    id: 'desbloquear',
    categoria: 'seguridad',
    nombre: 'Desbloquear PDF',
    descripcion:
      'Quita la contraseña de un documento protegido, siempre que conozcas esa contraseña.',
    Icono: IconoDesbloquear,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import(
          '../funcionalidades/desbloquear-pdf/HerramientaDesbloquearPdf'
        )
      ).HerramientaDesbloquearPdf,
    })),
  },
  {
    id: 'formularios',
    categoria: 'seguridad',
    nombre: 'Formularios PDF',
    descripcion:
      'Rellena los campos de un formulario existente o crea campos nuevos, y aplánalos si quieres.',
    Icono: IconoFormulario,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import(
          '../funcionalidades/formularios-pdf/HerramientaFormulariosPdf'
        )
      ).HerramientaFormulariosPdf,
    })),
  },
  {
    id: 'censurar',
    categoria: 'seguridad',
    nombre: 'Censurar permanentemente',
    descripcion:
      'Elimina contenido de verdad: reconstruye el documento como imágenes y comprueba que no queda texto extraíble.',
    Icono: IconoCensurar,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import('../funcionalidades/censurar-pdf/HerramientaCensurarPdf')
      ).HerramientaCensurarPdf,
    })),
  },
  {
    id: 'editar',
    categoria: 'seguridad',
    nombre: 'Editar y anotar',
    descripcion:
      'Añade texto, formas y resaltados encima de las páginas. No modifica el texto original del documento.',
    Icono: IconoEditar,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import('../funcionalidades/editar-pdf/HerramientaEditarPdf')
      ).HerramientaEditarPdf,
    })),
  },
  {
    id: 'firma-visual',
    categoria: 'seguridad',
    nombre: 'Firma visual',
    descripcion:
      'Coloca una firma dibujada o escrita. Es un dibujo, no una firma digital con certificado.',
    Icono: IconoFirma,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import('../funcionalidades/firma-visual/HerramientaFirmaVisual')
      ).HerramientaFirmaVisual,
    })),
  },
  {
    id: 'reparar',
    categoria: 'analisis',
    nombre: 'Reparar PDF',
    descripcion:
      'Comprueba el estado de un documento y lo reescribe con una estructura limpia. No inventa lo que falte.',
    Icono: IconoReparar,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import('../funcionalidades/reparar-pdf/HerramientaRepararPdf')
      ).HerramientaRepararPdf,
    })),
  },
  {
    id: 'pdf-a-markdown',
    categoria: 'analisis',
    nombre: 'PDF a Markdown',
    descripcion:
      'Extrae la capa de texto y reconstruye de forma aproximada encabezados, párrafos, listas, enlaces y tablas sencillas.',
    Icono: IconoTexto,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import(
          '../funcionalidades/pdf-a-markdown/HerramientaPdfAMarkdown'
        )
      ).HerramientaPdfAMarkdown,
    })),
  },
  {
    id: 'comparar',
    categoria: 'analisis',
    nombre: 'Comparar PDF',
    descripcion:
      'Señala las diferencias entre dos documentos: texto, apariencia, medidas y metadatos, con informe descargable.',
    Icono: IconoComparar,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import('../funcionalidades/comparar-pdf/HerramientaCompararPdf')
      ).HerramientaCompararPdf,
    })),
  },
  {
    id: 'ocr',
    categoria: 'analisis',
    nombre: 'OCR local',
    descripcion:
      'Reconoce texto impreso en imágenes y PDF escaneados con español, inglés o ambos, sin enviar archivos ni usar CDN.',
    Icono: IconoBuscar,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import('../funcionalidades/ocr-local/HerramientaOcrLocal')
      ).HerramientaOcrLocal,
    })),
  },
  {
    id: 'comprimir',
    categoria: 'analisis',
    nombre: 'Comprimir PDF',
    descripcion:
      'Recomprime las imágenes y reorganiza la estructura del archivo. El texto no se toca, y si no consigue reducirlo no entrega nada.',
    Icono: IconoPaquete,
    disponible: true,
    Panel: lazy(async () => ({
      default: (
        await import('../funcionalidades/comprimir-pdf/HerramientaComprimirPdf')
      ).HerramientaComprimirPdf,
    })),
  },
]

/**
 * Agrupa las herramientas por categoría, en el orden en el que se muestran.
 * Las categorías sin herramientas se descartan.
 */
export function agruparPorCategoria(): readonly CategoriaConHerramientas[] {
  return CATEGORIAS.map((categoria) => ({
    categoria,
    herramientas: HERRAMIENTAS.filter(
      (herramienta) => herramienta.categoria === categoria.id,
    ),
  })).filter((grupo) => grupo.herramientas.length > 0)
}

/** Busca una herramienta por su identificador. */
export function buscarHerramienta(
  id: string | null,
): DefinicionHerramienta | null {
  if (id === null) {
    return null
  }

  return HERRAMIENTAS.find((herramienta) => herramienta.id === id) ?? null
}

/** Comprueba si una cadena es el identificador de una herramienta conocida. */
export function esIdHerramienta(valor: string): valor is IdHerramienta {
  return HERRAMIENTAS.some((herramienta) => herramienta.id === valor)
}

/** Busca la categoría a la que pertenece una herramienta. */
export function buscarCategoria(
  herramienta: DefinicionHerramienta,
): DefinicionCategoria | null {
  return (
    CATEGORIAS.find((categoria) => categoria.id === herramienta.categoria) ??
    null
  )
}
