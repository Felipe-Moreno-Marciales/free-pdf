import * as pdfLib from 'pdf-lib'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  borrarMetadatos,
  contarMetadatos,
  describirMetadatos,
  formatearFecha,
  hayMetadatos,
  leerMetadatos,
} from '../compresion/metadatosPdf'
import {
  CALIDAD_JPEG,
  calcularMedidasDestino,
  describirPerfil,
  explicarInventario,
  explicarPerfil,
  interpretarFiltro,
  inventariar,
  LADO_MAXIMO,
  localizarImagenes,
  PERFILES,
  seVaARecomprimir,
  type ImagenIncrustada,
  type PerfilCompresion,
} from '../compresion/imagenesPdf'
import {
  explicarImagenes,
  recomprimirImagenes,
} from '../compresion/recomprimirImagenes'
import { crearAdaptadorPrueba, crearJpeg } from './ayudas/crearJpegPrueba'

/** Documento con una imagen JPEG grande y texto, el caso interesante. */
async function pdfConImagen(
  lado = 400,
  paginas = 3,
): Promise<{ readonly bytes: Uint8Array; readonly documento: PDFDocument }> {
  const documento = await PDFDocument.create()
  const tipografia = await documento.embedFont(StandardFonts.Helvetica)
  const imagen = await documento.embedJpg(crearJpeg(lado))

  for (let pagina = 0; pagina < paginas; pagina += 1) {
    const hoja = documento.addPage([595, 842])
    hoja.drawText(`TEXTO IMPORTANTE de la pagina ${pagina}`, {
      x: 50,
      y: 800,
      size: 14,
      font: tipografia,
    })
    hoja.drawImage(imagen, { x: 50, y: 200, width: 450, height: 450 })
  }

  const bytes = await documento.save({ useObjectStreams: false })

  return { bytes, documento }
}

/** Documento sin ninguna imagen. */
async function pdfSinImagenes(): Promise<Uint8Array> {
  const documento = await PDFDocument.create()
  const tipografia = await documento.embedFont(StandardFonts.Helvetica)
  const hoja = documento.addPage([595, 842])
  hoja.drawText('Solo texto', { x: 50, y: 800, size: 14, font: tipografia })

  return await documento.save({ useObjectStreams: false })
}

/** Imagen de ejemplo, para las funciones que solo necesitan sus medidas. */
function imagen(cambios: Partial<ImagenIncrustada> = {}): ImagenIncrustada {
  return {
    referencia: pdfLib.PDFRef.of(1),
    flujo: pdfLib.PDFRawStream.of(
      pdfLib.PDFDict.withContext(pdfLib.PDFContext.create()),
      new Uint8Array(0),
    ),
    filtro: 'jpeg',
    ancho: 2000,
    alto: 1000,
    bytes: 500_000,
    tieneMascara: false,
    ...cambios,
  }
}

describe('interpretarFiltro', () => {
  it('reconoce los JPEG', () => {
    expect(interpretarFiltro('/DCTDecode')).toBe('jpeg')
  })

  it('reconoce los flujos Flate', () => {
    expect(interpretarFiltro('/FlateDecode')).toBe('flate')
  })

  it('deja como «otro» lo que no reconoce', () => {
    expect(interpretarFiltro('/JPXDecode')).toBe('otro')
    expect(interpretarFiltro('')).toBe('otro')
  })

  it('reconoce el filtro dentro de una cadena de filtros', () => {
    expect(interpretarFiltro('[/FlateDecode /DCTDecode]')).toBe('jpeg')
  })
})

