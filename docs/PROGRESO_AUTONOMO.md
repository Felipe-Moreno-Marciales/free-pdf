# Progreso autónomo

Registro del trabajo realizado sin supervisión directa. Deja constancia honesta
de **qué está terminado y verificado**, qué quedó bloqueado por una limitación
técnica y cuáles son los invariantes que debe conservar el mantenimiento.

**Última actualización:** 17 de agosto de 2026
**Rama:** `development`
**Compilación:** correcta · **Tipos:** correctos · **Análisis estático:** limpio
**Pruebas:** 1499, todas pasando, en 46 archivos
**Herramientas registradas y funcionando:** 24

**Interfaz:** identidad visual azul y selector accesible de tema claro/oscuro;
parte de la preferencia del dispositivo y no la guarda de forma persistente.

**Instalación:** PWA con manifiesto, iconos normal y enmascarable, actualización
versionada y precaché de los 285 recursos locales para uso sin conexión.

## Cómo leer este documento

Una funcionalidad se marca **Terminada** solo si cumple las cuatro condiciones:

1. La lógica está implementada.
2. Tiene pruebas automatizadas que la cubren.
3. Tiene interfaz de usuario accesible y registrada en el catálogo.
4. `pnpm lint`, `pnpm tipos`, `pnpm pruebas` y `pnpm build` pasan con ella dentro.

Si falta cualquiera de las cuatro, se marca **Parcial**, **No empezada** o
**Bloqueada** y se dice qué falta. No se marca nada como terminado por
aproximación.

## Estado por fases

### Fase 1 — Base y organización · Terminada

Unir, Dividir, Extraer páginas, Eliminar páginas, Organizar páginas, Rotar páginas. Seis de seis.

Incluye la infraestructura compartida: carga de documentos, miniaturas con PDF.js, selección de rangos, cancelación cooperativa, liberación de recursos y descarga.

### Fase 2 — Creación y personalización · Terminada

Imágenes a PDF, PDF a imágenes, Numerar páginas, Marca de agua, Recortar PDF, Escanear a PDF. Seis de seis.

Infraestructura reutilizable que dejó esta fase:

- `src/imagenes/` — validación, decodificación (`createImageBitmap` con reserva a `<img>`), ajuste a la página, filtros, recorte.
- `src/pdf/posicionarEnPagina.ts` — geometría de colocación, incluidas páginas giradas, y mosaicos.
- `compilacion/recursosPdfJs.ts` — complemento de Vite que publica los recursos de PDF.js (cmaps, tipografías estándar, WebAssembly, perfiles ICC) **desde el propio sitio**, sin CDN.
- `src/pdf/cancelacion.ts` — cancelación cooperativa entre páginas.

### Fase 3 — Seguridad y edición · Terminada

**Siete herramientas terminadas.** La inspección estructural se añadió sin
cambiar el procesamiento local de la fase.

| Herramienta | Estado | Nota |
| ----------- | ------ | ---- |
| Inspector de seguridad PDF | Terminada | JSON estructural de qpdf, reglas deterministas y sin ejecutar contenido activo |
| Proteger PDF | Terminada | AES-256 real con qpdf 12.2.0 en WebAssembly |
| Desbloquear PDF | Terminada | Descifrado real, con la contraseña correcta |
| Formularios PDF | Terminada | Inspección, rellenado, creación y aplanado |
| Censurar permanentemente | Terminada | Reconstrucción por rasterizado, con verificación |
| Editar y anotar | Terminada | Capa encima; **no** modifica el texto original |
| Firma visual | Terminada | Es un dibujo; **no** es una firma digital |

Documentación: [CIFRADO.md](CIFRADO.md), [SEGURIDAD.md](SEGURIDAD.md), [CENSURA.md](CENSURA.md), [EDICION.md](EDICION.md).

Lo relevante de la integración de qpdf, porque condiciona todo lo que venga después:

- Se ejecuta en un **Web Worker** propio, que se destruye al terminar.
- La consola se intercepta **antes** de evaluar el módulo, porque el código de enlace de Emscripten captura `console.log` y `console.error` en el momento de la evaluación. Hacerlo después no funciona.
- El sistema de archivos virtual se limpia siempre, en `finally`.
- Las contraseñas de descifrado se pasan por `--password-file`, no en la lista de argumentos.
- La suite incluye pruebas que ejecutan el **WebAssembly real**, no una
  imitación, también para el Inspector.

