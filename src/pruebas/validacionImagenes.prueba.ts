import { describe, expect, it } from 'vitest'
import {
  anadirImagenesASeleccion,
  calcularTamanoTotalImagenes,
  describirDescartesImagenes,
  eliminarImagenDeSeleccion,
  girarImagen,
  moverImagen,
  reordenarImagenes,
} from '../imagenes/seleccionImagenes'
import {
  detectarFormatoImagen,
  esArchivoImagen,
  resumirDescartes,
  validarArchivoImagen,
} from '../imagenes/validarImagen'
import {
  comoArchivoImagen,
  crearArchivoImagen,
  crearBytesPng,
} from './ayudas/crearImagenPrueba'

describe('validarArchivoImagen: formatos admitidos', () => {
  it('acepta un JPEG con extensión .jpg', () => {
    const archivo = crearArchivoImagen('foto', 10, 10, 'jpeg')

    expect(validarArchivoImagen(archivo).valido).toBe(true)
    expect(validarArchivoImagen(archivo).formato).toBe('jpeg')
  })

  it('acepta un JPEG con extensión .jpeg', () => {
    const archivo = comoArchivoImagen(
      crearBytesPng(4, 4),
      'retrato.jpeg',
      'jpeg',
    )

    expect(detectarFormatoImagen(archivo)).toBe('jpeg')
  })

  it('acepta un PNG', () => {
    const archivo = crearArchivoImagen('grafico', 10, 10, 'png')

    expect(validarArchivoImagen(archivo).formato).toBe('png')
  })

  it('acepta un WebP', () => {
    const archivo = comoArchivoImagen(crearBytesPng(4, 4), 'moderno.webp', 'webp')

    expect(validarArchivoImagen(archivo).formato).toBe('webp')
  })

  it('reconoce las extensiones en mayúsculas', () => {
    const archivo = new File([new Uint8Array([1, 2, 3])], 'FOTO.JPG', {
      type: 'image/jpeg',
    })

    expect(esArchivoImagen(archivo)).toBe(true)
  })

  it('acepta un archivo sin tipo MIME si la extensión es válida', () => {
    const archivo = new File([new Uint8Array([1, 2, 3])], 'sin-tipo.png', {
      type: '',
    })

    expect(validarArchivoImagen(archivo).valido).toBe(true)
  })
})

describe('validarArchivoImagen: archivos rechazados', () => {
  it('rechaza una extensión que no es de imagen', () => {
    const archivo = new File([new Uint8Array([1, 2, 3])], 'documento.pdf', {
      type: 'application/pdf',
    })
    const resultado = validarArchivoImagen(archivo)

    expect(resultado.valido).toBe(false)
    expect(resultado.motivo).toBe('formato-no-admitido')
    expect(resultado.mensaje).toContain('documento.pdf')
  })

  it('rechaza un formato de imagen no comprobado, como GIF', () => {
    const archivo = new File([new Uint8Array([1, 2, 3])], 'animado.gif', {
      type: 'image/gif',
    })

    expect(validarArchivoImagen(archivo).motivo).toBe('formato-no-admitido')
  })

  it('rechaza un tipo MIME que no concuerda con la extensión', () => {
    const archivo = new File([new Uint8Array([1, 2, 3])], 'enganoso.png', {
      type: 'application/pdf',
    })

    expect(detectarFormatoImagen(archivo)).toBeNull()
    expect(validarArchivoImagen(archivo).motivo).toBe('formato-no-admitido')
  })

  it('rechaza un archivo vacío', () => {
    const archivo = new File([], 'vacia.png', { type: 'image/png' })
    const resultado = validarArchivoImagen(archivo)

    expect(resultado.valido).toBe(false)
    expect(resultado.motivo).toBe('vacia')
    expect(resultado.mensaje).toContain('vacío')
  })

  it('rechaza un nombre sin extensión', () => {
    const archivo = new File([new Uint8Array([1])], 'imagen', {
      type: 'image/png',
    })

    expect(esArchivoImagen(archivo)).toBe(false)
  })
})