describe('localizarImagenes', () => {
  it('encuentra la imagen incrustada de un documento', async () => {
    const { bytes } = await pdfConImagen()
    const abierto = await PDFDocument.load(bytes)

    const encontradas = localizarImagenes(abierto, pdfLib)

    expect(encontradas).toHaveLength(1)
    expect(encontradas[0]?.filtro).toBe('jpeg')
    expect(encontradas[0]?.ancho).toBe(400)
    expect(encontradas[0]?.alto).toBe(400)
    expect(encontradas[0]?.bytes).toBeGreaterThan(1000)
  })

  it('no encuentra nada en un documento sin imágenes', async () => {
    const abierto = await PDFDocument.load(await pdfSinImagenes())

    expect(localizarImagenes(abierto, pdfLib)).toHaveLength(0)
  })

  it('la imagen se cuenta una sola vez aunque se dibuje en varias páginas', async () => {
    // Es importante: pdf-lib incrusta el objeto una vez y lo referencia tres veces.
    // Recomprimirla tres veces sería un desperdicio.
    const { bytes } = await pdfConImagen(400, 5)
    const abierto = await PDFDocument.load(bytes)

    expect(localizarImagenes(abierto, pdfLib)).toHaveLength(1)
  })
})

describe('calcularMedidasDestino', () => {
  it('no cambia el tamaño si la imagen ya cabe en el límite', () => {
    const destino = calcularMedidasDestino(
      imagen({ ancho: 800, alto: 600 }),
      'equilibrada',
    )

    expect(destino.cambiaTamano).toBe(false)
    expect(destino.ancho).toBe(800)
    expect(destino.alto).toBe(600)
  })

  it('reduce por el lado más largo y conserva la proporción', () => {
    const destino = calcularMedidasDestino(
      imagen({ ancho: 3200, alto: 1600 }),
      'equilibrada',
    )

    expect(destino.ancho).toBe(LADO_MAXIMO.equilibrada)
    expect(destino.alto).toBe(LADO_MAXIMO.equilibrada / 2)
    expect(destino.cambiaTamano).toBe(true)
  })

  it('conserva la proporción también cuando el lado largo es el alto', () => {
    const destino = calcularMedidasDestino(
      imagen({ ancho: 1000, alto: 4000 }),
      'alta',
    )

    expect(destino.alto).toBe(LADO_MAXIMO.alta)
    expect(destino.ancho / destino.alto).toBeCloseTo(1000 / 4000, 2)
  })

  it('nunca deja un lado en cero, ni con una imagen extremadamente alargada', () => {
    const destino = calcularMedidasDestino(
      imagen({ ancho: 10_000, alto: 3 }),
      'alta',
    )

    expect(destino.ancho).toBeGreaterThan(0)
    expect(destino.alto).toBeGreaterThanOrEqual(1)
  })

  it('el perfil alto reduce más que el equilibrado, y este más que el ligero', () => {
    const grande = imagen({ ancho: 4000, alto: 4000 })

    const ligera = calcularMedidasDestino(grande, 'ligera')
    const equilibrada = calcularMedidasDestino(grande, 'equilibrada')
    const alta = calcularMedidasDestino(grande, 'alta')

    expect(ligera.ancho).toBeGreaterThan(equilibrada.ancho)
    expect(equilibrada.ancho).toBeGreaterThan(alta.ancho)
  })
})

describe('seVaARecomprimir', () => {
  it('acepta un JPEG grande', () => {
    expect(seVaARecomprimir(imagen(), 'equilibrada')).toBe(true)
  })

  it('descarta las imágenes que no son JPEG', () => {
    expect(seVaARecomprimir(imagen({ filtro: 'flate' }), 'alta')).toBe(false)
    expect(seVaARecomprimir(imagen({ filtro: 'otro' }), 'alta')).toBe(false)
  })

  it('descarta las imágenes diminutas, donde no hay nada que ahorrar', () => {
    expect(
      seVaARecomprimir(
        imagen({ ancho: 32, alto: 32, bytes: 900 }),
        'alta',
      ),
    ).toBe(false)
  })

  it('recomprime una imagen que ya cabe, si la calidad del perfil baja de verdad', () => {
    const pequena = imagen({ ancho: 500, alto: 500, bytes: 100_000 })

    expect(seVaARecomprimir(pequena, 'alta')).toBe(true)
    expect(seVaARecomprimir(pequena, 'equilibrada')).toBe(true)
  })

  it('el perfil ligero no toca una imagen que ya cabe en su límite', () => {
    // Con calidad 0,9 no merece la pena recodificar sin redimensionar.
    expect(
      seVaARecomprimir(imagen({ ancho: 500, alto: 500, bytes: 100_000 }), 'ligera'),
    ).toBe(false)
  })
})