Lo relevante del editor visual, que es lo último construido:

- `src/edicion/` es el motor compartido de «Editar y anotar» y «Firma visual». La geometría es pura y está probada entera sin navegador; lo que necesita navegador se inyecta.
- Las posiciones van en **fracciones de la página**, nunca en píxeles, igual que en la censura y la marca de agua.
- `calcularColocacionLibre` se añadió a `posicionarEnPagina.ts` para colocar en un punto cualquiera reutilizando la traducción de páginas giradas que ya estaba probada, en lugar de duplicarla.
- El documento de pdf-lib se abre **al aplicar**, no al cargar: así aplicar dos veces con la misma capa da el mismo documento.

### Fase 4 — Conversión y análisis · Cerrada

**Cinco herramientas terminadas y una bloqueada de forma documentada.** El
proyecto puede considerarse completo sin presentar PDF/A como disponible.

| Herramienta | Estado | Nota |
| ----------- | ------ | ---- |
| Reparar PDF | **Terminada** | Diagnóstico con `--check` y reescritura con qpdf, verificada contra el motor real |
| Comprimir PDF | **Terminada** | Recomprime imágenes JPEG con `canvas` **sin rasterizar** y optimiza la estructura con qpdf. Tres perfiles, metadatos, progreso y cancelación |
| Comparar PDF | **Terminada** | Texto, píxeles, medidas, giros y metadatos. Informe HTML autónomo |
| PDF a Markdown | **Terminada** | Extracción secuencial con PDF.js, estructura aproximada, vista editable, copia y descarga |
| OCR local | **Terminada** | Tesseract.js 7 real, `spa`/`eng` locales, imágenes y PDF, progreso, cancelación, TXT y Markdown |
| PDF/A | **Bloqueada; no disponible** | Los puertos Ghostscript WASM no incluyen validación PDF/A real y veraPDF requiere Java. Sin tarjeta ni ruta en el catálogo |

Lo que dejó construido «Reparar PDF», reutilizable por el resto de la fase:

- `src/seguridad/qpdf/reparacionPdf.ts` — puro: argumentos de `--check`, de reescritura y de `--show-npages`, más la interpretación de la salida de qpdf y el filtrado de su ruido.
- Dos operaciones nuevas en el trabajador (`diagnosticar` y `reparar`) y en el procesador, con el mismo patrón de instancia nueva por operación y limpieza del sistema virtual.
- `src/seguridad/qpdf/repararPdf.ts` — capa de alto nivel que prepara el archivo y redacta el resumen.

**Una lección que conviene no repetir.** Las primeras pruebas daban por hecho que qpdf reconstruye cualquier tabla de referencias rota. Ejecutarlas contra el motor real demostró que no: con `startxref` borrado o su desplazamiento falseado, qpdf termina con código 2 y **no escribe nada**. Lo que se corrigió fue la suposición, no la prueba. Antes de afirmar algo sobre qpdf en las fases siguientes, conviene medirlo con una sonda igual que se hizo aquí.

La evaluación PDF/A aplicó la misma regla. Ghostscript 10.08.0 puede crear
PDF/A-1, PDF/A-2 y PDF/A-3 nivel b, y existen varios puertos recientes a
WebAssembly, pero terminar la conversión no prueba conformidad. veraPDF 1.30.2
sí implementa los perfiles y los informes de validación, pero su distribución
oficial es Java. qpdf solo comprueba estructura y sintaxis. Todos los candidatos,
licencias, tamaños y descartes están en [PDFA.md](PDFA.md).

### Alcance definitivo del proyecto

**Free PDF es una aplicación web estática, publicada en GitHub Pages, que se ejecuta por completo en el navegador.** No hay más fases que la 4. Al terminarla, el proyecto está completo.

Lo que **no** va a existir, decidido de forma definitiva:

| Descartado | Motivo |
| ---------- | ------ |
| Conversiones de Word, Excel y PowerPoint | Exigen LibreOffice, y eso exige un servidor. |
| Arquitectura autohospedada con Docker | Era la vía propuesta para lo anterior. Sin conversiones de Office no tiene objeto. |
| API de servidor, backend, base de datos, cuentas, correo | Free PDF no tiene servidor y no va a tenerlo. |
| Resumir y traducir con modelos de lenguaje | O un modelo enorme en el navegador, o una API externa. Lo segundo rompe la promesa de que ningún documento sale del dispositivo. |
| Firma electrónica con participantes | Exige cuentas, correo y almacenamiento remoto. |
| Almacenamiento remoto de cualquier tipo | Contradice el principio central del proyecto. |

Esto **no** es una limitación pendiente de superar. Es lo que permite sostener la promesa de privacidad sin pedirle a nadie que se fíe.

Se mantienen: procesamiento local, Web Workers, WebAssembly, PDF.js, pdf-lib,
qpdf en WebAssembly, OCR local con Tesseract.js, GitHub Pages, privacidad por
diseño y código libre.

Las secciones históricas de este documento que hablaban de fases 5 y 6 se han sustituido por esta tabla. En [HOJA_DE_RUTA.md](HOJA_DE_RUTA.md) queda una sección «Alcance descartado» con el detalle, para que las decisiones anteriores no queden sin rastro.

## Estado de cierre

No queda otra herramienta del alcance definitivo por implementar. El siguiente
trabajo debe ser mantenimiento: corregir defectos, actualizar dependencias sin
romper los invariantes o reevaluar [PDFA.md](PDFA.md) únicamente si aparece un
validador PDF/A completo y mantenido para navegador/WebAssembly.

## Documentación

| Documento | Estado |
| --------- | ------ |
| `README.md` | Al día con las 24 herramientas y con el alcance definitivo |
| `docs/HOJA_DE_RUTA.md` | Al día; fase final cerrada con el bloqueo PDF/A |
| `docs/PROGRESO_AUTONOMO.md` | Este documento |
| `docs/CIFRADO.md` | Terminado |
| `docs/SEGURIDAD.md` | Terminado |
| `docs/CENSURA.md` | Terminado |
| `docs/EDICION.md` | Terminado |
| `docs/REPARACION.md` | Terminado |
| `docs/COMPRESION.md` | Terminado |
| `docs/COMPARACION.md` | Terminado |
| `docs/MARKDOWN.md` | Terminado |
| `docs/OCR.md` | Terminado |
| `docs/PDFA.md` | Bloqueo terminado y documentado |
| `docs/ARQUITECTURA.md` | No escrito |
| `docs/PRIVACIDAD.md` | No escrito |
| `CONTRIBUTING.md` | No escrito |
| `SECURITY.md` | No escrito |
| `CODE_OF_CONDUCT.md` | No escrito |

## Invariantes que no hay que romper en mantenimiento

Comprobadas y en vigor. Si algo de esto deja de ser cierto, es un defecto:

- Ningún archivo de la persona sale del navegador: sin backend, CDN, telemetría
  ni analítica. La red y `Cache Storage` se usan solo para distribuir y conservar
  los recursos estáticos de la PWA. Comprobado sobre el resultado de `pnpm build`.
- Sin `ignoreEncryption: true` en ninguna parte del código.
- Las contraseñas no aparecen en nombres de archivo, URLs ni registros, y no se quedan en el estado al terminar.
- La aleatoriedad viene de `crypto.getRandomValues`.
- Cada herramienta se carga de forma diferida, con su propio fragmento.
- Ruta base `/free-pdf/`, publicación en GitHub Pages solo desde `main`.
- Español en todo el código propio; inglés solo donde lo imponen el lenguaje, las bibliotecas o las APIs del navegador.
- Cero `any`, TypeScript en modo estricto.
- Las pruebas verifican comportamiento real; cuando hace falta el navegador se inyecta un adaptador, no se falsea el resultado.
- Ninguna función se presenta como terminada si no lo está. Las tres advertencias que no se pueden quitar: la edición no cambia el texto original, la firma visual no es digital, y recortar no oculta información.

## Comprobación antes de dar por terminado cualquier cambio

```
pnpm lint
pnpm exec tsc -b
pnpm pruebas
pnpm build
git diff --check
```

Las cinco tienen que pasar. `build` importa tanto como las demás: un fallo solo
allí suele significar que se ha colado en el código de navegador algo que solo
existe en Node.