describe('anadirImagenesASeleccion', () => {
  it('añade las imágenes válidas conservando el orden de llegada', () => {
    const primera = crearArchivoImagen('a', 10, 10)
    const segunda = crearArchivoImagen('b', 20, 20)

    const resultado = anadirImagenesASeleccion([], [primera, segunda])

    expect(resultado.numeroAnadidas).toBe(2)
    expect(resultado.imagenes.map((imagen) => imagen.nombre)).toEqual([
      'a.png',
      'b.png',
    ])
    expect(resultado.descartadas).toHaveLength(0)
  })

  it('inicia cada imagen sin rotación y sin medidas conocidas', () => {
    const resultado = anadirImagenesASeleccion(
      [],
      [crearArchivoImagen('a', 10, 10)],
    )

    expect(resultado.imagenes[0].rotacion).toBe(0)
    expect(resultado.imagenes[0].dimensiones).toBeNull()
  })

  it('descarta los duplicados exactos por nombre, tamaño y fecha', () => {
    const original = crearArchivoImagen('a', 10, 10, 'png', 1000)
    const copia = crearArchivoImagen('a', 10, 10, 'png', 1000)

    const primera = anadirImagenesASeleccion([], [original])
    const segunda = anadirImagenesASeleccion(primera.imagenes, [copia])

    expect(segunda.numeroAnadidas).toBe(0)
    expect(segunda.imagenes).toHaveLength(1)
    expect(segunda.descartadas[0].motivo).toBe('duplicada')
  })

  it('no considera duplicado un archivo con otra fecha de modificación', () => {
    const original = crearArchivoImagen('a', 10, 10, 'png', 1000)
    const distinta = crearArchivoImagen('a', 10, 10, 'png', 2000)

    const primera = anadirImagenesASeleccion([], [original])
    const segunda = anadirImagenesASeleccion(primera.imagenes, [distinta])

    expect(segunda.numeroAnadidas).toBe(1)
    expect(segunda.imagenes).toHaveLength(2)
  })

  it('descarta los duplicados dentro de la misma selección', () => {
    const archivo = crearArchivoImagen('a', 10, 10, 'png', 1000)

    const resultado = anadirImagenesASeleccion([], [archivo, archivo])

    expect(resultado.numeroAnadidas).toBe(1)
    expect(resultado.descartadas).toHaveLength(1)
  })

  it('devuelve la misma lista cuando no se añade nada', () => {
    const inicial = anadirImagenesASeleccion(
      [],
      [crearArchivoImagen('a', 10, 10)],
    ).imagenes
    const invalido = new File([new Uint8Array([1])], 'malo.txt', {
      type: 'text/plain',
    })

    const resultado = anadirImagenesASeleccion(inicial, [invalido])

    expect(resultado.imagenes).toBe(inicial)
  })

  it('añade las nuevas al final de la selección existente', () => {
    const inicial = anadirImagenesASeleccion(
      [],
      [crearArchivoImagen('a', 10, 10)],
    ).imagenes

    const resultado = anadirImagenesASeleccion(inicial, [
      crearArchivoImagen('b', 10, 10),
    ])

    expect(resultado.imagenes.map((imagen) => imagen.nombre)).toEqual([
      'a.png',
      'b.png',
    ])
  })
})