describe('inventariar y explicarInventario', () => {
  it('cuenta las imágenes por tipo', () => {
    const inventario = inventariar(
      [
        imagen({ filtro: 'jpeg' }),
        imagen({ filtro: 'jpeg' }),
        imagen({ filtro: 'flate' }),
      ],
      'equilibrada',
    )

    expect(inventario.total).toBe(3)
    expect(inventario.jpeg).toBe(2)
    expect(inventario.flate).toBe(1)
    expect(inventario.recomprimibles).toBe(2)
  })

  it('suma los bytes de todas las imágenes', () => {
    const inventario = inventariar(
      [imagen({ bytes: 1000 }), imagen({ bytes: 2000 })],
      'alta',
    )

    expect(inventario.bytesImagenes).toBe(3000)
  })

  it('avisa cuando el documento no tiene imágenes y el perfil da igual', () => {
    const texto = explicarInventario(inventariar([], 'alta'))

    expect(texto).toMatch(/no tiene imágenes/i)
    expect(texto).toMatch(/perfil que elijas no cambiará/i)
  })

  it('explica por qué no se tocan las que no son JPEG', () => {
    const texto = explicarInventario(
      inventariar([imagen({ filtro: 'flate' })], 'alta'),
    )

    expect(texto).toMatch(/solo se recomprimen las imágenes JPEG/i)
    expect(texto).toMatch(/cambiar los colores/i)
  })

  it('dice cuántas se van a recomprimir', () => {
    const texto = explicarInventario(
      inventariar([imagen(), imagen()], 'equilibrada'),
    )

    expect(texto).toContain('2')
  })
})

describe('recomprimirImagenes', () => {
  it('sustituye la imagen y reduce el documento de verdad', async () => {
    const { bytes } = await pdfConImagen(400)
    const abierto = await PDFDocument.load(bytes)

    const resultado = await recomprimirImagenes(
      abierto,
      pdfLib,
      'alta',
      crearAdaptadorPrueba(),
    )

    expect(resultado.sustituidas).toBe(1)

    const nuevos = await abierto.save({ useObjectStreams: false })
    expect(nuevos.byteLength).toBeLessThan(bytes.byteLength)
  })

  it('el documento resultante conserva el texto y se puede abrir', async () => {
    const { bytes } = await pdfConImagen(400)
    const abierto = await PDFDocument.load(bytes)

    await recomprimirImagenes(abierto, pdfLib, 'alta', crearAdaptadorPrueba())

    const nuevos = await abierto.save({ useObjectStreams: false })
    const reabierto = await PDFDocument.load(nuevos, {
      ignoreEncryption: false,
    })

    expect(reabierto.getPageCount()).toBe(3)

    // La tipografía incrustada sigue ahí: no se ha rasterizado nada.
    const texto = new TextDecoder('latin1').decode(nuevos)
    expect(texto).toContain('Helvetica')
    expect(texto).toContain('DCTDecode')
  })

  it('actualiza las medidas declaradas de la imagen', async () => {
    const { bytes } = await pdfConImagen(2500)
    const abierto = await PDFDocument.load(bytes)

    await recomprimirImagenes(abierto, pdfLib, 'alta', crearAdaptadorPrueba())

    const despues = localizarImagenes(abierto, pdfLib)

    expect(despues[0]?.ancho).toBe(LADO_MAXIMO.alta)
    expect(despues[0]?.alto).toBe(LADO_MAXIMO.alta)
  })

  it('conserva la imagen original si la recomprimida no es más pequeña', async () => {
    const { bytes } = await pdfConImagen(400)
    const abierto = await PDFDocument.load(bytes)

    const resultado = await recomprimirImagenes(
      abierto,
      pdfLib,
      'alta',
      crearAdaptadorPrueba({ devuelveMasGrande: true }),
    )

    expect(resultado.sustituidas).toBe(0)
    expect(resultado.conservadas).toBe(1)
  })

  it('deja la imagen intacta si el navegador no puede descodificarla', async () => {
    const { bytes } = await pdfConImagen(400)
    const abierto = await PDFDocument.load(bytes)

    const resultado = await recomprimirImagenes(
      abierto,
      pdfLib,
      'alta',
      crearAdaptadorPrueba({ falla: true }),
    )

    expect(resultado.noDescodificadas).toBe(1)
    expect(resultado.sustituidas).toBe(0)

    // Y el documento sigue siendo válido.
    const nuevos = await abierto.save({ useObjectStreams: false })
    expect((await PDFDocument.load(nuevos)).getPageCount()).toBe(3)
  })

  it('no hace nada en un documento sin imágenes', async () => {
    const abierto = await PDFDocument.load(await pdfSinImagenes())

    const resultado = await recomprimirImagenes(
      abierto,
      pdfLib,
      'alta',
      crearAdaptadorPrueba(),
    )

    expect(resultado.sustituidas).toBe(0)
    expect(resultado.conservadas).toBe(0)
    expect(resultado.noDescodificadas).toBe(0)
  })

  it('informa del progreso una vez por imagen', async () => {
    const documento = await PDFDocument.create()

    // Tres imágenes distintas, con semillas distintas para que sean objetos aparte.
    for (let indice = 0; indice < 3; indice += 1) {
      const incrustada = await documento.embedJpg(crearJpeg(400, 1000 + indice))
      documento
        .addPage([595, 842])
        .drawImage(incrustada, { x: 0, y: 0, width: 400, height: 400 })
    }

    const bytes = await documento.save({ useObjectStreams: false })
    const abierto = await PDFDocument.load(bytes)

    const pasos: number[] = []

    await recomprimirImagenes(
      abierto,
      pdfLib,
      'alta',
      crearAdaptadorPrueba(),
      { alProgreso: (progreso) => pasos.push(progreso.completadas) },
    )

    expect(pasos).toEqual([1, 2, 3])
  })

  it('el total del progreso es el número de imágenes que se van a tocar', async () => {
    const { bytes } = await pdfConImagen(400)
    const abierto = await PDFDocument.load(bytes)

    let total = 0

    await recomprimirImagenes(abierto, pdfLib, 'alta', crearAdaptadorPrueba(), {
      alProgreso: (progreso) => {
        total = progreso.total
      },
    })

    expect(total).toBe(1)
  })

  it('se puede cancelar antes de empezar', async () => {
    const { bytes } = await pdfConImagen(400)
    const abierto = await PDFDocument.load(bytes)

    const controlador = new AbortController()
    controlador.abort()

    await expect(
      recomprimirImagenes(abierto, pdfLib, 'alta', crearAdaptadorPrueba(), {
        senal: controlador.signal,
      }),
    ).rejects.toThrow()
  })

  it('procesa las imágenes de una en una, no en paralelo', async () => {
    const documento = await PDFDocument.create()

    for (let indice = 0; indice < 3; indice += 1) {
      const incrustada = await documento.embedJpg(crearJpeg(400, 2000 + indice))
      documento
        .addPage([595, 842])
        .drawImage(incrustada, { x: 0, y: 0, width: 400, height: 400 })
    }

    const abierto = await PDFDocument.load(
      await documento.save({ useObjectStreams: false }),
    )

    const registro = { llamadas: [] as number[] }

    await recomprimirImagenes(
      abierto,
      pdfLib,
      'alta',
      crearAdaptadorPrueba({ registro }),
    )

    // Tres llamadas, una por imagen: si fueran en paralelo el progreso no podría ser
    // fiable ni la cancelación efectiva.
    expect(registro.llamadas).toHaveLength(3)
  })

  it('el perfil ligero toca menos imágenes que el alto', async () => {
    const { bytes } = await pdfConImagen(1500)

    const conLigera = await PDFDocument.load(bytes)
    const ligera = await recomprimirImagenes(
      conLigera,
      pdfLib,
      'ligera',
      crearAdaptadorPrueba(),
    )

    const conAlta = await PDFDocument.load(bytes)
    const alta = await recomprimirImagenes(
      conAlta,
      pdfLib,
      'alta',
      crearAdaptadorPrueba(),
    )

    // Con 1500 píxeles de lado, el perfil ligero (límite 2200) no la redimensiona ni
    // baja la calidad lo suficiente, así que no la toca; el alto sí.
    expect(ligera.sustituidas).toBe(0)
    expect(alta.sustituidas).toBe(1)
  })
})