describe('operaciones sobre la selección de imágenes', () => {
  /** Construye una selección de tres imágenes llamadas a, b y c. */
  function crearSeleccion() {
    return anadirImagenesASeleccion(
      [],
      [
        crearArchivoImagen('a', 10, 10),
        crearArchivoImagen('b', 10, 10),
        crearArchivoImagen('c', 10, 10),
      ],
    ).imagenes
  }

  /** Devuelve los nombres, sin extensión, para comparar el orden con claridad. */
  function nombres(imagenes: readonly { readonly nombre: string }[]) {
    return imagenes.map((imagen) => imagen.nombre.replace('.png', ''))
  }

  it('elimina la imagen indicada', () => {
    const seleccion = crearSeleccion()

    const resultado = eliminarImagenDeSeleccion(seleccion, seleccion[1].id)

    expect(nombres(resultado)).toEqual(['a', 'c'])
  })

  it('mueve una imagen a la posición anterior', () => {
    const seleccion = crearSeleccion()

    expect(nombres(moverImagen(seleccion, seleccion[2].id, 'anterior'))).toEqual(
      ['a', 'c', 'b'],
    )
  })

  it('mueve una imagen a la posición siguiente', () => {
    const seleccion = crearSeleccion()

    expect(nombres(moverImagen(seleccion, seleccion[0].id, 'siguiente'))).toEqual(
      ['b', 'a', 'c'],
    )
  })

  it('lleva una imagen al inicio', () => {
    const seleccion = crearSeleccion()

    expect(nombres(moverImagen(seleccion, seleccion[2].id, 'inicio'))).toEqual([
      'c',
      'a',
      'b',
    ])
  })

  it('lleva una imagen al final', () => {
    const seleccion = crearSeleccion()

    expect(nombres(moverImagen(seleccion, seleccion[0].id, 'final'))).toEqual([
      'b',
      'c',
      'a',
    ])
  })

  it('no altera la lista al mover más allá de los límites', () => {
    const seleccion = crearSeleccion()

    expect(moverImagen(seleccion, seleccion[0].id, 'anterior')).toBe(seleccion)
    expect(moverImagen(seleccion, seleccion[2].id, 'siguiente')).toBe(seleccion)
  })

  it('no altera la lista si el identificador no existe', () => {
    const seleccion = crearSeleccion()

    expect(moverImagen(seleccion, 'inexistente', 'inicio')).toBe(seleccion)
  })

  it('reordena una imagen de una posición a otra', () => {
    const seleccion = crearSeleccion()

    expect(nombres(reordenarImagenes(seleccion, 0, 2))).toEqual(['b', 'c', 'a'])
  })

  it('gira una imagen a la derecha en cuartos de vuelta', () => {
    let seleccion = crearSeleccion()
    const id = seleccion[0].id

    seleccion = girarImagen(seleccion, id, 'derecha')
    expect(seleccion[0].rotacion).toBe(90)

    seleccion = girarImagen(seleccion, id, 'derecha')
    expect(seleccion[0].rotacion).toBe(180)

    seleccion = girarImagen(seleccion, id, 'derecha')
    expect(seleccion[0].rotacion).toBe(270)

    seleccion = girarImagen(seleccion, id, 'derecha')
    expect(seleccion[0].rotacion).toBe(0)
  })

  it('gira una imagen a la izquierda', () => {
    const seleccion = crearSeleccion()

    expect(girarImagen(seleccion, seleccion[0].id, 'izquierda')[0].rotacion).toBe(
      270,
    )
  })

  it('solo gira la imagen indicada', () => {
    const seleccion = crearSeleccion()

    const resultado = girarImagen(seleccion, seleccion[1].id, 'derecha')

    expect(resultado[0].rotacion).toBe(0)
    expect(resultado[1].rotacion).toBe(90)
    expect(resultado[2].rotacion).toBe(0)
  })

  it('suma el tamaño de todas las imágenes', () => {
    const seleccion = crearSeleccion()
    const esperado = seleccion.reduce((suma, imagen) => suma + imagen.tamano, 0)

    expect(calcularTamanoTotalImagenes(seleccion)).toBe(esperado)
    expect(calcularTamanoTotalImagenes([])).toBe(0)
  })
})

describe('avisos de imágenes descartadas', () => {
  it('no devuelve aviso cuando no se descartó ninguna', () => {
    expect(describirDescartesImagenes([])).toBeNull()
    expect(resumirDescartes([])).toBeNull()
  })

  it('detalla el motivo de un único descarte', () => {
    const aviso = describirDescartesImagenes([
      { nombre: 'malo.txt', motivo: 'formato-no-admitido' },
    ])

    expect(aviso).toContain('Se descartó 1 archivo')
    expect(aviso).toContain('malo.txt')
    expect(aviso).toContain('no tiene un formato de imagen admitido')
  })

  it('resume cuando hay más descartes de los que detalla', () => {
    const aviso = describirDescartesImagenes([
      { nombre: '1.txt', motivo: 'formato-no-admitido' },
      { nombre: '2.txt', motivo: 'formato-no-admitido' },
      { nombre: '3.txt', motivo: 'formato-no-admitido' },
      { nombre: '4.txt', motivo: 'formato-no-admitido' },
    ])

    expect(aviso).toContain('Se descartaron 4 archivos')
    expect(aviso).toContain('Y 1 archivo más')
  })

  it('agrupa los motivos en el resumen breve', () => {
    const aviso = resumirDescartes([
      'formato-no-admitido',
      'formato-no-admitido',
      'duplicada',
    ])

    expect(aviso).toContain('2 archivos no tienen un formato de imagen admitido')
    expect(aviso).toContain('1 imagen ya estaba en la lista')
  })
})