describe('explicarImagenes', () => {
  it('avisa cuando no había nada que recomprimir', () => {
    expect(
      explicarImagenes({
        sustituidas: 0,
        conservadas: 0,
        bytesAntes: 0,
        bytesDespues: 0,
        noDescodificadas: 0,
      }),
    ).toMatch(/no había imágenes/i)
  })

  it('dice cuántas se recomprimieron y cuánto se ahorró', () => {
    const texto = explicarImagenes({
      sustituidas: 3,
      conservadas: 0,
      bytesAntes: 3_000_000,
      bytesDespues: 1_000_000,
      noDescodificadas: 0,
    })

    expect(texto).toContain('3')
    expect(texto).toMatch(/KB/)
  })

  it('explica por qué se conservaron algunas', () => {
    const texto = explicarImagenes({
      sustituidas: 0,
      conservadas: 2,
      bytesAntes: 0,
      bytesDespues: 0,
      noDescodificadas: 0,
    })

    expect(texto).toMatch(/no las habría hecho más pequeñas/i)
  })

  it('informa de las que no se pudieron descodificar', () => {
    const texto = explicarImagenes({
      sustituidas: 0,
      conservadas: 0,
      bytesAntes: 0,
      bytesDespues: 0,
      noDescodificadas: 1,
    })

    expect(texto).toMatch(/no se pudo descodificar/i)
    expect(texto).toMatch(/intacta/i)
  })
})

describe('perfiles', () => {
  it('hay exactamente tres', () => {
    expect(PERFILES).toEqual<readonly PerfilCompresion[]>([
      'ligera',
      'equilibrada',
      'alta',
    ])
  })

  it('cada perfil tiene nombre y explicación', () => {
    for (const perfil of PERFILES) {
      expect(describirPerfil(perfil).length).toBeGreaterThan(0)
      expect(explicarPerfil(perfil).length).toBeGreaterThan(20)
    }
  })

  it('cada explicación dice el lado máximo y la calidad concretos', () => {
    for (const perfil of PERFILES) {
      const texto = explicarPerfil(perfil)

      expect(texto).toContain(String(LADO_MAXIMO[perfil]))
      expect(texto).toContain(String(Math.round(CALIDAD_JPEG[perfil] * 100)))
    }
  })

  it('el perfil alto advierte de que se va a notar', () => {
    expect(explicarPerfil('alta')).toMatch(/se va a notar/i)
  })

  it('los límites y las calidades decrecen con la agresividad', () => {
    expect(LADO_MAXIMO.ligera).toBeGreaterThan(LADO_MAXIMO.equilibrada)
    expect(LADO_MAXIMO.equilibrada).toBeGreaterThan(LADO_MAXIMO.alta)
    expect(CALIDAD_JPEG.ligera).toBeGreaterThan(CALIDAD_JPEG.equilibrada)
    expect(CALIDAD_JPEG.equilibrada).toBeGreaterThan(CALIDAD_JPEG.alta)
  })
})

describe('metadatos', () => {
  /** Documento con todos los metadatos puestos. */
  async function conMetadatos(): Promise<PDFDocument> {
    const documento = await PDFDocument.create()
    documento.addPage([595, 842])
    documento.setTitle('Informe confidencial')
    documento.setAuthor('Ana García')
    documento.setSubject('Cuentas del ejercicio')
    documento.setKeywords(['finanzas', 'interno'])
    documento.setCreator('Programa de la empresa')
    documento.setProducer('Otro programa')
    documento.setCreationDate(new Date('2024-03-15T10:00:00Z'))
    documento.setModificationDate(new Date('2024-04-01T12:00:00Z'))

    return documento
  }

  it('lee todos los metadatos de un documento', async () => {
    const metadatos = leerMetadatos(await conMetadatos())

    expect(metadatos.titulo).toBe('Informe confidencial')
    expect(metadatos.autor).toBe('Ana García')
    expect(metadatos.asunto).toBe('Cuentas del ejercicio')
    expect(metadatos.palabrasClave).toContain('finanzas')
    expect(metadatos.creador).toBe('Programa de la empresa')
    expect(metadatos.productor).toBe('Otro programa')
    expect(metadatos.fechaCreacion).not.toBeNull()
  })

  it('detecta que hay metadatos que identifican a alguien', async () => {
    expect(hayMetadatos(leerMetadatos(await conMetadatos()))).toBe(true)
  })

  it('no detecta metadatos en un documento recién creado y limpio', async () => {
    const documento = await PDFDocument.create()
    documento.addPage([595, 842])
    borrarMetadatos(documento)

    expect(hayMetadatos(leerMetadatos(documento))).toBe(false)
  })

  it('los borra todos', async () => {
    const documento = await conMetadatos()
    borrarMetadatos(documento)

    const despues = leerMetadatos(documento)

    expect(despues.titulo).toBe('')
    expect(despues.autor).toBe('')
    expect(despues.asunto).toBe('')
    expect(despues.palabrasClave).toHaveLength(0)
    expect(despues.creador).toBe('')
    expect(despues.productor).toBe('')
  })

  it('las fechas quedan en un instante neutro, no en la fecha de hoy', async () => {
    const documento = await conMetadatos()
    borrarMetadatos(documento)

    const despues = leerMetadatos(documento)

    // Poner la fecha actual delataría cuándo se procesó el documento.
    expect(despues.fechaCreacion?.getTime()).toBe(0)
    expect(despues.fechaModificacion?.getTime()).toBe(0)
  })

  it('el borrado sobrevive a guardar y volver a abrir', async () => {
    const documento = await conMetadatos()
    borrarMetadatos(documento)

    const bytes = await documento.save()
    const reabierto = await PDFDocument.load(bytes)

    expect(leerMetadatos(reabierto).autor).toBe('')
  })

  it('cuenta cuántos metadatos con contenido hay', async () => {
    expect(contarMetadatos(leerMetadatos(await conMetadatos()))).toBe(8)
  })

  it('describe los metadatos para mostrarlos, sin las entradas vacías', async () => {
    const filas = describirMetadatos(leerMetadatos(await conMetadatos()))

    expect(filas.length).toBeGreaterThan(0)
    expect(filas.every((fila) => fila.valor !== '')).toBe(true)
    expect(filas.map((fila) => fila.clave)).toContain('Autor')
  })

  it('las claves de la descripción están en español', async () => {
    const claves = describirMetadatos(
      leerMetadatos(await conMetadatos()),
    ).map((fila) => fila.clave)

    expect(claves).toContain('Título')
    expect(claves).toContain('Palabras clave')
    expect(claves).toContain('Creado con')
  })

  it('formatea las fechas en formato español', () => {
    expect(formatearFecha(new Date('2024-03-15T10:00:00Z'))).toBe('15/03/2024')
  })
})
